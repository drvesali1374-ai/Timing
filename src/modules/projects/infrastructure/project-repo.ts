/**
 * زیرساخت ماژول پروژه‌ها — تمام کوئری‌های Prisma با فیلتر اجباری projectId.
 * قاعده جداسازی (A5): هیچ کوئری دامنه‌ای بدون_membership+projectId اجرا نمی‌شود؛
 * این لایه فقط توسط Application فراخوانی می‌شود که پیش‌تر مجوز را بررسی کرده است.
 */
import { Prisma, PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";
import { PROJECT_SEARCH_FIELDS } from "../domain/project";

export type DbClient = Prisma.TransactionClient | PrismaClient;

export type ProjectRow = Prisma.ProjectGetPayload<{
  include: {
    memberships: { include: { user: { select: { id: true; email: true; name: true } } } };
    currentConfigVersion: { select: { id: true; semver: true } };
    createdBy: { select: { name: true } };
    _count: { select: { configVersions: true, activities: { where: { archived: false } } } };
  };
}>;

const LIST_INCLUDE = {
  memberships: { include: { user: { select: { id: true, email: true, name: true } } } },
  currentConfigVersion: { select: { id: true, semver: true } },
  createdBy: { select: { name: true } },
  _count: { select: { configVersions: true, activities: { where: { archived: false } } } },
} satisfies Prisma.ProjectInclude;

export async function findMembershipsOfUser(userId: string) {
  return db.projectMembership.findMany({
    where: { userId },
    select: { projectId: true, role: true },
  });
}

export async function findMembership(projectId: string, userId: string) {
  return db.projectMembership.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
}

export async function findProjectById(projectId: string): Promise<ProjectRow | null> {
  return db.project.findUnique({ where: { id: projectId }, include: LIST_INCLUDE });
}

export async function listProjectsWhere(
  where: Prisma.ProjectWhereInput,
): Promise<ProjectRow[]> {
  return db.project.findMany({ where, orderBy: { updatedAt: "desc" }, include: LIST_INCLUDE });
}

export function buildListWhere(input: {
  projectIds: string[];
  status: "all" | "active" | "archived" | "completed";
  demo: "include" | "exclude" | "only";
  q?: string;
}): Prisma.ProjectWhereInput {
  const where: Prisma.ProjectWhereInput = { id: { in: input.projectIds } };
  if (input.status !== "all") where.status = input.status;
  if (input.demo === "only") where.isDemo = true;
  else if (input.demo === "exclude") where.isDemo = false;
  if (input.q && input.q.trim().length > 0) {
    const q = input.q.trim();
    where.OR = PROJECT_SEARCH_FIELDS.map((field) => ({
      [field]: { contains: q },
    })) as Prisma.ProjectWhereInput["OR"];
  }
  return where;
}

export async function insertProject(
  tx: DbClient,
  data: Prisma.ProjectUncheckedCreateInput,
): Promise<string> {
  const p = await tx.project.create({ data, select: { id: true } });
  return p.id;
}

export async function insertMembership(
  tx: DbClient,
  data: Prisma.ProjectMembershipUncheckedCreateInput,
) {
  return tx.projectMembership.create({ data });
}

export async function insertConfigVersion(
  tx: DbClient,
  data: Prisma.ConfigVersionUncheckedCreateInput,
): Promise<string> {
  const v = await tx.configVersion.create({ data, select: { id: true } });
  return v.id;
}

export async function updateProjectById(
  tx: DbClient,
  projectId: string,
  data: Prisma.ProjectUncheckedUpdateInput,
) {
  return tx.project.update({ where: { id: projectId }, data, select: { id: true } });
}

export async function countProjectsWhere(where: Prisma.ProjectWhereInput): Promise<number> {
  return db.project.count({ where });
}

export async function listConfigVersionsOfProject(projectId: string) {
  return db.configVersion.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    include: { author: { select: { name: true } } },
  });
}

export async function findConfigVersionById(versionId: string) {
  return db.configVersion.findUnique({ where: { id: versionId } });
}

/** شمارش پروژه‌هایی با کد مشخص — برای تولید کد یکتا هنگام تکثیر */
export async function countProjectsWithCode(code: string): Promise<number> {
  return db.project.count({ where: { code } });
}
