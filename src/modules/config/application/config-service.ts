/**
 * لایه Application ماژول پیکربندی — کارگاه فاز ۲:
 *  - خواندن snapshot جاری (با ارتقای v1→v2 در حافظه — ADR-011)
 *  - اعمال دسته عملیات → ConfigVersion جدید append-only + ممیزی
 *  - اعتبارسنجی/آزمون عبارت فرمول
 *  - import/export با اعتبارسنجی پیش از اعمال (بند ۹ فاز ۲)
 *
 * مجوزسنجی: سرویس رابط مجوز پروژه را می‌گیرد (authorize در route با acl.ts انجام
 * می‌شود — این ماژول خودش فرض می‌کند مسیر دسترسی بررسی شده است؛ دفاع عمیق با
 * projectId در همه کوئری‌ها).
 */

import { db } from "@/lib/db";
import { uuidv7 } from "@/shared/ids";
import { ApiError } from "@/shared/errors";
import { getLogger } from "@/shared/logger";
import { parse } from "@/shared/formula/engine";
import { evaluate as engineEvaluate } from "@/shared/formula/engine";
import type { EvalInput } from "@/shared/formula/evaluator";
import { deserializeAst } from "@/shared/formula/ast";
import { AUDIT_ACTIONS, recordAudit } from "@/modules/audit/application/audit-service";
import { readSnapshotAsV2, type ProjectConfigSnapshot } from "../domain/snapshot";
import { applyOperations, checkFormulaCycles, validateFormulaExpr, validateFormulaExprWithSymbols, type ConfigOperation } from "../domain/operations";
import { assertSnapshotValid, buildSymbolTable, validateSnapshot } from "../domain/validation";
import type { SymbolTable } from "@/shared/formula/static-analysis";
import {
  findCurrentVersion,
  insertConfigVersionRow,
  latestVersionNumbers,
  setCurrentVersion,
} from "../infrastructure/config-repo";

const log = getLogger("config");

// ── خواندن ──────────────────────────────────────────────────

export interface CurrentConfigDto {
  projectId: string;
  versionId: string | null;
  semver: string | null;
  snapshot: ProjectConfigSnapshot;
  /** شمار نسخه‌های ثبت‌شده (append-only) */
  versionCount: number;
  formulaCycleRisk: string[][];
}

export async function getCurrentConfig(projectId: string): Promise<CurrentConfigDto> {
  const current = await findCurrentVersion(projectId);
  const versionCount = await db.configVersion.count({ where: { projectId } });
  if (!current) {
    // پروژه بدون نسخه پیکربندی — نباید رخ دهد (ایجاد همیشه نسخه ۱٫۰٫۰ می‌سازد)
    throw ApiError.internal();
  }
  let snapshot: ProjectConfigSnapshot;
  try {
    snapshot = readSnapshotAsV2(JSON.parse(current.snapshotJson));
  } catch {
    throw ApiError.internal();
  }
  return {
    projectId,
    versionId: current.id,
    semver: current.semver,
    snapshot,
    versionCount,
    formulaCycleRisk: checkFormulaCycles(snapshot),
  };
}

/** snapshot خام نسخه خاص (برای تاریخچه) */
export async function getVersionSnapshot(projectId: string, versionId: string): Promise<ProjectConfigSnapshot> {
  const row = await db.configVersion.findFirst({ where: { id: versionId, projectId } });
  if (!row) throw ApiError.notFound("نسخه پیکربندی یافت نشد.");
  return readSnapshotAsV2(JSON.parse(row.snapshotJson));
}

// ── اعمال تغییرات (نسخه جدید append-only) ──────────────────

export interface ApplyChangesInput {
  projectId: string;
  userId: string;
  reason: string;
  operations: ConfigOperation[];
}

export interface AppliedVersionDto {
  versionId: string;
  semver: string;
  reason: string;
  snapshot: ProjectConfigSnapshot;
  summary: {
    familiesTouched: string[];
    parametersTouched: Array<{ key: string; defVersion: number }>;
    formulasTouched: Array<{ key: string; semver: string }>;
    operationsApplied: number;
  };
}

/** bump نسخه: بزرگ‌ترین minor ثبت‌شده +۱ (append-only؛ patch برای اصلاحات آتی) */
async function nextSemver(projectId: string): Promise<string> {
  const versions = await latestVersionNumbers(projectId);
  let maxMajor = 1;
  let maxMinor = 0;
  for (const v of versions) {
    const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v.semver);
    if (m) {
      const major = Number(m[1]);
      const minor = Number(m[2]);
      if (major > maxMajor || (major === maxMajor && minor > maxMinor)) {
        maxMajor = major;
        maxMinor = minor;
      }
    }
  }
  return `${maxMajor}.${maxMinor + 1}.0`;
}

export async function applyChanges(input: ApplyChangesInput): Promise<AppliedVersionDto> {
  const { projectId, userId, reason, operations } = input;
  if (!reason.trim()) {
    throw ApiError.badRequest("دلیل ثبت نسخه الزامی است (ردپوی تغییر ساختاری).");
  }
  if (!Array.isArray(operations) || operations.length === 0) {
    throw ApiError.badRequest("هیچ عملیاتی برای اعمال ارسال نشده است.");
  }

  const current = await findCurrentVersion(projectId);
  if (!current) throw ApiError.internal();
  const baseSnapshot = readSnapshotAsV2(JSON.parse(current.snapshotJson));

  // اعمال عملیات روی کپی + اعتبارسنجی کامل
  const result = applyOperations(baseSnapshot, operations);

  // کشف چرخه فرمول‌ها — پیش از ذخیره (بند ۵ فاز ۲)
  const cycles = checkFormulaCycles(result.snapshot);
  if (cycles.length > 0) {
    throw ApiError.badRequest(
      `چرخه وابستگی فرمول‌ها شناسایی شد: ${cycles.map((c) => c.join(" → ")).join(" | ")}`,
    );
  }

  const versionId = uuidv7();
  const semver = await nextSemver(projectId);

  const snapshotJson = JSON.stringify(result.snapshot);
  await db.$transaction(async (tx) => {
    await insertConfigVersionRow(
      {
        id: versionId,
        projectId,
        semver,
        snapshotJson,
        reason: reason.trim(),
        profileTemplateId: null,
        profileTemplateVersion: null,
        createdBy: userId,
      },
      tx,
    );
    await setCurrentVersion(projectId, versionId, tx);
  });

  await recordAudit({
    userId,
    action: AUDIT_ACTIONS.configVersionCreated,
    entityType: "ConfigVersion",
    entityId: versionId,
    projectId,
    before: { semver: current.semver },
    after: {
      semver,
      reason: reason.trim(),
      operations: operations.map((o) => o.op),
      parametersTouched: result.summary.parametersTouched,
      formulasTouched: result.summary.formulasTouched,
    },
  });
  log.info("config version created", { projectId, userId, semver, ops: operations.length });

  return {
    versionId,
    semver,
    reason: reason.trim(),
    snapshot: result.snapshot,
    summary: result.summary,
  };
}

// ── اعتبارسنجی/آزمون فرمول ──────────────────────────────────

export interface FormulaValidationDto {
  parseOk: boolean;
  errors: Array<{ code: string; messageFa: string }>;
  warnings: Array<{ messageFa: string }>;
  refs: { parameters: string[]; formulaResults: string[]; unknown: string[] };
  inferredType: string;
  symbols: Array<{ name: string; type: string; unit?: string; source: "parameter" | "formulaResult" }>;
}

export async function validateExpr(projectId: string, expr: string): Promise<FormulaValidationDto> {
  const { snapshot } = await getCurrentConfig(projectId);
  const validation = validateFormulaExpr(expr, snapshot);
  const symbols = buildSymbolTable(snapshot);
  return {
    ...validation,
    symbols: Object.entries(symbols).map(([name, info]) => ({
      name,
      type: info.type,
      ...(info.unit ? { unit: info.unit } : {}),
      source: info.source,
    })),
  };
}

export interface FormulaTestDto {
  status: "valid" | "invalid" | "incomplete";
  value: number | string | boolean | null | Array<number | string | boolean | null>;
  unit?: string;
  errors: Array<{ code: string; messageFa: string }>;
  trace: Array<{ nodeId: number; op: string; detail?: string; value?: unknown; unit?: string | null }>;
  inputRefs: string[];
}

/** آزمون فرمول با داده نمونه — بدون ذخیره نتیجه (داده نمونه با داده واقعی مخلوط نمی‌شود) */
export async function testExpr(
  projectId: string,
  expr: string,
  sampleValues: Record<string, number | string | boolean | null | Array<number | string | boolean | null>>,
  sampleUnits?: Record<string, string>,
  extraSymbols?: SymbolTable,
): Promise<FormulaTestDto> {
  const { snapshot } = await getCurrentConfig(projectId);
  // اعتبارسنجی ایستا در برابر نمادهای پروژه (+ قرارداد ورودی فرمول تحت آزمون)
  const validation = extraSymbols ? validateFormulaExprWithSymbols(expr, extraSymbols) : validateFormulaExpr(expr, snapshot);
  if (validation.errors.length > 0) {
    return {
      status: "invalid",
      value: null,
      errors: validation.errors,
      trace: [],
      inputRefs: [],
    };
  }
  // ورودی نمونه: نوع/واحد از تعریف پارامتر اگر موجود بود؛ در غیر این صورت از ورودی خام
  const symbols = extraSymbols ?? buildSymbolTable(snapshot);
  const inputs: Record<string, EvalInput> = {};
  for (const [name, raw] of Object.entries(sampleValues)) {
    const sym = symbols[name];
    const unit = sampleUnits?.[name] ?? sym?.unit;
    inputs[name] = { value: raw, ...(unit !== undefined ? { unit } : {}) };
  }
  const parsed = parse(expr);
  if (!parsed.ok || !parsed.ast) {
    return { status: "invalid", value: null, errors: [{ code: "parse", messageFa: "عبارت قابل تجزیه نیست." }], trace: [], inputRefs: [] };
  }
  const outcome = engineEvaluate(parsed.ast, inputs);
  return {
    status: outcome.status,
    value: outcome.value,
    ...(outcome.unit !== undefined ? { unit: outcome.unit } : {}),
    errors: outcome.errors.map((e) => ({ code: e.code, messageFa: e.messageFa })),
    trace: outcome.trace,
    inputRefs: outcome.inputRefs,
  };
}

/** آزمون فرمول ثبت‌شده snapshot با داده نمونه */
export async function testFormulaByKey(
  projectId: string,
  formulaKey: string,
  sampleValues: Record<string, number | string | boolean | null | Array<number | string | boolean | null>>,
  sampleUnits?: Record<string, string>,
): Promise<FormulaTestDto> {
  const { snapshot } = await getCurrentConfig(projectId);
  const formula = snapshot.formulas.find((f) => f.key === formulaKey);
  if (!formula) throw ApiError.notFound(`فرمول «${formulaKey}» در پیکربندی یافت نشد.`);
  if (!formula.expr) {
    throw ApiError.badRequest(
      `فرمول «${formulaKey}» عبارت اجرایی ندارد${formula.availabilityNoteFa ? ` — ${formula.availabilityNoteFa}` : ""}.`,
    );
  }
  // نمادهای پروژه + نمادهای قرارداد ورودی خود فرمول (مثل nt/rep.time در TS-011)
  const symbols = buildSymbolTable(snapshot, { excludeFormulaKey: formulaKey });
  for (const [name, spec] of Object.entries(formula.inputContract ?? {})) {
    symbols[name] = {
      type: spec.type === "numberArray" ? "numberArray" : spec.type,
      ...(spec.unit ? { unit: spec.unit } : {}),
      source: "parameter",
    };
  }
  return testExpr(projectId, formula.expr, sampleValues, sampleUnits, symbols);
}

// ── Export / Import ──────────────────────────────────────────

export interface ExportPayload {
  format: "timing-config-snapshot";
  formatVersion: "2";
  exportedAt: string;
  projectCode: string;
  projectTitle: string;
  configSemver: string;
  snapshot: ProjectConfigSnapshot;
}

export async function exportConfig(projectId: string): Promise<ExportPayload> {
  const current = await getCurrentConfig(projectId);
  const project = await db.project.findUnique({ where: { id: projectId }, select: { code: true, title: true } });
  if (!project) throw ApiError.notFound();
  return {
    format: "timing-config-snapshot",
    formatVersion: "2",
    exportedAt: new Date().toISOString(),
    projectCode: project.code,
    projectTitle: project.title,
    configSemver: current.semver ?? "—",
    snapshot: current.snapshot,
  };
}

export interface ImportReport {
  valid: boolean;
  issues: Array<{ path: string; messageFa: string }>;
  cycleCount: number;
  /** فقط وقتی valid و dryRun=false */
  applied?: { versionId: string; semver: string };
}

/**
 * Import — فایل واردشده «پیش از اعمال» بررسی و خطاها گزارش می‌شود (بند ۹ فاز ۲).
 * dryRun=true فقط گزارش می‌دهد؛ اعمال واقعی نسخه جدید append-only می‌سازد.
 * meta قالب واردشده بازنویسی می‌شود (استقلال پروژه مقصد حفظ می‌شود).
 */
export async function importConfig(input: {
  projectId: string;
  userId: string;
  payload: unknown;
  dryRun: boolean;
  reason: string;
}): Promise<ImportReport> {
  const { projectId, userId, payload, dryRun, reason } = input;

  if (typeof payload !== "object" || payload === null) {
    return { valid: false, issues: [{ path: "payload", messageFa: "ساختار فایل پیکربندی معتبر نیست." }], cycleCount: 0 };
  }
  const p = payload as Partial<ExportPayload>;
  if (p.format !== "timing-config-snapshot" || p.formatVersion !== "2") {
    return {
      valid: false,
      issues: [{ path: "format", messageFa: "فایل باید قالب timing-config-snapshot نسخه ۲ باشد." }],
      cycleCount: 0,
    };
  }
  if (!p.snapshot || typeof p.snapshot !== "object") {
    return { valid: false, issues: [{ path: "snapshot", messageFa: "snapshot پیکربندی در فایل یافت نشد." }], cycleCount: 0 };
  }

  // اعتبارسنجی کامل snapshot واردشده
  const issues = validateSnapshot(p.snapshot as ProjectConfigSnapshot);
  const cycles = checkFormulaCycles(p.snapshot as ProjectConfigSnapshot);
  if (cycles.length > 0) {
    issues.push({
      path: "formulas",
      messageFa: `چرخه وابستگی فرمول‌ها: ${cycles.map((c) => c.join(" → ")).join(" | ")}`,
    });
  }
  if (issues.length > 0 || cycles.length > 0) {
    return { valid: false, issues, cycleCount: cycles.length };
  }

  if (dryRun) {
    return { valid: true, issues: [], cycleCount: 0 };
  }

  // اعمال: snapshot واردشده با meta پروژه مقصد بازنویسی می‌شود (استقلال A5)
  const current = await getCurrentConfig(projectId);
  const imported = structuredClone(p.snapshot as ProjectConfigSnapshot);
  imported.meta = {
    ...current.snapshot.meta,
    // ردپای import در نسخه جدید ثبت می‌شود (reason)
  };

  const versionId = uuidv7();
  const semver = await nextSemver(projectId);
  const importedJson = JSON.stringify(imported);
  await db.$transaction(async (tx) => {
    await insertConfigVersionRow(
      {
        id: versionId,
        projectId,
        semver,
        snapshotJson: importedJson,
        reason: reason.trim() || `درون‌ریزی پیکربندی از پروژه «${p.projectTitle ?? "نامشخص"}» (${p.configSemver ?? "—"})`,
        profileTemplateId: null,
        profileTemplateVersion: null,
        createdBy: userId,
      },
      tx,
    );
    await setCurrentVersion(projectId, versionId, tx);
  });
  await recordAudit({
    userId,
    action: AUDIT_ACTIONS.configVersionCreated,
    entityType: "ConfigVersion",
    entityId: versionId,
    projectId,
    before: { semver: current.semver },
    after: { semver, importedFrom: p.projectTitle ?? null },
  });
  log.info("config imported", { projectId, userId, semver });
  return { valid: true, issues: [], cycleCount: 0, applied: { versionId, semver } };
}

/** اعتبارسنجی کامل پیش از export (تضمین خروجی سالم) */
export async function assertCurrentConfigExportable(projectId: string): Promise<void> {
  const { snapshot } = await getCurrentConfig(projectId);
  assertSnapshotValid(snapshot, "پیکربندی جاری برای خروجی نامعتبر است");
}
