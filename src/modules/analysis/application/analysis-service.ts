/**
 * لایه Application ماژول تحلیل — فاز ۵ (B9/B4).
 *
 *  - getAnalysis: جمع‌آوری جلسات نهایی‌شده → مشاهدات نشانه‌خورده → آمار هسته خالص
 *    + زنجیره زمان از مسیر «موتور فرمول فاز ۲» (TS-001/002/010/011/012) با
 *    راستی‌آزمایی متقابل با هسته مستقل (اختلاف → هشدار، نه پوشش).
 *  - markObservation: علامت پرت / حذف از محاسبه (دو عمل جدا) + ممیزی + تاریخچه.
 *  - saveSessionContext: زمینه جلسه (پارامتر سفارشی scopeType=session) برای فیلتر.
 *  - buildReport/exportReport: قالب‌های گزارش + خروجی CSV/XLS/JSON با ردیابی کامل.
 *
 * قاعده صداقت: هیچ عددی بدون داده/فرمول/نسخه نمایش داده نمی‌شود؛
 * گام وابسته بی‌ورودی → وضعیت incomplete.
 */

import { db } from "@/lib/db";
import { uuidv7 } from "@/shared/ids";
import { ApiError } from "@/shared/errors";
import { getLogger } from "@/shared/logger";
import { parse, evaluate } from "@/shared/formula/engine";
import type { EvalInput } from "@/shared/formula/evaluator";
import { getCurrentConfig } from "@/modules/config/application/config-service";
import { recordAudit, AUDIT_ACTIONS } from "@/modules/audit/application/audit-service";
import type { ProjectConfigSnapshot, SnapshotFormulaDef, SnapshotParameterDef } from "@/shared/contracts/snapshot";
import { formulaResultSymbol } from "@/shared/contracts/snapshot";
import {
  confidenceIntervalMean,
  coefficientOfVariation,
  descriptiveStats,
  histogram,
  detectOutliers,
  requiredSampleSize,
} from "@/shared/analysis/stats";
import { computeTimeChain } from "@/shared/analysis/timechain";
import type {
  AnalysisSettings,
  ElementAnalysis,
  FormulaEvalTrace,
  MarkedObservation,
  ObservationMarkState,
  SessionAnalysisSummary,
} from "@/shared/analysis/types";
import {
  AGGREGATION_METHODS,
  ALLOWANCE_METHODS,
  CONFIDENCE_Z,
  OUTLIER_RULES,
  isAggregationMethod,
  isAllowanceMethod,
  isOutlierRuleId,
} from "@/shared/analysis/types";
import type { CycleStatus, TimingMethod } from "@/shared/timing/types";
import type { MarkObservationInput, SessionContextInput } from "../domain/analysis";
import { REPORT_TEMPLATE_LABELS_FA } from "@/shared/contracts/analysis";
import type { ReportTemplate, ExportFormat, ReportDto, ReportColumn, ReportRow, AnalysisDto as AnalysisDtoContract } from "@/shared/contracts/analysis";
import {
  insertObservationMarkRow,
  latestMarkStates,
  listFinalizedSessionRows,
  listSessionContextRows,
  listStoredCycles,
  markHistory,
  upsertSessionContextRow,
  type FinalizedSessionRow,
} from "../infrastructure/analysis-repo";
import { buildCsvExport, buildXlsExport, escapeCsv, escapeXml } from "./export-builders";

const log = getLogger("analysis");

// ─────────────────────── DTO ───────────────────────

export type SettingsSourceNote = AnalysisDtoContract["settingsSources"][number];

export type FormulaCatalogEntry = AnalysisDtoContract["formulaCatalog"][number];

export type ProfileSourceDto = AnalysisDtoContract["profile"];

export type AnalysisTraceBlock = AnalysisDtoContract["trace"];

export type StandardCycleTotal = AnalysisDtoContract["standardCycle"];

export type AnalysisDto = AnalysisDtoContract;

export type MarkHistoryDto = import("@/shared/contracts/analysis").MarkHistoryDto;

// ─────────────────────── تنظیمات از snapshot + مقادیر ───────────────────────

interface ParamValueRowLite {
  stableKey: string;
  valueJson: string;
}

function findParamDef(snapshot: ProjectConfigSnapshot, stableKey: string): SnapshotParameterDef | null {
  for (const family of snapshot.families) {
    if (family.archived) continue;
    const p = family.parameters.find((x) => x.stableKey === stableKey);
    if (p && !p.archived) return p;
  }
  return null;
}

function storedValue(rows: readonly ParamValueRowLite[], stableKey: string): { value: unknown; unit?: string } | null {
  const row = rows.find((r) => r.stableKey === stableKey);
  if (!row) return null;
  try {
    return JSON.parse(row.valueJson) as { value: unknown; unit?: string };
  } catch {
    return null;
  }
}

function paramDefault(def: SnapshotParameterDef | null): unknown {
  if (!def || def.defaultValue === undefined || def.defaultValue === null) return null;
  return def.defaultValue;
}

/** تنظیمات صریح پروژه: مقدار ثبت‌شده یا پیش‌فرض تعریف snapshot — با برچسب منبع. */
export function resolveSettings(snapshot: ProjectConfigSnapshot, rows: readonly ParamValueRowLite[]): { settings: AnalysisSettings; sources: SettingsSourceNote[] } {
  const get = (key: string): { value: unknown; unit?: string } | null => storedValue(rows, key);

  const aggRaw = get("agg.method")?.value ?? paramDefault(findParamDef(snapshot, "agg.method")) ?? "mean";
  const aggMethod = isAggregationMethod(aggRaw) ? aggRaw : "mean";

  const ruleRaw = get("agg.outlierRule")?.value ?? paramDefault(findParamDef(snapshot, "agg.outlierRule")) ?? "iqr-1.5";
  const outlierRule = isOutlierRuleId(ruleRaw) ? ruleRaw : "iqr-1.5";

  const ratingEnabledRaw = get("rating.enabled")?.value ?? paramDefault(findParamDef(snapshot, "rating.enabled")) ?? true;
  const ratingEnabled = ratingEnabledRaw === true || ratingEnabledRaw === "true";

  const ratingFactorRaw = Number(get("rating.factor")?.value ?? paramDefault(findParamDef(snapshot, "rating.factor")) ?? 100);
  const ratingFactorPct = Number.isFinite(ratingFactorRaw) ? ratingFactorRaw : 100;

  const allowanceRaw = get("allowance.method")?.value ?? paramDefault(findParamDef(snapshot, "allowance.method")) ?? "on-normal";
  const allowanceMethod = isAllowanceMethod(allowanceRaw) ? allowanceRaw : "on-normal";

  const allowanceRateRaw = Number(get("allowance.rate")?.value ?? paramDefault(findParamDef(snapshot, "allowance.rate")) ?? 15);
  const allowanceRatePct = Number.isFinite(allowanceRateRaw) ? allowanceRateRaw : 15;

  const confidenceRaw = Number(get("stats.confidence")?.value ?? paramDefault(findParamDef(snapshot, "stats.confidence")) ?? 95);
  const confidencePct = CONFIDENCE_Z[confidenceRaw] !== undefined ? confidenceRaw : 95;

  const precisionRaw = Number(get("stats.targetPrecision")?.value ?? paramDefault(findParamDef(snapshot, "stats.targetPrecision")) ?? 5);
  const targetPrecisionPct = Number.isFinite(precisionRaw) ? precisionRaw : 5;

  const settings: AnalysisSettings = {
    aggMethod,
    outlierRule,
    ratingEnabled,
    ratingFactorPct,
    allowanceMethod,
    allowanceRatePct,
    confidencePct,
    targetPrecisionPct,
  };

  const noteOf = (key: string): string | null => findParamDef(snapshot, key)?.suggestionNoteFa ?? null;
  const nameOf = (key: string): string => findParamDef(snapshot, key)?.nameFa ?? key;
  const sources: SettingsSourceNote[] = [
    {
      stableKey: "agg.method",
      nameFa: nameOf("agg.method"),
      valueLabelFa: settings.aggMethod === "mean" ? "میانگین (TS-001)" : settings.aggMethod === "median" ? "میانه (TS-002)" : `حذف پرت بر قاعده ${settings.outlierRule} سپس میانگین`,
      noteFa: null,
    },
    { stableKey: "rating.enabled", nameFa: nameOf("rating.enabled"), valueLabelFa: ratingEnabled ? "فعال" : "غیرفعال — خروجی «زمان خام»", noteFa: null },
    {
      stableKey: "rating.factor",
      nameFa: nameOf("rating.factor"),
      valueLabelFa: `${ratingFactorPct}٪ (ضریب ${settings.ratingEnabled ? (ratingFactorPct / 100).toFixed(3) : "—"})`,
      noteFa: noteOf("rating.factor"),
    },
    {
      stableKey: "allowance.method",
      nameFa: nameOf("allowance.method"),
      valueLabelFa: allowanceMethod === "on-normal" ? "on-normal — ST = NT × (۱+r)" : "on-standard — ST = NT ÷ (۱−r)",
      noteFa: null,
    },
    { stableKey: "allowance.rate", nameFa: nameOf("allowance.rate"), valueLabelFa: `${allowanceRatePct}٪`, noteFa: noteOf("allowance.rate") },
    { stableKey: "stats.confidence", nameFa: nameOf("stats.confidence"), valueLabelFa: `${confidencePct}٪ (z=${CONFIDENCE_Z[confidencePct]})`, noteFa: null },
    { stableKey: "stats.targetPrecision", nameFa: nameOf("stats.targetPrecision"), valueLabelFa: `${targetPrecisionPct}٪ میانگین`, noteFa: null },
  ];
  if (findParamDef(snapshot, "agg.outlierRule") === null) {
    sources.push({
      stableKey: "agg.outlierRule",
      nameFa: "قاعده تشخیص داده پرت",
      valueLabelFa: `${settings.outlierRule} (پیش‌فرض محصول — این پروژه پارامتر agg.outlierRule ندارد؛ الگوی پروفایل ۱٫۲٫۰+)`,
      noteFa: null,
    });
  }
  return { settings, sources };
}

// ─────────────────────── مشاهدات از چرخه‌های نهایی ───────────────────────

interface SessionElements {
  sessionId: string;
  method: TimingMethod;
  observer: string;
  context: Record<string, string>;
}

function parseContextValue(valueJson: string): string {
  try {
    const parsed = JSON.parse(valueJson) as { value: unknown };
    if (parsed.value === null || parsed.value === undefined) return "";
    return String(parsed.value);
  } catch {
    return "";
  }
}

/** جمع‌آوری مشاهدات همه عناصر از جلسات نهایی‌شده — ردیابی کامل هر مشاهده. */
async function gatherObservations(
  projectId: string,
): Promise<{ sessions: FinalizedSessionRow[]; byElement: Map<string, MarkedObservation[]>; sessionMeta: Map<string, SessionElements> }> {
  const sessions = await listFinalizedSessionRows(projectId);
  const sessionIds = sessions.map((s) => s.id);
  const [cycles, marks, contextRows] = await Promise.all([
    listStoredCycles(sessionIds),
    latestMarkStates(sessionIds),
    listSessionContextRows(projectId, sessionIds),
  ]);

  const contextBySession = new Map<string, Record<string, string>>();
  for (const row of contextRows) {
    const cur = contextBySession.get(row.scopeId) ?? {};
    cur[row.stableKey] = parseContextValue(row.valueJson);
    contextBySession.set(row.scopeId, cur);
  }

  const byElement = new Map<string, MarkedObservation[]>();
  const sessionById = new Map(sessions.map((s) => [s.id, s]));

  for (const cycle of cycles) {
    const session = sessionById.get(cycle.sessionId);
    if (!session) continue;
    let elements: Array<{
      elementKey: string;
      elementName: string;
      durationMs: number;
      readingEventId: string;
      corrected: boolean;
      flags: string[];
    }>;
    try {
      elements = JSON.parse(cycle.elementsJson);
    } catch {
      continue;
    }
    const sessionMeta: SessionElements = {
      sessionId: session.id,
      method: session.method as TimingMethod,
      observer: session.observer,
      context: contextBySession.get(session.id) ?? {},
    };
    for (const el of elements) {
      const mark = marks.get(el.readingEventId) ?? null;
      const markState: ObservationMarkState | null =
        mark && (mark.outlierMarked || mark.excluded)
          ? {
              outlierMarked: mark.outlierMarked,
              excluded: mark.excluded,
              reason: mark.reason,
              markedBy: mark.markedBy,
              markedAt: mark.createdAt.toISOString(),
            }
          : null;
      const observation: MarkedObservation = {
        sessionId: session.id,
        sessionMethod: sessionMeta.method,
        observer: sessionMeta.observer,
        cycleSeq: cycle.seq,
        cycleStatus: cycle.status as CycleStatus,
        elementKey: el.elementKey,
        elementName: el.elementName,
        durationMs: el.durationMs,
        readingEventId: el.readingEventId,
        corrected: !!el.corrected,
        flags: (el.flags ?? []) as MarkedObservation["flags"],
        sessionContext: sessionMeta.context,
        mark: markState,
        source: "chronometer",
      };
      const arr = byElement.get(el.elementKey) ?? [];
      arr.push(observation);
      byElement.set(el.elementKey, arr);
    }
  }

  // ── ADR-017: مشاهدات برگه‌های ثبت دستیِ نهایی‌شده — همان قرارداد مشترک ──
  // داده دستی با موجودیت مستقل خودش وارد تحلیل می‌شود (بدون رویداد ساختگی کرنومتر).
  // تجمیع روی elementKey (= stableKey فعالیت) → هم‌جمع‌شدن صحیح با داده کرنومتری همان فعالیت.
  await appendManualSheetObservations(projectId, byElement);

  return { sessions, byElement, sessionMeta: new Map() };
}

/**
 * افزودن مشاهدات برگه‌های دستی نهایی‌شده به نقشه عنصرها (ADR-017).
 * sessionId = شناسه برگه؛ readingEventId = شناسه مشاهده؛ cycleSeq = شماره نمونه؛
 * cycleStatus = valid (تشخیص پرت بعداً توسط هسته آماری انجام می‌شود)؛ منبع روی
 * مشاهده صریح اعلام می‌شود تا داده دستی و کرنومتری هرگز با یک روش ثبت اشتباه نشوند.
 */
async function appendManualSheetObservations(
  projectId: string,
  byElement: Map<string, MarkedObservation[]>,
): Promise<void> {
  const sheets = await db.manualSheet.findMany({
    where: { projectId, status: "finalized" },
    select: { id: true, title: true, createdBy: true },
    orderBy: { createdAt: "asc" },
  });
  if (sheets.length === 0) return;
  const sheetIds = sheets.map((s) => s.id);

  const [observations, activities, observers] = await Promise.all([
    db.manualObservation.findMany({
      where: { sheetId: { in: sheetIds } },
      orderBy: [{ sheetId: "asc" }, { activityId: "asc" }, { sampleIndex: "asc" }],
    }),
    db.activity.findMany({ where: { projectId }, select: { id: true, stableKey: true, name: true } }),
    db.user.findMany({ where: { id: { in: [...new Set(sheets.map((s) => s.createdBy))] } }, select: { id: true, name: true, email: true } }),
  ]);

  const activityById = new Map(activities.map((a) => [a.id, a]));
  const observerById = new Map(observers.map((u) => [u.id, u.name ?? u.email]));
  const sheetById = new Map(sheets.map((s) => [s.id, s]));

  for (const o of observations) {
    const activity = activityById.get(o.activityId);
    const sheet = sheetById.get(o.sheetId);
    if (!activity || !sheet) continue;
    const markState: ObservationMarkState | null =
      o.outlierMarked || o.excluded
        ? {
            outlierMarked: o.outlierMarked,
            excluded: o.excluded,
            reason: o.markReason,
            markedBy: o.recordedBy,
            markedAt: o.updatedAt.toISOString(),
          }
        : null;
    const observation: MarkedObservation = {
      sessionId: o.sheetId,
      sessionMethod: "manual",
      observer: observerById.get(sheet.createdBy) ?? "برگه ثبت دستی",
      cycleSeq: o.sampleIndex,
      cycleStatus: "valid",
      elementKey: activity.stableKey,
      elementName: activity.name,
      durationMs: o.durationMs,
      readingEventId: o.id,
      corrected: o.corrected,
      flags: [],
      sessionContext: { "sheet.title": sheet.title },
      mark: markState,
      source: (o.source === "manual" || o.source === "paste" || o.source === "import" ? o.source : "manual"),
    };
    const arr = byElement.get(activity.stableKey) ?? [];
    arr.push(observation);
    byElement.set(activity.stableKey, arr);
  }
}

// ─────────────────────── ارزیابی فرمول زنجیره از snapshot ───────────────────────

interface ChainFormulaOutcome {
  rep: FormulaEvalTrace;
  normal: FormulaEvalTrace;
  standard: FormulaEvalTrace;
  /** مقادیر ثانیه‌ای برای cross-check */
  repSec: number | null;
  normalSec: number | null;
  standardSec: number | null;
}

function evalFormula(
  formula: SnapshotFormulaDef | undefined,
  inputs: Record<string, EvalInput>,
  notFoundNoteFa: string,
): { trace: FormulaEvalTrace; valueSec: number | null } {
  if (!formula) {
    return { trace: { formulaKey: "—", formulaSemver: "—", status: "incomplete", value: null, unit: "s", errorsFa: [notFoundNoteFa] }, valueSec: null };
  }
  if (formula.status === "deprecated") {
    return {
      trace: { formulaKey: formula.key, formulaSemver: formula.semver, status: "incomplete", value: null, unit: "s", errorsFa: [`فرمول «${formula.key}» در پیکربندی این پروژه منسوخ شده است — گام وابسته تکمیل‌نشده است.`] },
      valueSec: null,
    };
  }
  if (!formula.expr) {
    return {
      trace: { formulaKey: formula.key, formulaSemver: formula.semver, status: "incomplete", value: null, unit: "s", errorsFa: ["فرمول عبارت اجرایی ندارد."] },
      valueSec: null,
    };
  }
  const parsed = parse(formula.expr);
  if (!parsed.ok || !parsed.ast) {
    return {
      trace: { formulaKey: formula.key, formulaSemver: formula.semver, status: "invalid", value: null, unit: "s", errorsFa: [parsed.error?.messageFa ?? "عبارت قابل تجزیه نیست."] },
      valueSec: null,
    };
  }
  const outcome = evaluate(parsed.ast, inputs);
  const valueSec = typeof outcome.value === "number" ? outcome.value : null;
  return {
    trace: {
      formulaKey: formula.key,
      formulaSemver: formula.semver,
      status: outcome.status,
      value: typeof outcome.value === "number" ? outcome.value : null,
      unit: outcome.unit ?? "s",
      errorsFa: outcome.errors.map((e) => e.messageFa),
    },
    valueSec,
  };
}

/**
 * ارزیابی زنجیره از مسیر موتور فرمول — نسخه فرمول ردیابی‌پذیر.
 * ورودی‌ها بر حسب ثانیه (قرارداد inputContract کتابخانه فرمول).
 */
function evaluateChainFormulas(
  snapshot: ProjectConfigSnapshot,
  effectiveSeconds: number[],
  settings: AnalysisSettings,
): ChainFormulaOutcome {
  const formulas = snapshot.formulas;
  const find = (key: string) => formulas.find((f) => f.key === key);

  const aggFormulaKey = settings.aggMethod === "median" ? "TS-002" : "TS-001";
  const obsInputs: Record<string, EvalInput> = { "obs.times": { value: effectiveSeconds, unit: "s" } };
  const rep = evalFormula(find(aggFormulaKey), obsInputs, `فرمول تجمیع (${aggFormulaKey}) در پیکربندی یافت نشد.`);

  let normal: FormulaEvalTrace;
  let normalSec: number | null = null;
  if (!settings.ratingEnabled) {
    normal = {
      formulaKey: "TS-010",
      formulaSemver: find("TS-010")?.semver ?? "—",
      status: "incomplete",
      value: null,
      unit: "s",
      errorsFa: ["ارزیابی عملکرد غیرفعال است — TS-010 ارزیابی نشد؛ خروجی «زمان خام» است (B4)."],
    };
  } else if (rep.valueSec === null) {
    normal = {
      formulaKey: "TS-010",
      formulaSemver: find("TS-010")?.semver ?? "—",
      status: "incomplete",
      value: null,
      unit: "s",
      errorsFa: ["ورودی rep.time در دسترس نیست — TS-010 ارزیابی نشد."],
    };
  } else {
    const ntInputs: Record<string, EvalInput> = {
      "rep.time": { value: rep.valueSec, unit: "s" },
      "rating.factor": { value: settings.ratingFactorPct, unit: "percent" },
    };
    const r = evalFormula(find("TS-010"), ntInputs, "فرمول TS-010 در پیکربندی یافت نشد.");
    normal = r.trace;
    normalSec = r.valueSec;
  }

  const stFormulaKey = settings.allowanceMethod === "on-standard" ? "TS-012" : "TS-011";
  let standard: FormulaEvalTrace;
  let standardSec: number | null = null;
  if (normalSec === null) {
    standard = {
      formulaKey: stFormulaKey,
      formulaSemver: find(stFormulaKey)?.semver ?? "—",
      status: "incomplete",
      value: null,
      unit: "s",
      errorsFa: ["ورودی nt در دسترس نیست — زمان استاندارد ارزیابی نشد."],
    };
  } else {
    const stInputs: Record<string, EvalInput> = {
      nt: { value: normalSec, unit: "s" },
      "allowance.rate": { value: settings.allowanceRatePct, unit: "percent" },
    };
    const r = evalFormula(find(stFormulaKey), stInputs, `فرمول ${stFormulaKey} در پیکربندی یافت نشد.`);
    standard = r.trace;
    standardSec = r.valueSec;
  }

  return { rep: rep.trace, normal, standard, repSec: rep.valueSec, normalSec, standardSec };
}

// ─────────────────────── تحلیل کامل ───────────────────────

export async function getAnalysis(projectId: string): Promise<AnalysisDto> {
  const config = await getCurrentConfig(projectId);
  const snapshot = config.snapshot;
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { code: true, title: true, profileTemplateId: true, profileTemplateVersion: true },
  });
  if (!project) throw ApiError.notFound("پروژه یافت نشد.");

  const valueRows = await db.parameterValue.findMany({
    where: { projectId, scopeType: "project", scopeId: "" },
    select: { stableKey: true, valueJson: true },
  });
  const { settings, sources } = resolveSettings(snapshot, valueRows);

  const { sessions, byElement } = await gatherObservations(projectId);

  // پروفایل روش‌شناختی — از snapshot/الگو (بند ۹: منابع هر پروفایل در راهنما)
  const profileRow = project.profileTemplateId
    ? await db.profileTemplate.findUnique({
        where: { id: project.profileTemplateId },
        select: { nameFa: true, sourceName: true, sourceVersion: true, sourceUrl: true, assumptionsJson: true, limitationsJson: true },
      })
    : null;
  const profile: ProfileSourceDto = {
    templateId: project.profileTemplateId,
    templateVersion: project.profileTemplateVersion,
    nameFa: profileRow?.nameFa ?? null,
    sourceName: profileRow?.sourceName ?? null,
    sourceVersion: profileRow?.sourceVersion ?? null,
    sourceUrl: profileRow?.sourceUrl ?? null,
    assumptionsFa: profileRow ? safeJsonArray(profileRow.assumptionsJson) : [],
    limitationsFa: profileRow ? safeJsonArray(profileRow.limitationsJson) : [],
  };

  // تحلیل هر عنصر: هسته مستقل + زنجیره موتور فرمول + راستی‌آزمایی متقابل
  const elements: ElementAnalysis[] = [];
  for (const [elementKey, observations] of [...byElement.entries()].sort((a, b) => a[0].localeCompare(b[0], "en"))) {
    const chain = computeTimeChain(observations, settings);
    const outlierDetection = detectOutliers(
      observations
        .filter((o) => USABLE(o) && !o.mark?.excluded)
        .map((o) => o.durationMs),
      settings.outlierRule,
    );

    // مشاهدات مؤثر (پس از قاعده) بر حسب ثانیه برای موتور فرمول
    const effectiveMs = chain.representative.method === "outlierRule" ? effectiveAfterRule(observations, settings) : usableNotExcluded(observations);
    const effectiveSeconds = effectiveMs.map((ms) => ms / 1000);
    const formulaOutcome = evaluateChainFormulas(snapshot, effectiveSeconds, settings);

    // راستی‌آزمایی متقابل هسته ↔ موتور فرمول (تلورانس 1e-6 s)
    const crossWarnings: string[] = [];
    if (chain.representative.value !== null && formulaOutcome.repSec !== null) {
      if (Math.abs(chain.representative.value / 1000 - formulaOutcome.repSec) > 1e-6) {
        crossWarnings.push(`اختلاف زمان نماینده هسته مستقل (${(chain.representative.value / 1000).toFixed(6)}s) با موتور فرمول (${formulaOutcome.repSec.toFixed(6)}s) — بررسی نسخه فرمول لازم است.`);
      }
    }
    if (chain.standard.value !== null && formulaOutcome.standardSec !== null) {
      if (Math.abs(chain.standard.value / 1000 - formulaOutcome.standardSec) > 1e-6) {
        crossWarnings.push(`اختلاف زمان استاندارد هسته/موتور فرمول — بررسی نسخه فرمول لازم است.`);
      }
    }

    // ادغام وضعیت موتور فرمول در گام‌های زنجیره (صداقت روش):
    // فرمول گام اگر منسوخ/غایب/نامعتبر باشد → گام «تکمیل‌نشده» گزارش می‌شود،
    // حتی اگر ریاضیات هسته عددی بتواند تولید کند (منشور: بدون فرمول نسخه‌دار، ادعای عدد نمی‌شود).
    if (formulaOutcome.rep.status !== "valid" && chain.representative.status === "valid") {
      chain.representative.status = "incomplete";
      chain.representative.warningsFa = [
        ...chain.representative.warningsFa,
        ...(formulaOutcome.rep.errorsFa.length > 0 ? formulaOutcome.rep.errorsFa : ["فرمول تجمیع این پروژه در دسترس نیست — گام تکمیل‌نشده."]),
      ];
    }
    if (settings.ratingEnabled && formulaOutcome.normal.status !== "valid" && chain.normal.status === "valid") {
      chain.normal.status = "incomplete";
      chain.normal.warningsFa = [
        ...chain.normal.warningsFa,
        ...(formulaOutcome.normal.errorsFa.length > 0 ? formulaOutcome.normal.errorsFa : ["فرمول TS-010 در دسترس نیست — گام تکمیل‌نشده."]),
      ];
    }
    if (formulaOutcome.standard.status !== "valid" && chain.standard.status === "valid") {
      chain.standard.status = "incomplete";
      chain.standard.warningsFa = [
        ...chain.standard.warningsFa,
        ...(formulaOutcome.standard.errorsFa.length > 0 ? formulaOutcome.standard.errorsFa : ["فرمول مجاز این پروژه در دسترس نیست — گام تکمیل‌نشده."]),
      ];
    }

    const stats = descriptiveStats(usableNotExcluded(observations));
    const hist = histogram(usableNotExcluded(observations));
    const cv = coefficientOfVariation(usableNotExcluded(observations));
    const ci = confidenceIntervalMean(usableNotExcluded(observations), settings.confidencePct);
    const adequacy = requiredSampleSize(cv, settings.targetPrecisionPct, settings.confidencePct, chain.counts.effective);
    const qualityWarnings: string[] = [...crossWarnings];
    if (chain.counts.flagged > 0) qualityWarnings.push(`${chain.counts.flagged} مشاهده دارای پرچم یکپارچگی (نیازمند بررسی) در محاسبه مانده — با علامت حذف جداگانه قابل کنارگذاشتن است.`);
    if (chain.counts.ruleSuspect > 0 && settings.aggMethod !== "outlierRule") {
      qualityWarnings.push(`${chain.counts.ruleSuspect} مشاهده «مشکوک بر قاعده ${settings.outlierRule}» شناسایی شد اما روش تجمیع «${settings.aggMethod}» آن را حذف نمی‌کند — با تغییر روش تجمیع یا حذف دستی تصمیم بگیرید.`);
    }

    elements.push({
      elementKey,
      elementName: observations[observations.length - 1]?.elementName ?? elementKey,
      nameVariants: [...new Set(observations.map((o) => o.elementName))],
      observations,
      counts: chain.counts,
      stats,
      histogram: hist,
      outlierDetection,
      quality: {
        cv,
        ci,
        adequacy,
        warningsFa: qualityWarnings,
      },
      chain: {
        representative: chain.representative,
        normal: chain.normal,
        standard: chain.standard,
      },
      formulaTrace: [formulaOutcome.rep, formulaOutcome.normal, formulaOutcome.standard],
    });
  }

  // خلاصه هر جلسه + TS-004 (زمان چرخه مشاهده‌شده میانگین چرخه‌های کامل)
  const cyclesBySession = new Map<string, { total: number; valid: number; suspect: number; recovered: number; incomplete: number; cycleTimes: number[]; obsCount: number }>();
  const { sessions: _s, byElement: _b } = { sessions, byElement };
  const storedCycles = await listStoredCycles(sessions.map((s) => s.id));
  for (const c of storedCycles) {
    const cur = cyclesBySession.get(c.sessionId) ?? { total: 0, valid: 0, suspect: 0, recovered: 0, incomplete: 0, cycleTimes: [], obsCount: 0 };
    cur.total += 1;
    if (c.status === "valid") cur.valid += 1;
    else if (c.status === "suspect") cur.suspect += 1;
    else if (c.status === "recovered") cur.recovered += 1;
    else cur.incomplete += 1;
    if (c.cycleTimeMs !== null && (c.status === "valid" || c.status === "suspect" || c.status === "recovered")) cur.cycleTimes.push(c.cycleTimeMs);
    try {
      cur.obsCount += (JSON.parse(c.elementsJson) as unknown[]).length;
    } catch {
      /* چرخه خراب شمرده نمی‌شود */
    }
    cyclesBySession.set(c.sessionId, cur);
  }

  const contextBySessionId = new Map<string, Record<string, string>>();
  const contextRows = await listSessionContextRows(projectId, sessions.map((s) => s.id));
  for (const row of contextRows) {
    const cur = contextBySessionId.get(row.scopeId) ?? {};
    cur[row.stableKey] = parseContextValue(row.valueJson);
    contextBySessionId.set(row.scopeId, cur);
  }

  // ── ADR-017: خلاصه برگه‌های دستی نهایی‌شده — همان فهرست منابع داده تحلیل ──
  const manualSheetRows = await db.manualSheet.findMany({
    where: { projectId, status: "finalized" },
    select: { id: true, title: true, createdBy: true, createdAt: true, _count: { select: { observations: true, interruptions: true } } },
    orderBy: { createdAt: "asc" },
  });
  const manualSummaries: SessionAnalysisSummary[] = manualSheetRows.map((m) => ({
    sessionId: m.id,
    method: "manual" as const,
    source: "manual" as const,
    title: m.title,
    observer: "برگه ثبت دستی",
    status: "finalized",
    cyclesTotal: 0,
    cyclesValid: 0,
    cyclesSuspect: 0,
    cyclesRecovered: 0,
    cyclesIncomplete: 0,
    observationsCount: m._count.observations,
    meanCycleTimeMs: null,
    startedAtWall: m.createdAt.toISOString(),
    sessionContext: { "sheet.title": m.title },
  }));
  const sessionSummaries: SessionAnalysisSummary[] = sessions.map((s) => {
    const c = cyclesBySession.get(s.id);
    const times = c?.cycleTimes ?? [];
    return {
      sessionId: s.id,
      method: s.method as TimingMethod,
      observer: s.observer,
      status: s.status,
      cyclesTotal: c?.total ?? 0,
      cyclesValid: c?.valid ?? 0,
      cyclesSuspect: c?.suspect ?? 0,
      cyclesRecovered: c?.recovered ?? 0,
      cyclesIncomplete: c?.incomplete ?? 0,
      observationsCount: c?.obsCount ?? 0,
      meanCycleTimeMs: times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : null,
      startedAtWall: s.startedAtWall?.toISOString() ?? null,
      sessionContext: contextBySessionId.get(s.id) ?? {},
    };
  });

  // استاندارد چرخه: Σ عناصر معتبر (گام ۵ زنجیره پروفایل)
  const validSt = elements.filter((e) => e.chain.standard.status === "valid" && e.chain.standard.value !== null);
  const incompleteSt = elements.length - validSt.length;
  const standardCycle: StandardCycleTotal = {
    status: elements.length === 0 ? "incomplete" : incompleteSt === 0 ? "valid" : "incomplete",
    totalMs: validSt.length > 0 ? validSt.reduce((a, e) => a + (e.chain.standard.value as number), 0) : null,
    validElements: validSt.length,
    incompleteElements: incompleteSt,
    warningsFa:
      incompleteSt > 0
        ? [`${incompleteSt} عنصر زمان استاندارد معتبر ندارد — جمع چرخه فقط ${validSt.length} عنصر معتبر را می‌شمارد (مرز چرخه = مجموع عناصر؛ TS-004).`]
        : [],
  };

  // کاتالوگ فرمول‌های نسخه‌دار (خروجی فاز: «کاتالوگ فرمول‌های نسخه‌دار»)
  const formulaCatalog: FormulaCatalogEntry[] = snapshot.formulas
    .filter((f) => f.scopeLevel === "element" || f.scopeLevel === "cycle")
    .map((f) => ({
      key: f.key,
      nameFa: f.nameFa,
      semver: f.semver,
      scopeLevel: f.scopeLevel,
      status: f.status,
      sourceFa: f.sourceRef ? `${f.sourceRef.name}${f.sourceRef.version ? ` — ${f.sourceRef.version}` : ""}` : "بدون منبع ثبت‌شده",
      assumptionsFa: f.assumptionsFa ?? [],
      descriptionFa: f.descriptionFa,
    }));

  const formulaVersions = [
    ...new Map(
      elements
        .flatMap((e) => e.formulaTrace)
        .filter((t) => t.formulaKey !== "—")
        .map((t) => [t.formulaKey, { key: t.formulaKey, semver: t.formulaSemver }]),
    ).values(),
  ];

  const totalObs = elements.reduce((a, e) => a + e.counts.total, 0);
  const trace: AnalysisTraceBlock = {
    configVersionId: config.versionId,
    configSemver: config.semver,
    generatedAt: new Date().toISOString(),
    settings,
    formulaVersions,
    inputSummaryFa: `${sessions.length} جلسه نهایی‌شده · ${totalObs} مشاهده · ${elements.length} عنصر`,
    methodologyNotesFa: [],
  };

  const guideFa = buildGuideFa(profile, settings, formulaCatalog);

  const marksHistoryCount = (await allMarksCount(sessions.map((s) => s.id))) ?? 0;

  return {
    projectId,
    projectCode: project.code,
    projectTitle: project.title,
    profile,
    settings,
    settingsSources: sources,
    sessions: [...sessionSummaries, ...manualSummaries],
    elements,
    standardCycle,
    formulaCatalog,
    marksHistoryCount,
    trace,
    guideFa,
  };
}

async function allMarksCount(sessionIds: string[]): Promise<number> {
  if (sessionIds.length === 0) return 0;
  return db.observationMark.count({ where: { sessionId: { in: sessionIds } } });
}

function USABLE(o: MarkedObservation): boolean {
  return (o.cycleStatus === "valid" || o.cycleStatus === "suspect" || o.cycleStatus === "recovered") && !o.mark?.excluded;
}

function usableNotExcluded(observations: readonly MarkedObservation[]): number[] {
  return observations.filter(USABLE).map((o) => o.durationMs);
}

function effectiveAfterRule(observations: readonly MarkedObservation[], settings: AnalysisSettings): number[] {
  const values = usableNotExcluded(observations);
  const det = detectOutliers(values, settings.outlierRule);
  if (!det) return values;
  const suspects = new Set(det.suspectIndices);
  return values.filter((_, i) => !suspects.has(i));
}

function safeJsonArray(json: string | null): string[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return [];
  }
}

function buildGuideFa(profile: ProfileSourceDto, settings: AnalysisSettings, catalog: FormulaCatalogEntry[]): string[] {
  const notes: string[] = [];
  notes.push(
    profile.sourceName
      ? `پروفایل روش‌شناختی: «${profile.nameFa ?? "—"}» نسخه ${profile.templateVersion ?? "—"} — منبع: ${profile.sourceName}${profile.sourceVersion ? ` (${profile.sourceVersion})` : ""}.`
      : "پروفایل روش‌شناختی برای این پروژه ثبت نشده است — مقادیر پیش‌فرض محصول استفاده می‌شود.",
  );
  notes.push(
    "نرخ مجاز زمان مقداری سازمانی/پیشنهادی است و «استاندارد جهانی» نیست؛ بدون ثبت شرایط کاری و منبع، معیار جهان‌شمول تلقی نمی‌شود (B4).",
  );
  notes.push(
    `قرارداد مجاز فعال: ${settings.allowanceMethod === "on-normal" ? "on-normal — ST = NT × (۱+r)" : "on-standard — ST = NT ÷ (۱−r)"}؛ پایه درصد: ${settings.allowanceMethod === "on-normal" ? "زمان نرمال" : "زمان استاندارد"} — دو قرارداد نابرابرند.`,
  );
  notes.push(
    "تشخیص داده پرت (IQR توکی / z-score) فقط «شناسایی» است و حذف خودکار نیست؛ حذف از محاسبه عملی جدا با علت ثبت‌شده است (B9).",
  );
  notes.push(
    "فاصله اطمینان و کفایت نمونه بر تقریب نرمل هستند؛ برای n<۳۰ تقریب خشن است و فرض نمونه تصادفی/مستقل لازم است.",
  );
  if (catalog.length > 0) {
    notes.push(`کاتالوگ فرمول‌های نسخه‌دار این پروژه: ${catalog.map((f) => `${f.key}@${f.semver}`).join(" · ")}.`);
  }
  return notes;
}

// ─────────────────────── علامت مشاهده ───────────────────────

export async function markObservation(projectId: string, userId: string, input: MarkObservationInput): Promise<MarkHistoryDto> {
  // اعتبارسنجی وجود مشاهده: جلسه باید متعلق به پروژه و نهایی باشد
  const session = await db.timingSession.findFirst({
    where: { id: input.sessionId, projectId, status: "finalized" },
    select: { id: true },
  });
  if (!session) throw ApiError.notFound("جلسه نهایی‌شدهای با این شناسه در پروژه یافت نشد.");

  const cycle = await db.timingCycle.findFirst({
    where: { sessionId: input.sessionId, seq: input.cycleSeq },
    select: { elementsJson: true },
  });
  if (!cycle) throw ApiError.notFound("چرخه یافت نشد.");
  let elements: Array<{ elementKey: string; readingEventId: string }> = [];
  try {
    elements = JSON.parse(cycle.elementsJson);
  } catch {
    elements = [];
  }
  const target = elements.find((e) => e.elementKey === input.elementKey && e.readingEventId === input.readingEventId);
  if (!target) {
    throw ApiError.notFound("مشاهده‌ای با این عنصر/رویداد قرائت در چرخه یافت نشد.");
  }

  const before = await latestMarkFor(input.sessionId, input.readingEventId);

  await insertObservationMarkRow({
    id: uuidv7(),
    sessionId: input.sessionId,
    readingEventId: input.readingEventId,
    cycleSeq: input.cycleSeq,
    elementKey: input.elementKey,
    outlierMarked: input.outlierMarked,
    excluded: input.excluded,
    reason: input.reason?.trim() || null,
    markedBy: userId,
  });

  await recordAudit({
    userId,
    action: AUDIT_ACTIONS.analysisMarkSaved,
    entityType: "ObservationMark",
    entityId: input.readingEventId,
    projectId,
    before: before ? { outlierMarked: before.outlierMarked, excluded: before.excluded, reason: before.reason } : null,
    after: { outlierMarked: input.outlierMarked, excluded: input.excluded, reason: input.reason?.trim() || null, cycleSeq: input.cycleSeq, elementKey: input.elementKey },
  });
  log.info("observation mark saved", { projectId, readingEventId: input.readingEventId, excluded: input.excluded });

  return getMarkHistory(projectId, input.sessionId, input.readingEventId);
}

async function latestMarkFor(sessionId: string, readingEventId: string) {
  const rows = await markHistory(sessionId, readingEventId);
  return rows.length > 0 ? rows[rows.length - 1] : null;
}

export async function getMarkHistory(projectId: string, sessionId: string, readingEventId: string): Promise<MarkHistoryDto> {
  const session = await db.timingSession.findFirst({
    where: { id: sessionId, projectId },
    select: { id: true },
  });
  if (!session) throw ApiError.notFound("جلسه یافت نشد.");
  const rows = await markHistory(sessionId, readingEventId);
  const last = rows.length > 0 ? rows[rows.length - 1] : null;
  return {
    readingEventId,
    history: rows.map((r) => ({
      id: r.id,
      outlierMarked: r.outlierMarked,
      excluded: r.excluded,
      reason: r.reason,
      markedBy: r.markedBy,
      createdAt: r.createdAt.toISOString(),
    })),
    current:
      last && (last.outlierMarked || last.excluded)
        ? { outlierMarked: last.outlierMarked, excluded: last.excluded, reason: last.reason, markedBy: last.markedBy, markedAt: last.createdAt.toISOString() }
        : null,
  };
}

// ─────────────────────── زمینه جلسه (پارامتر سفارشی session-scope) ───────────────────────

export async function saveSessionContext(projectId: string, userId: string, input: SessionContextInput): Promise<{ saved: string[] }> {
  const session = await db.timingSession.findFirst({
    where: { id: input.sessionId, projectId },
    select: { id: true },
  });
  if (!session) throw ApiError.notFound("جلسه یافت نشد.");

  const config = await getCurrentConfig(projectId);
  const saved: string[] = [];
  for (const item of input.values) {
    const def = findParamDef(config.snapshot, item.stableKey);
    if (!def) throw ApiError.notFound(`پارامتر «${item.stableKey}» در پیکربندی جاری یافت نشد.`);
    if (def.dataType === "computed") throw ApiError.badRequest("پارامتر محاسباتی مقدار دستی نمی‌پذیرد.");
    const valueJson = JSON.stringify(
      typeof item.value === "number" && def.unit ? { value: item.value, unit: def.unit } : { value: item.value },
    );
    await upsertSessionContextRow({
      id: uuidv7(),
      projectId,
      sessionId: input.sessionId,
      stableKey: item.stableKey,
      defVersion: def.defVersion,
      valueJson,
      recordedBy: userId,
    });
    saved.push(item.stableKey);
  }
  await recordAudit({
    userId,
    action: AUDIT_ACTIONS.analysisSessionContextSaved,
    entityType: "TimingSession",
    entityId: input.sessionId,
    projectId,
    after: { keys: saved },
  });
  log.info("session context saved", { projectId, sessionId: input.sessionId, keys: saved });
  return { saved };
}

// ─────────────────────── گزارش‌ها و خروجی ───────────────────────

export type { ReportDto };

/** ساخت داده گزارش (قالب‌های شش‌گانه — بند ۷ فاز ۵). */
export async function buildReport(projectId: string, template: ReportTemplate): Promise<ReportDto> {
  const analysis = await getAnalysis(projectId);
  const t = analysis.trace;
  const commonSummary = [
    `پروژه: ${analysis.projectCode} — ${analysis.projectTitle}`,
    t.inputSummaryFa,
    `نسخه پیکربندی: ${t.configSemver ?? "—"} · روش تجمیع: ${analysis.settings.aggMethod} · ارزیابی: ${analysis.settings.ratingEnabled ? `${analysis.settings.ratingFactorPct}٪` : "غیرفعال (زمان خام)"} · مجاز: ${analysis.settings.allowanceMethod} با ${analysis.settings.allowanceRatePct}٪ (پایه درصد: ${analysis.settings.allowanceMethod === "on-normal" ? "زمان نرمال" : "زمان استاندارد"})`,
    `تاریخ تولید: ${new Date(t.generatedAt).toLocaleString("fa-IR")}`,
    ...analysis.guideFa,
  ];

  const traceFootnote = `ردیابی: نسخه پیکربندی ${t.configSemver ?? "—"} · فرمول‌ها ${t.formulaVersions.map((f) => `${f.key}@${f.semver}`).join("، ") || "—"} · واحد زمان: ثانیه/میلی‌ثانیه مطابق ستون`;

  if (template === "study-summary") {
    return {
      template,
      templateLabelFa: REPORT_TEMPLATE_LABELS_FA[template],
      columns: [
        { key: "item", labelFa: "شاخص" },
        { key: "value", labelFa: "مقدار" },
      ],
      rows: [
        { item: "جلسات نهایی‌شده", value: analysis.sessions.length },
        { item: "عناصر تحلیل‌شده", value: analysis.elements.length },
        { item: "کل مشاهدات", value: analysis.elements.reduce((a, e) => a + e.counts.total, 0) },
        { item: "مشاهدات قابل استفاده", value: analysis.elements.reduce((a, e) => a + e.counts.usable, 0) },
        { item: "حذف‌شده با علامت کاربر", value: analysis.elements.reduce((a, e) => a + e.counts.userExcluded, 0) },
        { item: "مشاهده‌های چرخه ناتمام", value: analysis.elements.reduce((a, e) => a + e.counts.incompleteCycle, 0) },
        { item: "مشکوک بر قاعده پرت", value: analysis.elements.reduce((a, e) => a + e.counts.ruleSuspect, 0) },
        { item: "عناصر با استاندارد معتبر", value: analysis.standardCycle.validElements },
        { item: "زمان استاندارد چرخه (ثانیه)", value: analysis.standardCycle.totalMs !== null ? Number((analysis.standardCycle.totalMs / 1000).toFixed(3)) : null },
        { item: "ردپای علامت‌ها (تاریخچه)", value: analysis.marksHistoryCount },
      ],
      summaryFa: commonSummary,
      trace: t,
      fileNameBase: `${analysis.projectCode}-study-summary`,
    };
  }

  if (template === "raw-observations") {
    const rows: Array<Record<string, string | number | null>> = [];
    for (const el of analysis.elements) {
      for (const o of el.observations) {
        rows.push({
          sessionId: o.sessionId.slice(0, 8),
          method: o.sessionMethod,
          observer: o.observer,
          cycle: o.cycleSeq,
          cycleStatus: o.cycleStatus,
          elementKey: o.elementKey,
          element: o.elementName,
          durationMs: o.durationMs,
          durationSec: Number((o.durationMs / 1000).toFixed(3)),
          corrected: o.corrected ? "بله" : "خیر",
          flags: o.flags.join("،") || "—",
          outlierMarked: o.mark?.outlierMarked ? "بله" : "خیر",
          excluded: o.mark?.excluded ? "بله" : "خیر",
          exclusionReason: o.mark?.reason ?? "—",
        });
      }
    }
    return {
      template,
      templateLabelFa: REPORT_TEMPLATE_LABELS_FA[template],
      columns: [
        { key: "sessionId", labelFa: "جلسه" },
        { key: "method", labelFa: "روش ثبت" },
        { key: "observer", labelFa: "ناظر" },
        { key: "cycle", labelFa: "چرخه" },
        { key: "cycleStatus", labelFa: "وضعیت چرخه" },
        { key: "elementKey", labelFa: "کلید عنصر" },
        { key: "element", labelFa: "عنصر" },
        { key: "durationSec", labelFa: "مدت (ثانیه)" },
        { key: "durationMs", labelFa: "مدت (ms)" },
        { key: "corrected", labelFa: "اصلاح‌شده" },
        { key: "flags", labelFa: "پرچم‌ها" },
        { key: "outlierMarked", labelFa: "علامت پرت" },
        { key: "excluded", labelFa: "حذف از محاسبه" },
        { key: "exclusionReason", labelFa: "علت حذف" },
      ],
      rows,
      summaryFa: [...commonSummary, "فقط جلسات نهایی‌شده — داده خام قابل بازیابی از خروجی JSON جلسه نیز هست."],
      trace: t,
      fileNameBase: `${analysis.projectCode}-raw-observations`,
    };
  }

  if (template === "element-analysis") {
    const rows = analysis.elements.map((el) => ({
      elementKey: el.elementKey,
      element: el.elementName,
      nTotal: el.counts.total,
      nUsable: el.counts.usable,
      nExcluded: el.counts.userExcluded,
      nEffective: el.counts.effective,
      meanSec: el.stats.mean !== null ? Number((el.stats.mean / 1000).toFixed(3)) : null,
      medianSec: el.stats.median !== null ? Number((el.stats.median / 1000).toFixed(3)) : null,
      minSec: el.stats.min !== null ? Number((el.stats.min / 1000).toFixed(3)) : null,
      maxSec: el.stats.max !== null ? Number((el.stats.max / 1000).toFixed(3)) : null,
      stddevSec: el.stats.stddev !== null ? Number((el.stats.stddev / 1000).toFixed(3)) : null,
      cvPct: el.stats.cv !== null ? Number((el.stats.cv * 100).toFixed(1)) : null,
      repSec: el.chain.representative.value !== null ? Number((el.chain.representative.value / 1000).toFixed(3)) : null,
      repStatus: el.chain.representative.status,
    }));
    return {
      template,
      templateLabelFa: REPORT_TEMPLATE_LABELS_FA[template],
      columns: [
        { key: "elementKey", labelFa: "کلید عنصر" },
        { key: "element", labelFa: "عنصر" },
        { key: "nTotal", labelFa: "کل مشاهده" },
        { key: "nUsable", labelFa: "قابل استفاده" },
        { key: "nExcluded", labelFa: "حذف کاربر" },
        { key: "nEffective", labelFa: "n مؤثر" },
        { key: "meanSec", labelFa: "میانگین (s)" },
        { key: "medianSec", labelFa: "میانه (s)" },
        { key: "minSec", labelFa: "کمینه (s)" },
        { key: "maxSec", labelFa: "بیشینه (s)" },
        { key: "stddevSec", labelFa: "انحراف معیار (s)" },
        { key: "cvPct", labelFa: "CV (٪)" },
        { key: "repSec", labelFa: "زمان نماینده (s)" },
        { key: "repStatus", labelFa: "وضعیت" },
      ],
      rows,
      summaryFa: commonSummary,
      trace: t,
      fileNameBase: `${analysis.projectCode}-element-analysis`,
    };
  }

  if (template === "sample-quality") {
    const rows = analysis.elements.map((el) => ({
      elementKey: el.elementKey,
      element: el.elementName,
      n: el.counts.effective,
      cvPct: el.quality.cv !== null ? Number((el.quality.cv * 100).toFixed(1)) : null,
      ciLevelPct: el.quality.ci?.levelPct ?? null,
      ciHalfSec: el.quality.ci?.halfWidth !== null && el.quality.ci?.halfWidth !== undefined ? Number((el.quality.ci.halfWidth / 1000).toFixed(3)) : null,
      requiredN: el.quality.adequacy?.requiredN ?? null,
      sufficient: el.quality.adequacy?.sufficient === null || el.quality.adequacy?.sufficient === undefined ? null : el.quality.adequacy.sufficient ? "کافی" : "نیازمند مشاهده بیشتر",
      warnings: el.quality.warningsFa.join("؛") || "—",
    }));
    return {
      template,
      templateLabelFa: REPORT_TEMPLATE_LABELS_FA[template],
      columns: [
        { key: "elementKey", labelFa: "کلید عنصر" },
        { key: "element", labelFa: "عنصر" },
        { key: "n", labelFa: "n مؤثر" },
        { key: "cvPct", labelFa: "CV (٪)" },
        { key: "ciLevelPct", labelFa: "سطح اطمینان (٪)" },
        { key: "ciHalfSec", labelFa: "نیم‌عرض CI (s)" },
        { key: "requiredN", labelFa: "n لازم (ST-010)" },
        { key: "sufficient", labelFa: "قضاوت" },
        { key: "warnings", labelFa: "هشدارها" },
      ],
      rows,
      summaryFa: [...commonSummary, "CI و کفایت نمونه بر تقریب نرمال — فرض‌ها در راهنمای تحلیل ثبت شده‌اند."],
      trace: t,
      fileNameBase: `${analysis.projectCode}-sample-quality`,
    };
  }

  if (template === "standard-time") {
    const rows = analysis.elements.map((el) => ({
      elementKey: el.elementKey,
      element: el.elementName,
      n: el.counts.effective,
      repStatus: el.chain.representative.status,
      repSec: el.chain.representative.value !== null ? Number((el.chain.representative.value / 1000).toFixed(3)) : null,
      normalStatus: el.chain.normal.status,
      normalLabel: el.chain.normal.labelFa,
      normalSec: el.chain.normal.value !== null ? Number((el.chain.normal.value / 1000).toFixed(3)) : null,
      ratingPct: el.chain.normal.ratingFactorPct,
      stdStatus: el.chain.standard.status,
      stdSec: el.chain.standard.value !== null ? Number((el.chain.standard.value / 1000).toFixed(3)) : null,
      allowanceBase: el.chain.standard.baseFa,
      formulas: el.formulaTrace.filter((f) => f.formulaKey !== "—").map((f) => `${f.formulaKey}@${f.formulaSemver}`).join("،"),
    }));
    return {
      template,
      templateLabelFa: REPORT_TEMPLATE_LABELS_FA[template],
      columns: [
        { key: "elementKey", labelFa: "کلید عنصر" },
        { key: "element", labelFa: "عنصر" },
        { key: "n", labelFa: "n مؤثر" },
        { key: "repSec", labelFa: "زمان نماینده (s)" },
        { key: "repStatus", labelFa: "وضعیت نماینده" },
        { key: "normalSec", labelFa: "زمان نرمال/خام (s)" },
        { key: "normalLabel", labelFa: "برچسب نرمال" },
        { key: "normalStatus", labelFa: "وضعیت" },
        { key: "ratingPct", labelFa: "ضریب ارزیابی (٪)" },
        { key: "stdSec", labelFa: "زمان استاندارد (s)" },
        { key: "stdStatus", labelFa: "وضعیت استاندارد" },
        { key: "allowanceBase", labelFa: "پایه درصد مجاز" },
        { key: "formulas", labelFa: "فرمول‌ها (نسخه)" },
      ],
      rows,
      summaryFa: [...commonSummary, traceFootnote, `جمع استاندارد چرخه: ${analysis.standardCycle.totalMs !== null ? `${(analysis.standardCycle.totalMs / 1000).toFixed(3)}s` : "تکمیل‌نشده"} (${analysis.standardCycle.validElements} عنصر معتبر).`],
      trace: t,
      fileNameBase: `${analysis.projectCode}-standard-time`,
    };
  }

  // formula-outputs
  const rows: Array<Record<string, string | number | null>> = [];
  for (const el of analysis.elements) {
    for (const f of el.formulaTrace) {
      rows.push({
        elementKey: el.elementKey,
        element: el.elementName,
        formulaKey: f.formulaKey,
        formulaSemver: f.formulaSemver,
        status: f.status,
        valueSec: f.value !== null ? Number(f.value.toFixed(6)) : null,
        unit: f.unit,
        errors: f.errorsFa.join("؛") || "—",
      });
    }
  }
  return {
    template: "formula-outputs",
    templateLabelFa: REPORT_TEMPLATE_LABELS_FA["formula-outputs"],
    columns: [
      { key: "elementKey", labelFa: "کلید عنصر" },
      { key: "element", labelFa: "عنصر" },
      { key: "formulaKey", labelFa: "کلید فرمول" },
      { key: "formulaSemver", labelFa: "نسخه فرمول" },
      { key: "status", labelFa: "وضعیت" },
      { key: "valueSec", labelFa: "مقدار (s)" },
      { key: "unit", labelFa: "واحد" },
      { key: "errors", labelFa: "خطاها/هشدارها" },
    ],
    rows,
    summaryFa: [...commonSummary, traceFootnote],
    trace: t,
    fileNameBase: `${analysis.projectCode}-formula-outputs`,
  };
}

export interface ExportResult {
  format: ExportFormat;
  contentType: string;
  /** نام فایل با پسوند */
  fileName: string;
  /** محتوای باینری/متنی */
  body: string;
  /** شناسه رکورد CalculationResult ثبت‌شده (ردیابی خروجی) */
  resultId: string | null;
}

/** تولید خروجی + ذخیره رکورد ردیابی append-only + ممیزی (بند ۵/۸ فاز ۵). */
export async function exportReport(
  projectId: string,
  userId: string,
  template: ReportTemplate,
  format: ExportFormat,
): Promise<ExportResult> {
  const report = await buildReport(projectId, template);

  let contentType = "text/csv; charset=utf-8";
  let body = "";
  let ext = "csv";
  if (format === "csv") {
    body = buildCsvExport(report);
    contentType = "text/csv; charset=utf-8";
    ext = "csv";
  } else if (format === "xls") {
    body = buildXlsExport(report);
    contentType = "application/vnd.ms-excel; charset=utf-8";
    ext = "xls";
  } else {
    body = JSON.stringify(
      {
        format: "timing-analysis-report",
        formatVersion: "1",
        template: report.template,
        templateLabelFa: report.templateLabelFa,
        summaryFa: report.summaryFa,
        columns: report.columns,
        rows: report.rows,
        trace: report.trace,
        exportedAt: new Date().toISOString(),
      },
      null,
      2,
    );
    contentType = "application/json; charset=utf-8";
    ext = "json";
  }

  // ذخیره رکورد ردیابی (append-only) — هر خروجی مهم قابل ردیابی به ورودی/روش/نسخه (بند ۵)
  const resultId = uuidv7();
  await db.calculationResult.create({
    data: {
      id: resultId,
      projectId,
      formulaKey: `report.${report.template}`,
      formulaSemver: "1.0.0",
      configVersionId: report.trace.configVersionId ?? "",
      scopeType: "project",
      scopeId: "",
      valueJson: JSON.stringify({
        exportFormat: format,
        rowCount: report.rows.length,
        settings: report.trace.settings,
        formulaVersions: report.trace.formulaVersions,
        inputSummaryFa: report.trace.inputSummaryFa,
      }),
      status: "valid",
      errorsJson: "[]",
      traceJson: JSON.stringify({ generatedAt: report.trace.generatedAt, template: report.template, configSemver: report.trace.configSemver }),
      inputRefsJson: JSON.stringify(report.trace.formulaVersions.map((f) => f.key)),
      computedBy: userId,
    },
  });
  await recordAudit({
    userId,
    action: AUDIT_ACTIONS.analysisExported,
    entityType: "CalculationResult",
    entityId: resultId,
    projectId,
    after: { template, format, rows: report.rows.length, configSemver: report.trace.configSemver },
  });
  log.info("analysis exported", { projectId, template, format, rows: report.rows.length });

  return { format, contentType, fileName: `${report.fileNameBase}.${ext}`, body, resultId };
}

export { escapeCsv, escapeXml };

// ── صادرات قرارداد برای API (قاعده مرزها: API فقط application — الگوی فاز ۴) ──
export { markObservationSchema, sessionContextSchema, exportQuerySchema } from "../domain/analysis";
export type { MarkObservationInput, SessionContextInput } from "../domain/analysis";
export { REPORT_TEMPLATE_LABELS_FA } from "@/shared/contracts/analysis";
export type { ReportTemplate, ExportFormat } from "@/shared/contracts/analysis";
