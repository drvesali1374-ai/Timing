/**
 * لایه Application ماژول بالانس — فاز ۶ (B10).
 *
 *  - buildProblem: فعالیت‌های فعال + زمان‌ها از «موتور تحلیل فاز ۵» (زنجیره B4)
 *    یا بازتنظیم دستی سناریو؛ تاکت مستقیم/تقاضا؛ تخصیص مرجع وضع موجود.
 *  - سناریو CRUD + اجرای الگوریتم‌ها (shared/balance) + ذخیره append-only نتایج.
 *  - تخصیص دستی: اعتبارسنجی فوری — قیود سخت → رد با دلیل؛ قیود نرم → پرچم صادقانه.
 *  - خروجی CSV/XLS/JSON با ردیابی کامل (الگوی فاز ۵).
 *
 * قاعده صداقت: فعالیت بدون زمان معتبر هرگز عدد جعلی نمی‌گیرد (timeStatus=missing)
 * و از تخصیص کنار گذاشته می‌شود؛ «ایستگاه» و «نیروی شیفت» جدا گزارش می‌شوند.
 */

import { db } from "@/lib/db";
import { uuidv7 } from "@/shared/ids";
import { ApiError } from "@/shared/errors";
import { getLogger } from "@/shared/logger";
import { checkPrecedenceGraph } from "@/shared/balance/graph";
import { solveBalance, isBalanceAlgorithmId } from "@/shared/balance/algorithms";
import {
  BALANCE_WORK_TYPE_LABELS_FA,
  TIME_BASES,
  TIME_BASIS_LABELS_FA,
  isBalanceWorkType,
  type BalanceActivity,
  type BalanceProblem,
  type BalanceSolution,
  type PrecedenceGraphCheck,
  type TaktInput,
  type TimeBasis,
} from "@/shared/balance/types";
import { listActivities } from "@/modules/activities/application/activity-service";
import { listStations } from "@/modules/stations/application/station-service";
import { getAnalysis } from "@/modules/analysis/application/analysis-service";
import { recordAudit, AUDIT_ACTIONS } from "@/modules/audit/application/audit-service";
import type { ElementAnalysis } from "@/shared/analysis/types";
import type {
  BalanceOverviewDto,
  BalanceReadinessDto,
  BalanceResultDto,
  BalanceScenarioDetailDto,
  BalanceScenarioDto,
  BalanceScenarioInputs,
  BalanceExportResult,
  BalanceReportTemplate,
  BalanceExportFormat,
} from "@/shared/contracts/balance";
import {
  BALANCE_REPORT_TEMPLATE_LABELS_FA,
  BALANCE_EXPORT_FORMATS,
} from "@/shared/contracts/balance";
import type { CreateScenarioInput, ManualAssignmentInput, ScenarioInputsParsed, SolveInput, UpdateScenarioInput } from "../domain/balance";
import {
  countResultRows,
  findScenarioRow,
  insertResultRow,
  insertScenarioRow,
  latestResultRows,
  listResultRows,
  listScenarioRows,
  updateScenarioRow,
  type ResultRow,
  type ScenarioRow,
} from "../infrastructure/balance-repo";
import { buildXlsExport, escapeCsv } from "@/modules/analysis/application/export-builders";

const log = getLogger("balance");

// ─────────────────────── تبدیل‌ها ───────────────────────

function parseInputs(row: ScenarioRow): BalanceScenarioInputs {
  try {
    const raw = JSON.parse(row.inputsJson) as Partial<BalanceScenarioInputs>;
    return {
      timeBasis: (raw.timeBasis && TIME_BASES.includes(raw.timeBasis as TimeBasis) ? raw.timeBasis : "standard") as TimeBasis,
      takt: {
        taktMs: raw.takt?.taktMs ?? null,
        demandUnits: raw.takt?.demandUnits ?? null,
        netAvailableMsPerShift: raw.takt?.netAvailableMsPerShift ?? null,
        shiftsPerPeriod: raw.takt?.shiftsPerPeriod ?? null,
      },
      maxStations: raw.maxStations ?? null,
      objectives: {
        minimizeStations: raw.objectives?.minimizeStations ?? 0.4,
        smoothLoad: raw.objectives?.smoothLoad ?? 0.4,
        minChanges: raw.objectives?.minChanges ?? 0.2,
      },
      activityTimeOverrides: raw.activityTimeOverrides ?? {},
      referenceAssignment: raw.referenceAssignment ?? null,
    };
  } catch {
    // اسنپ‌شات خراب — پیش‌فرض صادقانه
    return {
      timeBasis: "standard",
      takt: { taktMs: null, demandUnits: null, netAvailableMsPerShift: null, shiftsPerPeriod: null },
      maxStations: null,
      objectives: { minimizeStations: 0.4, smoothLoad: 0.4, minChanges: 0.2 },
      activityTimeOverrides: {},
      referenceAssignment: null,
    };
  }
}

function toResultDto(row: ResultRow): BalanceResultDto {
  return {
    id: row.id,
    algorithm: row.algorithm as BalanceResultDto["algorithm"],
    algorithmLabelFa: row.algorithm === "lcr" ? "LCR — قاعده نامزد بزرگ"
      : row.algorithm === "rpw" ? "RPW — وزن موقعیتی رتبه‌بندی‌شده"
      : row.algorithm === "kilbridge-wester" ? "KW — کیلبریج–وستر"
      : "دستی — تخصیص کاربر",
    algorithmVersion: row.algorithmVersion,
    status: row.status as BalanceResultDto["status"],
    assignments: JSON.parse(row.assignmentsJson) as Record<string, number>,
    stations: JSON.parse(row.stationsJson) as BalanceResultDto["stations"],
    metrics: JSON.parse(row.metricsJson) as BalanceResultDto["metrics"],
    violations: JSON.parse(row.violationsJson) as BalanceResultDto["violations"],
    respectedConstraintsCount: 0, // از ردیف خوانده نمی‌شود — در solve مجدد حساب می‌شود؛ سمت DTO از JSON اصلی
    notesFa: row.notesJson ? (JSON.parse(row.notesJson) as string[]) : [],
    runMs: row.runMs,
    createdAt: row.createdAt.toISOString(),
  };
}

function toScenarioDto(row: ScenarioRow, resultCount: number, current: ResultRow | null): BalanceScenarioDto {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    status: row.status === "archived" ? "archived" : "active",
    inputs: parseInputs(row),
    notes: row.notes,
    resultCount,
    currentResult: current ? toResultDto(current) : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ─────────────────────── ساخت مسئله از داده پروژه ───────────────────────

/** استخراج زمان یک عنصر تحلیل بر مبنای انتخابی — صادقانه (null روی گام نامعتبر). */
function elementTimeMs(el: ElementAnalysis, basis: TimeBasis): { ms: number | null; sourceFa: string } {
  switch (basis) {
    case "observed": {
      const ms = el.stats.mean;
      return { ms, sourceFa: ms != null ? `میانگین ${el.counts.usable} مشاهده معتبر (B9)` : "بدون مشاهده معتبر" };
    }
    case "representative": {
      const ms = el.chain.representative.status === "valid" ? el.chain.representative.value : null;
      return { ms, sourceFa: ms != null ? "گام نماینده زنجیره B4" : `گام نماینده: ${el.chain.representative.status}` };
    }
    case "normal": {
      const ms = el.chain.normal.status === "valid" ? el.chain.normal.value : null;
      return { ms, sourceFa: ms != null ? "گام نرمال زنجیره B4 (با ارزیابی)" : `گام نرمال: ${el.chain.normal.status}` };
    }
    case "standard": {
      const ms = el.chain.standard.status === "valid" ? el.chain.standard.value : null;
      return { ms, sourceFa: ms != null ? "گام استاندارد زنجیره B4 (با هزینه‌مجوز)" : `گام استاندارد: ${el.chain.standard.status}` };
    }
    default:
      return { ms: null, sourceFa: "بدون منبع" };
  }
}

/** تاکت — مستقیم یا از تقاضا (فرمول مستند: Takt = زمان خالص در دسترس ÷ تقاضا). */
export function resolveTakt(takt: TaktInput): { taktMs: number; sourceFa: string; formulaFa: string | null; warningsFa: string[] } {
  const warningsFa: string[] = [];
  if (takt.taktMs != null && takt.taktMs > 0) {
    return { taktMs: takt.taktMs, sourceFa: "ورودی مستقیم سناریو", formulaFa: null, warningsFa };
  }
  const { demandUnits, netAvailableMsPerShift, shiftsPerPeriod } = takt;
  if (demandUnits != null && netAvailableMsPerShift != null && shiftsPerPeriod != null && demandUnits > 0) {
    const netTotal = netAvailableMsPerShift * shiftsPerPeriod;
    const taktMs = netTotal / demandUnits;
    if (taktMs <= 0) {
      throw ApiError.badRequest("تاکت محاسبه‌شده نامعتبر است (زمان در دسترس یا تقاضا را بررسی کنید).");
    }
    return {
      taktMs,
      sourceFa: `تقاضا ${demandUnits} واحد × ${shiftsPerPeriod} شیفت`,
      formulaFa: "Takt = (زمان خالص در دسترس هر شیفت × تعداد شیفت) ÷ تقاضا",
      warningsFa,
    };
  }
  throw ApiError.badRequest("تاکت تعریف نشده است — taktMs یا (تقاضا + زمان خالص + شیفت) لازم است.");
}

interface BuiltProblem {
  problem: BalanceProblem;
  graphCheck: PrecedenceGraphCheck;
}

/**
 * ساخت مسئله بالانس از: فعالیت‌های فعال + تحلیل فاز ۵ (زمان‌ها) + ورودی سناریو.
 * Cross-module از طریق application ماژول‌ها (قاعده مرزها — بدون دسترسی به infra دیگران).
 */
export async function buildProblem(projectId: string, inputs: ScenarioInputsParsed): Promise<BuiltProblem> {
  const [activityRows, analysis, stationRows] = await Promise.all([
    listActivities(projectId, false),
    getAnalysis(projectId),
    listStations(projectId, false),
  ]);

  const elementsByKey = new Map<string, ElementAnalysis>();
  for (const el of analysis.elements) {
    // elementKey == activityStableKey وقتی عناصر جلسه از فعالیت‌ها ساخته شده‌اند (فاز ۴)
    elementsByKey.set(el.elementKey, el);
  }

  // ایندکس ایستگاه‌های واقعی (۱-مبا) — مرجع تخصیص فعلی خط (ADR-017)
  const stationIndexById = new Map<string, number>();
  stationRows.forEach((s, i) => stationIndexById.set(s.id, i + 1));

  const activities: BalanceActivity[] = activityRows.map((row) => {
    const workType = isBalanceWorkType(row.workType) ? row.workType : "operatorManual";
    const overrideMs = inputs.activityTimeOverrides[row.stableKey];
    let timeMs: number | null = null;
    let timeSource: BalanceActivity["timeSource"] = "missing";
    let timeSourceFa = "بدون زمان معتبر";

    if (overrideMs != null && overrideMs > 0) {
      timeMs = overrideMs;
      timeSource = "override";
      timeSourceFa = "بازتنظیم دستی سناریو";
    } else if (inputs.timeBasis !== "override") {
      const el = elementsByKey.get(row.stableKey);
      if (el) {
        const { ms, sourceFa } = elementTimeMs(el, inputs.timeBasis);
        if (ms != null && ms > 0) {
          timeMs = ms;
          timeSource = "analysis";
          timeSourceFa = `تحلیل فاز ۵ — ${TIME_BASIS_LABELS_FA[inputs.timeBasis]} (${sourceFa})`;
        } else {
          timeSourceFa = `تحلیل موجود ولی گام «${TIME_BASIS_LABELS_FA[inputs.timeBasis]}» نامعتبر: ${sourceFa}`;
        }
      } else {
        timeSourceFa = "فعالیت در جلسات زمان‌سنجی اندازه‌گیری نشده است";
      }
    } else {
      timeSourceFa = "مبنای «بازتنظیم دستی» — مقداری برای این فعالیت ثبت نشده است";
    }

    // ناسازگاری‌ها از DTO فعالیت (B5/B10 — تجزیه در application فعالیت‌ها)
    const incompatibleWith = row.constraints?.incompatibleWith ?? [];
    const predecessors = row.predecessors;
    // اولویت: ایستگاه واقعی متصل (ADR-017)؛ در غیاب آن، تفسیر عددی stationHint میراثی
    const stationIdx = row.stationId ? (stationIndexById.get(row.stationId) ?? null) : null;
    const hint = stationIdx ?? (row.stationHint ? Number.parseInt(row.stationHint, 10) : null);

    return {
      id: row.stableKey,
      name: row.name,
      timeMs: timeMs ?? 0,
      workType,
      predecessors,
      stationHint: hint !== null && Number.isFinite(hint) && hint >= 1 ? hint : null,
      incompatibleWith,
      timeSource,
      timeStatus: timeMs != null && timeMs > 0 ? "valid" : "missing",
      timeSourceFa,
    };
  });

  const takt = resolveTakt(inputs.takt as TaktInput);
  const graphCheck = checkPrecedenceGraph(activities.map((a) => ({ id: a.id, predecessors: a.predecessors })));

  const problem: BalanceProblem = {
    activities,
    taktMs: takt.taktMs,
    taktSourceFa: takt.formulaFa ? `${takt.sourceFa} — ${takt.formulaFa}` : takt.sourceFa,
    maxStations: inputs.maxStations ?? null,
    objectives: inputs.objectives,
    referenceAssignment: inputs.referenceAssignment ?? null,
  };

  return { problem, graphCheck };
}

// ─────────────────────── نمای کلی ───────────────────────

export async function getBalanceOverview(projectId: string): Promise<BalanceOverviewDto> {
  const [rows, activityRows, analysis] = await Promise.all([
    listScenarioRows(projectId, true),
    listActivities(projectId, false),
    getAnalysis(projectId),
  ]);

  const counts = await countResultRows(rows.map((r) => r.id));
  const latest = await latestResultRows(rows.map((r) => r.id));

  const elementsByKey = new Set(analysis.elements.map((el) => el.elementKey));
  const withTime: Record<TimeBasis, number> = { observed: 0, representative: 0, normal: 0, standard: 0, override: 0 };
  for (const row of activityRows) {
    const el = analysis.elements.find((e) => e.elementKey === row.stableKey);
    if (!el) continue;
    if (el.stats.mean != null) withTime.observed += 1;
    if (el.chain.representative.status === "valid") withTime.representative += 1;
    if (el.chain.normal.status === "valid") withTime.normal += 1;
    if (el.chain.standard.status === "valid") withTime.standard += 1;
  }

  const graphCheck = checkPrecedenceGraph(
    activityRows.map((r) => ({ id: r.stableKey, predecessors: r.predecessors })),
  );

  const readiness: BalanceReadinessDto = {
    activitiesTotal: activityRows.length,
    activitiesActive: activityRows.length,
    activitiesWithTime: withTime,
    finalizedSessions: analysis.sessions.length,
    graphCheck,
  };

  const scenarios = rows.map((r) => toScenarioDto(r, counts.get(r.id) ?? 0, latest.get(r.id) ?? null));

  const activities = activityRows.map((r) => ({
    id: r.stableKey,
    name: r.name,
    workType: r.workType,
    workTypeLabelFa: isBalanceWorkType(r.workType) ? BALANCE_WORK_TYPE_LABELS_FA[r.workType] : r.workType,
    predecessors: r.predecessors,
    hasAnalysisTime: elementsByKey.has(r.stableKey),
  }));

  return { projectId, scenarios, readiness, activities };
}

// ─────────────────────── CRUD سناریو ───────────────────────

export async function createScenario(
  projectId: string,
  userId: string,
  input: CreateScenarioInput,
): Promise<BalanceScenarioDetailDto> {
  // اعتبارسنجی زودهنگام تاکت (خطای شفاف به‌جای ذخیره ورودی بی‌تاکت)
  resolveTakt(input.inputs.takt as TaktInput);
  const row = await insertScenarioRow({
    id: uuidv7(),
    projectId,
    name: input.name,
    inputsJson: JSON.stringify(input.inputs),
    notes: input.notes ?? null,
    createdBy: userId,
  });
  await recordAudit({
    userId,
    projectId,
    action: AUDIT_ACTIONS.balanceScenarioCreated,
    entityType: "balance-scenario",
    entityId: row.id,
    after: { name: input.name },
  });
  log.info("scenario created", { projectId, scenarioId: row.id });
  return getScenarioDetail(projectId, row.id);
}

export async function getScenarioDetail(projectId: string, scenarioId: string): Promise<BalanceScenarioDetailDto> {
  const row = await findScenarioRow(projectId, scenarioId);
  if (!row) throw ApiError.notFound("سناریوی بالانس یافت نشد.");
  const results = await listResultRows(scenarioId);
  const inputs = parseInputs(row);
  const { problem, graphCheck } = await buildProblem(projectId, inputs);
  const resultDtos = results.map(toResultDto);
  return {
    scenario: toScenarioDto(row, results.length, results[0] ?? null),
    problem: {
      activities: problem.activities,
      taktMs: problem.taktMs,
      taktSourceFa: problem.taktSourceFa,
      maxStations: problem.maxStations,
      objectives: problem.objectives,
      graphCheck,
    },
    currentResult: resultDtos[0] ?? null,
    results: resultDtos,
  };
}

export async function updateScenario(
  projectId: string,
  scenarioId: string,
  userId: string,
  input: UpdateScenarioInput,
): Promise<BalanceScenarioDetailDto> {
  const row = await findScenarioRow(projectId, scenarioId);
  if (!row) throw ApiError.notFound("سناریوی بالانس یافت نشد.");
  if (input.inputs) resolveTakt(input.inputs.takt as TaktInput);
  const updated = await updateScenarioRow(scenarioId, {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.inputs !== undefined ? { inputsJson: JSON.stringify(input.inputs) } : {}),
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
  });
  await recordAudit({
    userId,
    projectId,
    action: AUDIT_ACTIONS.balanceScenarioUpdated,
    entityType: "balance-scenario",
    entityId: scenarioId,
    before: { name: row.name, status: row.status },
    after: { name: updated.name, status: updated.status },
  });
  return getScenarioDetail(projectId, scenarioId);
}

// ─────────────────────── اجرا / تخصیص دستی ───────────────────────

async function persistSolution(
  projectId: string,
  scenarioId: string,
  userId: string,
  solution: BalanceSolution,
): Promise<BalanceResultDto> {
  const row = await insertResultRow({
    id: uuidv7(),
    scenarioId,
    algorithm: solution.algorithm,
    algorithmVersion: solution.algorithmVersion,
    status: solution.status,
    assignmentsJson: JSON.stringify(solution.assignments),
    stationsJson: JSON.stringify(solution.stations),
    metricsJson: JSON.stringify(solution.metrics),
    violationsJson: JSON.stringify(solution.violations),
    notesJson: JSON.stringify(solution.notesFa),
    objectiveValue: solution.metrics.objectiveValue,
    runMs: solution.runMs,
    createdBy: userId,
  });
  const dto = toResultDto(row);
  dto.respectedConstraintsCount = solution.respectedConstraintsCount;
  return dto;
}

export async function solveScenario(
  projectId: string,
  scenarioId: string,
  userId: string,
  input: SolveInput,
): Promise<BalanceResultDto> {
  const row = await findScenarioRow(projectId, scenarioId);
  if (!row) throw ApiError.notFound("سناریوی بالانس یافت نشد.");
  if (!isBalanceAlgorithmId(input.algorithm)) {
    throw ApiError.badRequest("الگوریتم نامعتبر است.");
  }
  if (input.algorithm === "manual") {
    throw ApiError.badRequest("برای تخصیص دستی از مسیر assignment استفاده کنید.");
  }
  const inputs = parseInputs(row);
  const { problem } = await buildProblem(projectId, inputs);
  const solution = solveBalance(problem, {
    algorithm: input.algorithm,
    timeBudgetMs: input.timeBudgetMs,
  });
  const dto = await persistSolution(projectId, scenarioId, userId, solution);
  await recordAudit({
    userId,
    projectId,
    action: AUDIT_ACTIONS.balanceSolved,
    entityType: "balance-scenario",
    entityId: scenarioId,
    after: { algorithm: solution.algorithm, status: solution.status, stations: solution.metrics.stationCount },
  });
  log.info("balance solved", { projectId, scenarioId, algorithm: solution.algorithm, ms: solution.runMs });
  return dto;
}

const HARD_CODES = new Set(["precedence", "unknown-activity", "incompatible", "missing-activity", "duplicate-assignment"]);

export async function saveManualAssignment(
  projectId: string,
  scenarioId: string,
  userId: string,
  input: ManualAssignmentInput,
): Promise<{ result: BalanceResultDto; hardViolationsFa: string[] }> {
  const row = await findScenarioRow(projectId, scenarioId);
  if (!row) throw ApiError.notFound("سناریوی بالانس یافت نشد.");
  const inputs = parseInputs(row);
  const { problem } = await buildProblem(projectId, inputs);

  // اعتبارسنجی فوری (بند ۹): قیود سخت → رد با دلیل — هرگز بی‌هشدار پذیرفته نمی‌شود
  const hard = Object.entries(input.assignments).filter(([, st]) => !Number.isInteger(st) || st < 1);
  if (hard.length > 0) {
    throw ApiError.badRequest("ایستگاه باید عدد صحیح ≥ ۱ باشد.", {
      fields: hard.slice(0, 10).map(([id]) => ({ path: id, message: "شماره ایستگاه نامعتبر" })),
    });
  }

  const solution = solveBalance(problem, { algorithm: "manual", assignment: input.assignments });
  const hardViolations = solution.violations.filter((v) => HARD_CODES.has(v.code));
  if (hardViolations.length > 0) {
    // ۴۲۲: تخصیص نامعتبر — ذخیره نشد؛ دلیل هر نقض صریح
    throw new ApiError(422, "invalid_assignment", "تخصیص دستی نامعتبر است — قیود سخت نقض شده‌اند.", {
      violations: hardViolations.map((v) => v.messageFa),
    });
  }

  const dto = await persistSolution(projectId, scenarioId, userId, solution);
  await recordAudit({
    userId,
    projectId,
    action: AUDIT_ACTIONS.balanceManualSaved,
    entityType: "balance-scenario",
    entityId: scenarioId,
    after: { stations: solution.metrics.stationCount, flags: solution.violations.length },
  });
  log.info("manual assignment saved", { projectId, scenarioId, stations: solution.metrics.stationCount });
  return { result: dto, hardViolationsFa: [] };
}

export async function listResults(projectId: string, scenarioId: string): Promise<BalanceResultDto[]> {
  const row = await findScenarioRow(projectId, scenarioId);
  if (!row) throw ApiError.notFound("سناریوی بالانس یافت نشد.");
  const results = await listResultRows(scenarioId);
  return results.map(toResultDto);
}

// ─────────────────────── خروجی/گزارش ───────────────────────

interface ReportTable {
  columns: Array<{ key: string; labelFa: string }>;
  rows: Array<Record<string, string | number | null>>;
  summaryFa: string[];
}

function fmtMs(ms: number | null | undefined): string {
  if (ms == null) return "—";
  return `${(ms / 1000).toLocaleString("fa-IR", { maximumFractionDigits: 2 })} ث`;
}

function fmtPct(p: number | null | undefined): string {
  if (p == null) return "—";
  return `${p.toLocaleString("fa-IR", { maximumFractionDigits: 1 })}٪`;
}

export async function exportScenarioReport(
  projectId: string,
  scenarioId: string,
  template: BalanceReportTemplate,
  format: BalanceExportFormat,
): Promise<BalanceExportResult> {
  if (!BALANCE_EXPORT_FORMATS.includes(format)) {
    throw ApiError.badRequest("قالب خروجی نامعتبر است (csv/xls/json).");
  }
  const detail = await getScenarioDetail(projectId, scenarioId);
  const current = detail.currentResult;
  const byId = new Map(detail.problem.activities.map((a) => [a.id, a]));

  const traceFa = [
    `سناریو: ${detail.scenario.name}`,
    `تاکت: ${fmtMs(detail.problem.taktMs)} (${detail.problem.taktSourceFa})`,
    `مبنای زمان: ${TIME_BASIS_LABELS_FA[detail.scenario.inputs.timeBasis]}`,
    current ? `الگوریتم جاری: ${current.algorithmLabelFa} نسخه ${current.algorithmVersion}` : "بدون نتیجه ذخیره‌شده",
    `تولید: ${new Date().toLocaleString("fa-IR")}`,
  ];

  let table: ReportTable;
  if (template === "station-assignments") {
    table = {
      columns: [
        { key: "station", labelFa: "ایستگاه" },
        { key: "activityId", labelFa: "کلید فعالیت" },
        { key: "activityName", labelFa: "نام فعالیت" },
        { key: "workType", labelFa: "نوع کار" },
        { key: "timeMs", labelFa: "زمان (ثانیه)" },
        { key: "source", labelFa: "منبع زمان" },
      ],
      rows: [],
      summaryFa: traceFa,
    };
    if (current) {
      for (const st of current.stations) {
        for (const id of st.activityIds) {
          const a = byId.get(id);
          table.rows.push({
            station: st.station,
            activityId: id,
            activityName: a?.name ?? id,
            workType: a ? BALANCE_WORK_TYPE_LABELS_FA[a.workType] : "—",
            timeMs: a ? Math.round(a.timeMs) / 1000 : null,
            source: a?.timeSourceFa ?? "—",
          });
        }
      }
    }
  } else if (template === "scenario-comparison") {
    table = {
      columns: [
        { key: "label", labelFa: "راهکار" },
        { key: "algorithm", labelFa: "الگوریتم" },
        { key: "stations", labelFa: "ایستگاه" },
        { key: "bottleneck", labelFa: "گلوگاه (ثانیه)" },
        { key: "efficiency", labelFa: "راندمان E" },
        { key: "delay", labelFa: "تأخیر d" },
        { key: "idle", labelFa: "بیکاری کل (ثانیه)" },
        { key: "operators", labelFa: "نیروی عملیاتی" },
        { key: "objective", labelFa: "تابع هدف" },
      ],
      rows: detail.results.map((r, i) => ({
        label: i === 0 ? `${r.algorithmLabelFa} (جاری)` : r.algorithmLabelFa,
        algorithm: `${r.algorithm} ${r.algorithmVersion}`,
        stations: r.metrics.stationCount,
        bottleneck: Math.round(r.metrics.bottleneckMs) / 1000,
        efficiency: r.metrics.efficiencyPct != null ? Math.round(r.metrics.efficiencyPct * 10) / 10 : null,
        delay: r.metrics.delayPct != null ? Math.round(r.metrics.delayPct * 10) / 10 : null,
        idle: Math.round(r.metrics.totalIdleMs) / 1000,
        operators: r.metrics.operationalOperators,
        objective: r.metrics.objectiveValue != null ? Math.round(r.metrics.objectiveValue * 1000) / 1000 : null,
      })),
      summaryFa: [
        ...traceFa,
        "مقایسه همه نتایج ذخیره‌شده این سناریو (تاریخچه append-only) — «بهترین راهکار یافت‌شده»، نه بهینه قطعی.",
      ],
    };
  } else {
    // balance-summary
    table = {
      columns: [
        { key: "metric", labelFa: "شاخص" },
        { key: "value", labelFa: "مقدار" },
        { key: "formula", labelFa: "فرمول/مخرج" },
      ],
      rows: current
        ? [
            { metric: "تعداد ایستگاه (m)", value: current.metrics.stationCount, formula: "ایستگاه‌های غیرخالی" },
            { metric: "گلوگاه (C)", value: fmtMs(current.metrics.bottleneckMs), formula: "max بار سریال ایستگاه‌ها" },
            { metric: "راندمان بالانس (E)", value: fmtPct(current.metrics.efficiencyPct), formula: "ΣT سریال ÷ (m × C)" },
            { metric: "تأخیر بالانس (d)", value: fmtPct(current.metrics.delayPct), formula: "۱ − E" },
            { metric: "حداقل نظری ایستگاه", value: current.metrics.minStationsTheoretical ?? "—", formula: "ceil(ΣT سریال ÷ تاکت)" },
            { metric: "بیکاری کل", value: fmtMs(current.metrics.totalIdleMs), formula: "Σ(تاکت − بار ایستگاه)" },
            { metric: "نیروی نظری هر شیفت", value: current.metrics.theoreticalOperators ?? "—", formula: "ceil(ΣT اپراتور ÷ تاکت)" },
            { metric: "نیروی عملیاتی", value: current.metrics.operationalOperators, formula: "فرض ۱ اپراتور/ایستگاه" },
            { metric: "اشتغال اپراتور", value: fmtPct(current.metrics.operatorUtilizationPct), formula: "ΣT اپراتور ÷ (m × تاکت)" },
            { metric: "زمان هم‌پوشان (جمع‌نشده)", value: fmtMs(current.metrics.totalOverlapMs), formula: "گزارش جدا — فرض هم‌زمانی" },
          ]
        : [],
      summaryFa: [
        ...traceFa,
        ...current?.notesFa.map((n) => `یادداشت: ${n}`) ?? [],
        ...(current?.violations.length ? current.violations.map((v) => `هشدار قید: ${v.messageFa}`) : ["بدون نقض قید گزارش‌شده."]),
      ],
    };
  }

  const templateLabelFa = BALANCE_REPORT_TEMPLATE_LABELS_FA[template];
  const fileNameBase = `balance-${template}-${new Date().toISOString().slice(0, 10)}`;

  // شکل هم‌ارز ReportExportShape فاز ۵ — trace با نسخه الگوریتم به‌جای فرمول
  const exportShape = {
    template: template as string,
    templateLabelFa,
    columns: table.columns as Array<{ key: string; labelFa: string }>,
    rows: table.rows as Array<Record<string, string | number | null>>,
    summaryFa: table.summaryFa,
    trace: {
      configSemver: null,
      generatedAt: new Date().toISOString(),
      formulaVersions: detail.currentResult
        ? [{ key: `balance.${detail.currentResult.algorithm}`, semver: detail.currentResult.algorithmVersion }]
        : [],
    },
  };

  if (format === "csv") {
    const header = table.columns.map((c) => escapeCsv(c.labelFa)).join(",");
    const lines = table.rows.map((r) => table.columns.map((c) => escapeCsv(r[c.key] ?? "")).join(","));
    const foot = table.summaryFa.map((s) => `# ${s}`);
    const body = `\uFEFF${[header, ...lines, "", ...foot].join("\r\n")}\r\n`;
    return { format, contentType: "text/csv; charset=utf-8", fileName: `${fileNameBase}.csv`, body };
  }
  if (format === "xls") {
    const body = buildXlsExport(exportShape);
    return { format, contentType: "application/vnd.ms-excel; charset=utf-8", fileName: `${fileNameBase}.xls`, body };
  }
  return {
    format: "json",
    contentType: "application/json; charset=utf-8",
    fileName: `${fileNameBase}.json`,
    body: JSON.stringify(
      {
        template,
        templateLabelFa,
        columns: table.columns,
        rows: table.rows,
        summaryFa: table.summaryFa,
        trace: exportShape.trace,
        scenario: { id: detail.scenario.id, name: detail.scenario.name, inputs: detail.scenario.inputs },
        problem: {
          taktMs: detail.problem.taktMs,
          taktSourceFa: detail.problem.taktSourceFa,
          activities: detail.problem.activities,
          graphCheck: detail.problem.graphCheck,
        },
        results: detail.results,
      },
      null,
      2,
    ),
  };
}

// ثبت CalculationResult برای خروجی‌ها (شاهد فاز ۵ — الگوی ممیزی خروجی)
export async function recordBalanceExport(
  projectId: string,
  userId: string,
  scenarioId: string,
  template: string,
  format: string,
  rowCount: number,
): Promise<void> {
  const resultId = uuidv7();
  await db.calculationResult.create({
    data: {
      id: resultId,
      projectId,
      formulaKey: `report.balance.${template}`,
      formulaSemver: "1.0.0",
      configVersionId: "",
      scopeType: "project",
      scopeId: scenarioId,
      valueJson: JSON.stringify({ exportFormat: format, rowCount, scenarioId }),
      status: "valid",
      errorsJson: "[]",
      traceJson: JSON.stringify({ generatedAt: new Date().toISOString(), template, module: "balance" }),
      inputRefsJson: "[]",
      computedBy: userId,
    },
  });
  await recordAudit({
    userId,
    projectId,
    action: AUDIT_ACTIONS.balanceExported,
    entityType: "balance-scenario",
    entityId: scenarioId,
    after: { template, format, resultId },
  });
  log.info("balance export recorded", { projectId, scenarioId, format });
}

export { escapeCsv };

// صادرات اسکیماهای مرز API از لایه application (قاعده مرزها — الگوی فاز ۵)
export { createScenarioSchema, updateScenarioSchema, solveSchema, manualAssignmentSchema } from "../domain/balance";
