/**
 * لایه Application ماژول پروژه‌ها — تمام موارد استفاده فاز ۱:
 * ایجاد/فهرست/جزئیات/ویرایش/بایگانی/تکثیر + نسخه‌های پیکربندی + اعضا + ممیزی.
 *
 * قاعده امنیت (ADR-009): هر عملیات = نشست → نقش در projectId → فیلتر کوئری با projectId.
 * پاسخ بی‌مجاز ۴۰۴ است تا وجود/عدم وجود پروژه افشا نشود.
 *
 * قاعده جداسازی (A5): هر کوئری دامنه با projectId فیلتر می‌شود؛
 * ویرایش پروژه‌ای پروژه دیگر را تغییر نمی‌دهد (آزمون R1-2).
 */
import { db } from "@/lib/db";
import { uuidv7 } from "@/shared/ids";
import { ApiError } from "@/shared/errors";
import { getLogger } from "@/shared/logger";
import { isProjectRole, roleCan, type ProjectAction, type ProjectRole } from "@/shared/contracts/acl";
import type {
  ConfigVersionDto,
  MemberDto,
  ProjectDto,
  ProjectListDto,
} from "@/shared/contracts/api";
import type {
  ProjectCreateInput,
  ProjectListQuery,
  ProjectUpdateInput,
} from "@/shared/validation/project";
import type { ProfileComponentsInput } from "@/shared/validation/project";
import {
  computeReadiness,
  INITIAL_CONFIG_SEMVER,
  PROJECT_STATUS_LABELS_FA,
} from "../domain/project";
import {
  buildListWhere,
  countProjectsWithCode,
  findMembership,
  findProjectById,
  findMembershipsOfUser,
  insertConfigVersion,
  insertMembership,
  insertProject,
  listConfigVersionsOfProject,
  listProjectsWhere,
  updateProjectById,
  type ProjectRow,
} from "../infrastructure/project-repo";
import { getUserByEmail } from "@/modules/identity/application/auth-service";
import {
  getProfileTemplateById,
  getProfileTemplateNames,
  instantiateProfileSnapshot,
} from "@/modules/profiles/application/profile-service";
import { AUDIT_ACTIONS, recordAudit } from "@/modules/audit/application/audit-service";
import { getProjectAuditTrail } from "@/modules/audit/application/audit-service";

const log = getLogger("projects");

// ─────────────────────────── مجوزسنجی ───────────────────────────

/** عضویت + بررسی عملیات — ۴۰۴ اگر عضو نیستیم (بدون افشا)، ۴۰۳ اگر نقش کافی نیست. */
async function authorize(
  projectId: string,
  userId: string,
  action: ProjectAction,
): Promise<{ role: ProjectRole }> {
  const membership = await findMembership(projectId, userId);
  if (!membership) throw ApiError.notFound();
  const role = membership.role;
  if (!isProjectRole(role)) throw ApiError.notFound();
  if (!roleCan(role, action)) {
    throw ApiError.forbidden(
      `برای این عملیات نقش شما (${role}) کافی نیست.`,
    );
  }
  return { role };
}

// ─────────────────────────── تبدیل DTO ───────────────────────────

function toProjectDto(row: ProjectRow, templateNames: Map<string, string>, requestingUserId: string): ProjectDto {
  const myMember = row.memberships.find((m) => m.user.id === requestingUserId) ?? null;
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    goal: row.goal,
    location: row.location,
    department: row.department,
    line: row.line,
    station: row.station,
    product: row.product,
    process: row.process,
    responsible: row.responsible,
    shift: row.shift,
    notes: row.notes,
    status: row.status as ProjectDto["status"],
    isDemo: row.isDemo,
    readiness: computeReadiness({
      hasConfigVersion: row.currentConfigVersion !== null,
      activityCount: 0, // فاز ۲ — جدول فعالیت‌ها هنوز وجود ندارد
      observationCount: 0, // فاز ۴
      standardTimeResultCount: 0, // فاز ۵
    }),
    profile: {
      templateId: row.profileTemplateId,
      templateNameFa: row.profileTemplateId ? templateNames.get(row.profileTemplateId) ?? null : null,
      templateVersion: row.profileTemplateVersion,
      snapshotId: row.profileSnapshotId,
    },
    currentConfigVersion: row.currentConfigVersion
      ? { id: row.currentConfigVersion.id, semver: row.currentConfigVersion.semver }
      : null,
    configVersionCount: row._count?.configVersions ?? 0,
    memberCount: row.memberships.length,
    myRole: (myMember?.role as ProjectRole) ?? null,
    createdByName: row.createdBy?.name ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function decorateDtos(rows: ProjectRow[], userId: string): Promise<ProjectDto[]> {
  const templateIds = [...new Set(rows.map((r) => r.profileTemplateId).filter((v): v is string => !!v))];
  const templateNames = await getProfileTemplateNames(templateIds);
  return rows.map((r) => toProjectDto(r, templateNames, userId));
}

// ─────────────────────────── فهرست/جزئیات ───────────────────────────

export async function listProjects(
  userId: string,
  query: ProjectListQuery,
): Promise<ProjectListDto> {
  const memberships = await findMembershipsOfUser(userId);
  if (memberships.length === 0) return { items: [], total: 0 };
  const where = buildListWhere({
    projectIds: memberships.map((m) => m.projectId),
    status: query.status,
    demo: query.demo,
    q: query.q,
  });
  const rows = await listProjectsWhere(where);
  const items = await decorateDtos(rows, userId);
  return { items, total: items.length };
}

export async function getProject(projectId: string, userId: string): Promise<ProjectDto> {
  await authorize(projectId, userId, "project:read");
  const row = await findProjectById(projectId);
  if (!row) throw ApiError.notFound();
  const items = await decorateDtos([row], userId);
  return items[0];
}

// ─────────────────────────── ایجاد ───────────────────────────

export async function createProject(
  userId: string,
  input: ProjectCreateInput,
): Promise<ProjectDto> {
  const template = await getProfileTemplateById(input.profileTemplateId);
  if (!template || !template.isActive) {
    throw ApiError.badRequest("پروفایل روش‌شناختی انتخاب‌شده یافت نشد.");
  }
  const components: ProfileComponentsInput = input.profileComponents ?? {
    excludedFamilies: [],
    parameterOverrides: [],
  };
  // snapshot مستقل — کپی لحظه ایجاد (ADR-005؛ تغییر الگوی عمومی اثر گذشته ندارد)
  const snapshot = instantiateProfileSnapshot(template, components);

  const projectId = uuidv7();
  const configVersionId = uuidv7();

  await db.$transaction(async (tx) => {
    await insertProject(tx, {
      id: projectId,
      code: input.code,
      title: input.title,
      goal: input.goal || null,
      location: input.location || null,
      department: input.department || null,
      line: input.line || null,
      station: input.station || null,
      product: input.product || null,
      process: input.process || null,
      responsible: input.responsible || null,
      shift: input.shift || null,
      notes: input.notes || null,
      status: "active",
      isDemo: input.isDemo ?? false,
      profileTemplateId: template.id,
      profileTemplateVersion: template.semver,
      profileSnapshotId: configVersionId,
      createdById: userId,
    });
    await insertMembership(tx, {
      id: uuidv7(),
      projectId,
      userId,
      role: "owner",
    });
    await insertConfigVersion(tx, {
      id: configVersionId,
      projectId,
      semver: INITIAL_CONFIG_SEMVER,
      snapshotJson: JSON.stringify(snapshot),
      reason: `ایجاد پروژه از پروفایل «${template.nameFa}» نسخه ${template.semver}`,
      profileTemplateId: template.id,
      profileTemplateVersion: template.semver,
      createdBy: userId,
    });
    await updateProjectById(tx, projectId, { currentConfigVersionId: configVersionId });
  });

  log.info("project created", { projectId, userId, templateId: template.id });
  await recordAudit({
    userId,
    action: AUDIT_ACTIONS.projectCreated,
    entityType: "Project",
    entityId: projectId,
    projectId,
    after: { code: input.code, title: input.title, isDemo: input.isDemo ?? false },
  });
  await recordAudit({
    userId,
    action: AUDIT_ACTIONS.configVersionCreated,
    entityType: "ConfigVersion",
    entityId: configVersionId,
    projectId,
    after: { semver: INITIAL_CONFIG_SEMVER, reason: `از پروفایل ${template.nameFa}` },
  });

  return getProject(projectId, userId);
}

// ─────────────────────────── ویرایش ───────────────────────────

const UPDATABLE_FIELDS = [
  "title",
  "code",
  "goal",
  "location",
  "department",
  "line",
  "station",
  "product",
  "process",
  "responsible",
  "shift",
  "notes",
] as const;

export async function updateProject(
  projectId: string,
  userId: string,
  input: ProjectUpdateInput,
): Promise<ProjectDto> {
  await authorize(projectId, userId, "project:update");
  const row = await findProjectById(projectId);
  if (!row) throw ApiError.notFound();

  const data: Record<string, string | null> = {};
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  for (const field of UPDATABLE_FIELDS) {
    const incoming = input[field];
    if (incoming === undefined) continue;
    const normalized = incoming === "" ? null : incoming;
    if ((row[field] ?? null) === normalized) continue; // بدون تغییر → بدون نسخه/ممیزی اضافی
    before[field] = row[field];
    after[field] = normalized;
    data[field] = normalized;
  }
  if (Object.keys(data).length > 0) {
    await updateProjectById(db, projectId, data);
    await recordAudit({
      userId,
      action: AUDIT_ACTIONS.projectUpdated,
      entityType: "Project",
      entityId: projectId,
      projectId,
      before,
      after,
    });
    log.info("project updated", { projectId, userId, fields: Object.keys(data) });
  }
  return getProject(projectId, userId);
}

// ─────────────────────────── بایگانی ───────────────────────────

export async function setProjectArchived(
  projectId: string,
  userId: string,
  archived: boolean,
): Promise<ProjectDto> {
  await authorize(projectId, userId, "project:archive");
  const row = await findProjectById(projectId);
  if (!row) throw ApiError.notFound();
  if ((row.status === "archived") === archived) {
    return getProject(projectId, userId); // بدون تغییر
  }
  const nextStatus = archived ? "archived" : "active";
  await updateProjectById(db, projectId, { status: nextStatus });
  await recordAudit({
    userId,
    action: archived ? AUDIT_ACTIONS.projectArchived : AUDIT_ACTIONS.projectUnarchived,
    entityType: "Project",
    entityId: projectId,
    projectId,
    before: { status: row.status },
    after: { status: nextStatus },
  });
  log.info("project archive toggled", { projectId, userId, archived });
  return getProject(projectId, userId);
}

// ─────────────────────────── تکثیر ───────────────────────────

/**
 * تکثیر پروژه (B1): ساختار + پیکربندی مستقل کپی می‌شود؛ داده خام منتقل نمی‌شود
 * (در فاز ۱ داده خامی وجود ندارد؛ مشاهدات در فاز ۴ فقط با انتخاب صریح قابل انتقال خواهند بود).
 */
export async function duplicateProject(projectId: string, userId: string): Promise<ProjectDto> {
  await authorize(projectId, userId, "project:duplicate");
  const source = await findProjectById(projectId);
  if (!source) throw ApiError.notFound();

  // کد یکتا برای نسخه جدید
  let candidateCode = `${source.code}-کپی`;
  let attempt = 1;
  while ((await countProjectsWithCode(candidateCode)) > 0 && attempt < 50) {
    attempt += 1;
    candidateCode = `${source.code}-کپی-${attempt}`;
  }

  const sourceSnapshot = source.currentConfigVersion
    ? await listConfigVersionsOfProject(projectId).then(
        (vs) => vs.find((v) => v.id === source.currentConfigVersion?.id)?.snapshotJson ?? null,
      )
    : null;

  const newProjectId = uuidv7();
  const newConfigVersionId = uuidv7();

  await db.$transaction(async (tx) => {
    await insertProject(tx, {
      id: newProjectId,
      code: candidateCode,
      title: `${source.title} (کپی)`,
      goal: source.goal,
      location: source.location,
      department: source.department,
      line: source.line,
      station: source.station,
      product: source.product,
      process: source.process,
      responsible: source.responsible,
      shift: source.shift,
      notes: source.notes,
      status: "active",
      isDemo: false, // تکثیر همیشه پروژه واقعی است — تصمیم مستند فاز ۱
      profileTemplateId: source.profileTemplateId,
      profileTemplateVersion: source.profileTemplateVersion,
      profileSnapshotId: newConfigVersionId,
      createdById: userId,
    });
    await insertMembership(tx, {
      id: uuidv7(),
      projectId: newProjectId,
      userId,
      role: "owner",
    });
    if (sourceSnapshot) {
      await insertConfigVersion(tx, {
        id: newConfigVersionId,
        projectId: newProjectId,
        semver: INITIAL_CONFIG_SEMVER,
        snapshotJson: sourceSnapshot, // snapshot کپی مستقل — ردیابی منشأ در reason
        reason: `تکثیر از پروژه «${source.title}» (${source.code}) — پیکربندی نسخه ${source.currentConfigVersion?.semver}`,
        profileTemplateId: source.profileTemplateId,
        profileTemplateVersion: source.profileTemplateVersion,
        createdBy: userId,
      });
      await updateProjectById(tx, newProjectId, { currentConfigVersionId: newConfigVersionId });
    }
  });

  await recordAudit({
    userId,
    action: AUDIT_ACTIONS.projectDuplicated,
    entityType: "Project",
    entityId: newProjectId,
    projectId: newProjectId,
    before: { sourceProjectId: projectId, sourceCode: source.code },
    after: { code: candidateCode },
  });
  // ردپوی روی پروژه مبدأ نیز ثبت می‌شود (قاعده A5: تغییرات بین-پروژه‌ای قابل ردیابی)
  await recordAudit({
    userId,
    action: AUDIT_ACTIONS.projectDuplicated,
    entityType: "Project",
    entityId: projectId,
    projectId,
    before: null,
    after: { duplicatedToProjectId: newProjectId, duplicatedToCode: candidateCode },
  });
  log.info("project duplicated", { sourceId: projectId, newProjectId, userId });
  return getProject(newProjectId, userId);
}

// ─────────────────────────── نسخه‌های پیکربندی ───────────────────────────

export async function listConfigVersions(
  projectId: string,
  userId: string,
): Promise<ConfigVersionDto[]> {
  await authorize(projectId, userId, "config:read");
  const versions = await listConfigVersionsOfProject(projectId);
  const row = await findProjectById(projectId);
  return versions.map((v) => ({
    id: v.id,
    semver: v.semver,
    reason: v.reason,
    profileTemplateId: v.profileTemplateId,
    profileTemplateVersion: v.profileTemplateVersion,
    isCurrent: row?.currentConfigVersionId === v.id,
    createdByName: v.author?.name ?? null,
    createdAt: v.createdAt.toISOString(),
    snapshot: JSON.parse(v.snapshotJson),
  }));
}

// ─────────────────────────── اعضا ───────────────────────────

export async function listMembers(projectId: string, userId: string): Promise<MemberDto[]> {
  await authorize(projectId, userId, "project:read");
  const row = await findProjectById(projectId);
  if (!row) throw ApiError.notFound();
  return row.memberships
    .map((m) => ({
      id: m.id,
      userId: m.user.id,
      email: m.user.email,
      name: m.user.name,
      role: m.role as ProjectRole,
      createdAt: m.createdAt.toISOString(),
    }))
    .sort((a, b) => (a.role === "owner" ? -1 : b.role === "owner" ? 1 : a.createdAt.localeCompare(b.createdAt)));
}

export async function addMember(
  projectId: string,
  ownerUserId: string,
  input: { email: string; role: string },
): Promise<MemberDto> {
  await authorize(projectId, ownerUserId, "project:manage-members");
  const target = await getUserByEmail(input.email);
  if (!target) throw ApiError.notFound("کاربری با این رایانامه یافت نشد.");
  const existing = await findMembership(projectId, target.id);
  if (existing) {
    throw ApiError.conflict("این کاربر قبلاً عضو پروژه است.", { role: existing.role });
  }
  const membershipId = uuidv7();
  await db.projectMembership.create({
    data: { id: membershipId, projectId, userId: target.id, role: input.role },
  });
  await recordAudit({
    userId: ownerUserId,
    action: AUDIT_ACTIONS.memberAdded,
    entityType: "ProjectMembership",
    entityId: membershipId,
    projectId,
    after: { email: target.email, role: input.role },
  });
  log.info("member added", { projectId, targetUserId: target.id, role: input.role });
  return {
    id: membershipId,
    userId: target.id,
    email: target.email,
    name: target.name,
    role: input.role as ProjectRole,
    createdAt: new Date().toISOString(),
  };
}

export async function updateMemberRole(
  projectId: string,
  ownerUserId: string,
  memberId: string,
  role: string,
): Promise<void> {
  await authorize(projectId, ownerUserId, "project:manage-members");
  const membership = await db.projectMembership.findUnique({ where: { id: memberId } });
  if (!membership || membership.projectId !== projectId) throw ApiError.notFound();
  if (membership.role === "owner") {
    throw ApiError.forbidden("نقش مالک قابل تغییر نیست (انتقال مالکیت در فازهای بعد).");
  }
  const before = { role: membership.role };
  await db.projectMembership.update({ where: { id: memberId }, data: { role } });
  await recordAudit({
    userId: ownerUserId,
    action: AUDIT_ACTIONS.memberRoleChanged,
    entityType: "ProjectMembership",
    entityId: memberId,
    projectId,
    before,
    after: { role },
  });
}

export async function removeMember(
  projectId: string,
  ownerUserId: string,
  memberId: string,
): Promise<void> {
  await authorize(projectId, ownerUserId, "project:manage-members");
  const membership = await db.projectMembership.findUnique({ where: { id: memberId } });
  if (!membership || membership.projectId !== projectId) throw ApiError.notFound();
  if (membership.role === "owner") {
    throw ApiError.forbidden("مالک پروژه قابل حذف از اعضا نیست.");
  }
  await db.projectMembership.delete({ where: { id: memberId } });
  await recordAudit({
    userId: ownerUserId,
    action: AUDIT_ACTIONS.memberRemoved,
    entityType: "ProjectMembership",
    entityId: memberId,
    projectId,
    before: { role: membership.role },
  });
}

// ─────────────────────────── ممیزی ───────────────────────────

export async function getAuditTrail(projectId: string, userId: string) {
  await authorize(projectId, userId, "audit:read");
  return getProjectAuditTrail(projectId);
}

export { PROJECT_STATUS_LABELS_FA };
