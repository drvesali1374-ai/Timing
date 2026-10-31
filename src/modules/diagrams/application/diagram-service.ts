/**
 * لایه Application ماژول نمودارها — عملیات فاز ۳ (ایجاد/ذخیره نسخه/تأیید/بایگانی/اعتبارسنجی/تاریخچه/مقایسه).
 * نمودار داده پروژه است (نه پیکربندی)؛ هر ذخیره revision جدید append-only می‌سازد.
 * ویرایشگر هرگز وضعیت «تأییدشده» را بی‌اجازه بازنویسی نمی‌کند — ذخیره روی confirmed
 * فقط با ذخیره revision جدید + برگشت به draft همراه است (قید ۵ ENGINE_CONTRACTS).
 */

import { z } from "zod";
import { uuidv7 } from "@/shared/ids";
import { ApiError } from "@/shared/errors";
import { getLogger } from "@/shared/logger";
import { AUDIT_ACTIONS, recordAudit } from "@/modules/audit/application/audit-service";
import { listActivities } from "@/modules/activities/application/activity-service";
import { validateDiagram, type DiagramValidationReport } from "@/shared/diagrams/validation";
import { diffVariants, type VariantDiff } from "@/shared/diagrams/diff";
import type { DiagramDoc } from "@/shared/diagrams/types";
import {
  assertDiagramDoc,
  DIAGRAM_STATUS_LABELS_FA,
  isDiagramStatus,
  type CreateMetaInput,
  type DiagramDetailDto,
  type DiagramRevisionDto,
  type DiagramSummaryDto,
  type SaveRevisionInput,
} from "../domain/diagram";
import {
  countDiagrams,
  findDiagramById,
  findRevisionByClientOpId,
  findRevisionByNo,
  insertDiagramRow,
  insertRevisionRow,
  latestRevision,
  listDiagramRows,
  listRevisionRows,
  updateDiagramRow,
  type DiagramRow,
} from "../infrastructure/diagram-repo";

const log = getLogger("diagrams");

// ─────────────────────── تبدیل DTO ───────────────────────

function toSummaryDto(row: DiagramRow): DiagramSummaryDto {
  return {
    id: row.id,
    kind: row.kind as DiagramSummaryDto["kind"],
    variant: row.variant as DiagramSummaryDto["variant"],
    title: row.title,
    description: row.description,
    subject: (row.subject as DiagramSummaryDto["subject"]) ?? null,
    distanceUnit: row.distanceUnit,
    status: row.status as DiagramSummaryDto["status"],
    currentRev: row.currentRev,
    variantOfId: row.variantOfId,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function parseDoc(row: { docJson: string }): DiagramDoc {
  try {
    return JSON.parse(row.docJson) as DiagramDoc;
  } catch {
    throw ApiError.internal("سند ذخیره‌شده نمودار قابل خواندن نیست.");
  }
}

function parseLayout(row: { layoutJson: string }): { positions: Record<string, { x: number; y: number }> } {
  try {
    return JSON.parse(row.layoutJson) as { positions: Record<string, { x: number; y: number }> };
  } catch {
    return { positions: {} };
  }
}

async function knownActivityKeys(projectId: string): Promise<string[]> {
  const rows = await listActivities(projectId, true);
  return rows.map((r) => r.stableKey);
}

async function runValidation(projectId: string, doc: DiagramDoc): Promise<DiagramValidationReport> {
  return validateDiagram(doc, { knownActivityKeys: await knownActivityKeys(projectId) });
}

// ─────────────────────── فهرست/جزئیات ───────────────────────

export async function listDiagrams(projectId: string, includeArchived = false): Promise<DiagramSummaryDto[]> {
  const rows = await listDiagramRows(projectId, includeArchived);
  return rows.map(toSummaryDto);
}

export async function getDiagramDetail(projectId: string, diagramId: string): Promise<DiagramDetailDto> {
  const row = await findDiagramById(projectId, diagramId);
  if (!row) throw ApiError.notFound("نمودار یافت نشد.");
  const rev = await latestRevision(diagramId);
  if (!rev) {
    // نمودار بدون revision (باید ناممکن باشد — ایجاد همیشه revision اول را می‌سازد)
    const doc = parseDoc({ docJson: "{}" });
    return {
      ...toSummaryDto(row),
      doc,
      layout: { positions: {} },
      validation: { valid: false, errorCount: 1, warningCount: 0, summary: { counts: {}, totalTimeSec: 0, totalDistanceM: 0, nodeCount: 0, edgeCount: 0 } },
    };
  }
  const doc = parseDoc(rev);
  const report = await runValidation(projectId, doc);
  return {
    ...toSummaryDto(row),
    doc,
    layout: parseLayout(rev),
    validation: {
      valid: report.valid,
      errorCount: report.errors.length,
      warningCount: report.warnings.length,
      summary: report.summary,
    },
  };
}

// ─────────────────────── ایجاد ───────────────────────

export async function createDiagram(projectId: string, userId: string, input: CreateMetaInput): Promise<DiagramDetailDto> {
  if (input.kind === "fpc" && input.variant === "current" && !input.subject && input.doc?.subject) {
    input = { ...input, subject: input.doc.subject };
  }
  // اعتبارسنجی variantOfId
  if (input.variantOfId) {
    const base = await findDiagramById(projectId, input.variantOfId);
    if (!base) throw ApiError.badRequest("نمودار مرجع (روش موجود) برای این نسخه پیشنهادی یافت نشد.");
    if (base.variant !== "current") throw ApiError.badRequest("نسخه پیشنهادی باید به نمودار «روش موجود» ارجاع دهد.");
    if (base.kind !== input.kind) throw ApiError.badRequest("نوع نمودار پیشنهادی باید با نمودار مرجع یکی باشد.");
  }
  if (input.kind === "opc" && input.subject) {
    throw ApiError.badRequest("نمودار OPC موضوع مطالعه ندارد (مخصوص FPC است).");
  }

  // سند اولیه (اگر آمده) اعتبارسنجی معنایی شود
  let doc: DiagramDoc | null = null;
  if (input.doc !== undefined) {
    doc = assertDiagramDoc(input.doc);
    if (doc.kind !== input.kind) throw ApiError.badRequest("نوع سند با نوع درخواست یکی نیست.");
  }
  if (input.kind === "fpc" && input.variant === "current" && !input.subject && (!doc || !doc.subject)) {
    throw ApiError.badRequest("نمودار FPC باید موضوع مطالعه داشته باشد (ماده/فرد/تجهیزات).");
  }

  const id = uuidv7();
  const subject = input.kind === "fpc" ? (input.subject ?? doc?.subject ?? null) : null;
  const distanceUnit = input.kind === "fpc" ? (input.distanceUnit ?? doc?.distanceUnit ?? "m") : null;

  await insertDiagramRow({
    id,
    projectId,
    kind: input.kind,
    variant: input.variant,
    variantOfId: input.variantOfId ?? null,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    subject,
    distanceUnit,
    status: "draft",
    currentRev: 0,
    createdBy: userId,
  });

  // revision اول: سند اولیه یا سند خالی
  const initialDoc: DiagramDoc =
    doc ??
    ({
      kind: input.kind,
      variant: input.variant,
      ...(input.kind === "fpc" ? { subject, distanceUnit: distanceUnit ?? "m" } : {}),
      nodes: [],
      edges: [],
    } as DiagramDoc);
  const report = await runValidation(projectId, initialDoc);
  const layout = input.layout ?? { positions: {} };

  await insertRevisionRow({
    id: uuidv7(),
    diagramId: id,
    revNo: 1,
    reason: "ایجاد نمودار",
    docJson: JSON.stringify(initialDoc),
    layoutJson: JSON.stringify(layout),
    validationJson: JSON.stringify({ valid: report.valid, errors: report.errors, warnings: report.warnings, summary: report.summary }),
    appliedSuggestionsJson: null,
    origin: "normal",
    clientOpId: null,
    createdBy: userId,
  });
  await updateDiagramRow(projectId, id, { currentRev: 1 });

  await recordAudit({
    userId,
    action: AUDIT_ACTIONS.diagramCreated,
    entityType: "Diagram",
    entityId: id,
    projectId,
    after: { title: input.title, kind: input.kind, variant: input.variant },
  });
  log.info("diagram created", { projectId, diagramId: id, kind: input.kind });
  return getDiagramDetail(projectId, id);
}

// ─────────────────────── ذخیره نسخه جدید (append-only) ───────────────────────

export interface SaveRevisionResult {
  diagram: DiagramDetailDto;
  revision: DiagramRevisionDto;
  /** true اگر این clientOpId قبلاً ذخیره شده بود (idempotent) */
  duplicate: boolean;
}

export async function saveRevision(
  projectId: string,
  userId: string,
  diagramId: string,
  input: SaveRevisionInput,
): Promise<SaveRevisionResult> {
  const row = await findDiagramById(projectId, diagramId);
  if (!row) throw ApiError.notFound("نمودار یافت نشد.");
  if (row.status === "archived") throw ApiError.badRequest("نمودار بایگانی‌شده قابل ویرایش نیست.");

  const doc = assertDiagramDoc(input.doc);
  if (doc.kind !== row.kind) throw ApiError.badRequest("نوع سند نمی‌تواند تغییر کند.");
  if (doc.variant !== row.variant) throw ApiError.badRequest("variant سند با نمودار نمی‌خواند.");

  // idempotency آفلاین: اگر clientOpId قبلاً ذخیره شده، همان نتیجه برگردد (بدون دوباره‌شماری)
  if (input.clientOpId) {
    const existing = await findRevisionByClientOpId(projectId, input.clientOpId);
    if (existing && existing.diagramId === diagramId) {
      const detail = await getDiagramDetail(projectId, diagramId);
      return { diagram: detail, revision: revisionToDto(existing, null), duplicate: true };
    }
  }

  // قید ۵: ذخیره روی confirmed → status به draft برمی‌گردد (بازنویسی بی‌اجازه ممنوع)
  const statusChange = row.status === "confirmed" ? { status: "draft" as const } : {};

  const report = await runValidation(projectId, doc);
  const revNo = row.currentRev + 1;

  await insertRevisionRow({
    id: uuidv7(),
    diagramId,
    revNo,
    reason: input.reason?.trim() || null,
    docJson: JSON.stringify(doc),
    layoutJson: JSON.stringify(input.layout),
    validationJson: JSON.stringify({ valid: report.valid, errors: report.errors, warnings: report.warnings, summary: report.summary }),
    appliedSuggestionsJson:
      input.appliedSuggestions && input.appliedSuggestions.length > 0 ? JSON.stringify(input.appliedSuggestions) : null,
    origin: input.origin,
    clientOpId: input.clientOpId ?? null,
    createdBy: userId,
  });
  await updateDiagramRow(projectId, diagramId, { currentRev: revNo, ...statusChange });

  await recordAudit({
    userId,
    action: AUDIT_ACTIONS.diagramRevisionSaved,
    entityType: "Diagram",
    entityId: diagramId,
    projectId,
    after: { revNo, origin: input.origin, nodeCount: doc.nodes.length, edgeCount: doc.edges.length },
  });
  log.info("diagram revision saved", { projectId, diagramId, revNo, origin: input.origin });

  const detail = await getDiagramDetail(projectId, diagramId);
  const rev = await findRevisionByNo(diagramId, revNo);
  return { diagram: detail, revision: revisionToDto(rev!, null), duplicate: false };
}

function revisionToDto(rev: { id: string; revNo: number; reason: string | null; origin: string; clientOpId: string | null; appliedSuggestionsJson: string | null; createdAt: Date }, createdByName: string | null): DiagramRevisionDto {
  let applied: Array<{ id: string; version: string; title: string }> = [];
  if (rev.appliedSuggestionsJson) {
    try {
      const parsed = JSON.parse(rev.appliedSuggestionsJson);
      if (Array.isArray(parsed)) applied = parsed;
    } catch {
      applied = [];
    }
  }
  return {
    id: rev.id,
    revNo: rev.revNo,
    reason: rev.reason,
    origin: rev.origin,
    clientOpId: rev.clientOpId,
    appliedSuggestions: applied,
    createdByName,
    createdAt: rev.createdAt.toISOString(),
  };
}

// ─────────────────────── اعتبارسنجی مستقل ───────────────────────

export async function validateDiagramNow(projectId: string, diagramId: string): Promise<DiagramValidationReport & { revision: number }> {
  const row = await findDiagramById(projectId, diagramId);
  if (!row) throw ApiError.notFound("نمودار یافت نشد.");
  const rev = await latestRevision(diagramId);
  if (!rev) throw ApiError.internal("نمودار بدون نسخه است.");
  const doc = parseDoc(rev);
  const report = await runValidation(projectId, doc);
  return { ...report, revision: rev.revNo };
}

/** اعتبارسنجی سند ارسالی بدون ذخیره (پیش‌نمایش) */
export async function validateDoc(projectId: string, doc: unknown): Promise<DiagramValidationReport> {
  const parsed = assertDiagramDoc(doc);
  return runValidation(projectId, parsed);
}

// ─────────────────────── تأیید/بایگانی/ویرایش عنوان ───────────────────────

const patchMetaSchema = z.object({
  title: z.string().min(1).max(160).optional(),
  description: z.string().max(2000).nullable().optional(),
  status: z.enum(["draft", "confirmed", "archived"]).optional(),
});

export async function patchDiagram(
  projectId: string,
  userId: string,
  diagramId: string,
  input: z.infer<typeof patchMetaSchema>,
): Promise<DiagramSummaryDto> {
  const row = await findDiagramById(projectId, diagramId);
  if (!row) throw ApiError.notFound("نمودار یافت نشد.");
  const data: Record<string, string | null> = {};
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};

  if (input.title !== undefined && input.title.trim() !== row.title) {
    before.title = row.title;
    after.title = input.title.trim();
    data.title = input.title.trim();
  }
  if (input.description !== undefined) {
    const normalized = input.description?.trim() || null;
    if (normalized !== row.description) {
      before.description = row.description;
      after.description = normalized;
      data.description = normalized;
    }
  }
  if (input.status !== undefined) {
    if (!isDiagramStatus(input.status)) throw ApiError.badRequest("وضعیت نمودار نامعتبر است.");
    if (input.status === "confirmed") {
      // تأیید فقط روی سند بدون خطا مجاز است
      const report = await validateDiagramNow(projectId, diagramId);
      if (!report.valid) {
        throw ApiError.badRequest(`نمودار با خطای اعتبارسنجی قابل تأیید نیست (${report.errors.length} خطا) — ابتدا خطاها را برطرف کنید.`);
      }
    }
    if (input.status !== row.status) {
      before.status = row.status;
      after.status = input.status;
      data.status = input.status;
    }
  }

  if (Object.keys(data).length > 0) {
    await updateDiagramRow(projectId, diagramId, data);
    const action =
      input.status === "confirmed"
        ? AUDIT_ACTIONS.diagramConfirmed
        : input.status === "archived"
          ? AUDIT_ACTIONS.diagramArchived
          : AUDIT_ACTIONS.diagramUpdated;
    await recordAudit({ userId, action, entityType: "Diagram", entityId: diagramId, projectId, before, after });
    log.info("diagram patched", { projectId, diagramId, fields: Object.keys(data) });
  }
  const updated = await findDiagramById(projectId, diagramId);
  if (!updated) throw ApiError.internal();
  return toSummaryDto(updated);
}

// ─────────────────────── تاریخچه نسخه‌ها ───────────────────────

export async function listDiagramRevisions(projectId: string, diagramId: string): Promise<DiagramRevisionDto[]> {
  const row = await findDiagramById(projectId, diagramId);
  if (!row) throw ApiError.notFound("نمودار یافت نشد.");
  const revs = await listRevisionRows(diagramId);
  return revs.map((r) => revisionToDto(r, null));
}

/** بازیابی نسخه قبلی = revision جدید با محتوای نسخه هدف (append-only حفظ می‌شود) */
export async function restoreRevision(
  projectId: string,
  userId: string,
  diagramId: string,
  revNo: number,
): Promise<SaveRevisionResult> {
  const row = await findDiagramById(projectId, diagramId);
  if (!row) throw ApiError.notFound("نمودار یافت نشد.");
  if (row.status === "archived") throw ApiError.badRequest("نمودار بایگانی‌شده قابل ویرایش نیست.");
  const target = await findRevisionByNo(diagramId, revNo);
  if (!target) throw ApiError.notFound("نسخه موردنظر یافت نشد.");
  if (target.revNo === row.currentRev) throw ApiError.badRequest("این نسخه همان نسخه جاری است.");

  const doc = parseDoc(target);
  const layout = parseLayout(target);
  return saveRevision(projectId, userId, diagramId, {
    doc,
    layout,
    reason: `بازیابی نسخه ${revNo}`,
    origin: "normal",
  });
}

// ─────────────────────── مقایسه variant ───────────────────────

export interface VariantCompareDto {
  current: DiagramSummaryDto;
  proposed: DiagramSummaryDto;
  diff: VariantDiff;
}

export async function compareVariants(projectId: string, diagramId: string): Promise<VariantCompareDto> {
  const proposedRow = await findDiagramById(projectId, diagramId);
  if (!proposedRow) throw ApiError.notFound("نمودار یافت نشد.");
  if (proposedRow.variant !== "proposed") throw ApiError.badRequest("مقایسه فقط برای نمودار «روش پیشنهادی» معتبر است.");
  if (!proposedRow.variantOfId) throw ApiError.badRequest("نمودار پیشنهادی نمودار مرجع ندارد.");
  const currentRow = await findDiagramById(projectId, proposedRow.variantOfId);
  if (!currentRow) throw ApiError.notFound("نمودار مرجع (روش موجود) یافت نشد.");

  const currentRev = await latestRevision(currentRow.id);
  const proposedRev = await latestRevision(proposedRow.id);
  if (!currentRev || !proposedRev) throw ApiError.internal("نمودار بدون نسخه است.");

  const currentDoc = parseDoc(currentRev);
  const proposedDoc = parseDoc(proposedRev);
  const diff = diffVariants(currentDoc, proposedDoc);
  return {
    current: toSummaryDto(currentRow),
    proposed: toSummaryDto(proposedRow),
    diff,
  };
}

/** آمار readiness — تعداد نمودارهای فعال پروژه */
export async function activeDiagramCount(projectId: string): Promise<number> {
  return countDiagrams(projectId);
}

export { createMetaSchema, saveRevisionSchema } from "../domain/diagram";

export { DIAGRAM_STATUS_LABELS_FA };
