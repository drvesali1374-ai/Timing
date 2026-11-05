// ═══════════════════════════════════════════════════════════
// سرویس Snapshot محاسبات — FR-27
// • اجرای محاسبهٔ کامل پروژه و ثبت نتیجه به‌صورت نسخهٔ
//   snapshot با نسخهٔ فرمول و تنظیمات مورد استفاده
// • snapshot های قبلی حذف نمی‌شوند (تاریخ قابل بازتولید)
// • تغییر پارامتر مؤثر → وضعیت STALE (نیازمند محاسبهٔ مجدد)؛
//   خود نتیجهٔ قبلی حفظ می‌شود
// ═══════════════════════════════════════════════════════════
import { db } from '@/lib/db'
import {
  AppError,
  FORMULA_VERSION,
  PROJECT_SETTING_KEYS,
  DEFAULT_PROJECT_SETTINGS,
  ALLOWANCE_METHOD_LABELS,
  AGGREGATION_METHOD_LABELS,
  type AllowanceMethod,
  type AggregationMethod,
} from '@/domain/types'
import { recordAudit } from '@/infrastructure/audit'
import { getProjectSettings } from './settings-service'
import { getOutlierConfig } from './outlier-service'
import { getActivityAnalysis, type ActivityAnalysisDto } from './analysis-service'

export interface CalculationRunDto {
  id: string
  createdAt: string
  status: 'PENDING' | 'DONE' | 'STALE'
  formulaVersion: string
  settings: Record<string, unknown>
  result: Record<string, unknown> | null
}

export interface LatestCalculationDto {
  run: CalculationRunDto | null
  /** آیا دادهٔ محاسبه‌پذیری وجود دارد و snapshot به‌روز نیست؟ */
  needsRecalc: boolean
  hasAnyData: boolean
  runsCount: number
}

/** خلاصهٔ فشردهٔ تحلیل یک فعالیت برای snapshot (بدون سری‌های نمودار) */
function compactActivity(a: ActivityAnalysisDto) {
  return {
    id: a.activity.id,
    name: a.activity.name,
    stationName: a.activity.stationName,
    groupName: a.activity.groupName,
    sampleProgress: {
      validCycles: a.sampleProgress.validCycles,
      totalCycles: a.sampleProgress.totalCycles,
      targetSampleCount: a.sampleProgress.targetSampleCount,
    },
    totalA: a.allowances.totalA,
    activityTotal: { st: a.activityTotal.st, status: a.activityTotal.status },
    elements: a.elements.map((e) => ({
      id: e.id,
      name: e.name,
      elementType: e.elementType,
      counts: { calcBasis: e.counts.calcBasis, suspect: e.counts.suspect, excluded: e.counts.excluded },
      ot: e.ot,
      nt: e.nt,
      st: e.st,
      stError: e.stError,
      ratingFactor: e.rating?.totalFactor ?? null,
    })),
    cycleStats: { count: a.cycleStats.count, mean: a.cycleStats.stats.mean },
  }
}

/** اجرای محاسبهٔ کامل پروژه و ثبت snapshot نسخه‌دار — FR-27 */
export async function runProjectCalculation(projectId: string) {
  const project = await db.project.findUnique({ where: { id: projectId }, select: { id: true, name: true } })
  if (!project) throw new AppError('PROJECT_NOT_FOUND', 'پروژه یافت نشد.', 404)

  const [settingsRaw, outlierConfig] = await Promise.all([getProjectSettings(projectId), getOutlierConfig()])
  const allowanceMethod = (settingsRaw[PROJECT_SETTING_KEYS.allowanceMethod] ??
    DEFAULT_PROJECT_SETTINGS[PROJECT_SETTING_KEYS.allowanceMethod]) as AllowanceMethod
  const aggregationMethod = (settingsRaw[PROJECT_SETTING_KEYS.aggregationMethod] ??
    DEFAULT_PROJECT_SETTINGS[PROJECT_SETTING_KEYS.aggregationMethod]) as AggregationMethod

  const activities = await db.activity.findMany({
    where: { station: { projectId } },
    orderBy: [{ station: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
    select: { id: true },
  })

  const analyses: ActivityAnalysisDto[] = []
  for (const a of activities) {
    analyses.push(await getActivityAnalysis(a.id))
  }

  const settingsSnapshot = {
    allowanceMethod,
    allowanceMethodLabel: ALLOWANCE_METHOD_LABELS[allowanceMethod],
    aggregationMethod,
    aggregationMethodLabel: AGGREGATION_METHOD_LABELS[aggregationMethod],
    outlierMethod: outlierConfig.methodKey === 'iqr' ? 'iqr' : 'mad',
    outlierThreshold: outlierConfig.thresholdKey,
    formulaVersion: FORMULA_VERSION,
    generatedAt: new Date().toISOString(),
  }
  const resultSnapshot = {
    activities: analyses.map(compactActivity),
    summary: {
      activitiesCount: analyses.length,
      needsAggregationRule: analyses.filter((a) => a.activityTotal.status === 'NEEDS_AGGREGATION_RULE').length,
      incomplete: analyses.filter((a) => a.activityTotal.status === 'INCOMPLETE').length,
      totalSuspects: analyses.reduce((s, a) => s + a.suspects.filter((x) => x.validityStatus === 'SUSPECT').length, 0),
    },
  }

  const run = await db.calculationRun.create({
    data: {
      projectId,
      formulaVersion: FORMULA_VERSION,
      settingsSnapshot: JSON.stringify(settingsSnapshot),
      resultSnapshot: JSON.stringify(resultSnapshot),
      status: 'DONE',
    },
  })

  await recordAudit({
    entityType: 'CalculationRun',
    entityId: run.id,
    action: 'CREATE',
    entityName: `اجرای محاسبهٔ پروژه «${project.name}»`,
    after: { activitiesCount: analyses.length, formulaVersion: FORMULA_VERSION },
    projectId,
  })

  return {
    id: run.id,
    createdAt: run.createdAt.toISOString(),
    status: run.status as CalculationRunDto['status'],
    formulaVersion: run.formulaVersion,
    settings: settingsSnapshot,
    result: resultSnapshot as unknown as Record<string, unknown>,
  }
}

/** آخرین snapshot + وضعیت تازگی — FR-27 */
export async function getLatestCalculation(projectId: string): Promise<LatestCalculationDto> {
  const project = await db.project.findUnique({ where: { id: projectId }, select: { id: true } })
  if (!project) throw new AppError('PROJECT_NOT_FOUND', 'پروژه یافت نشد.', 404)

  const [latest, runsCount, sessionsCount] = await Promise.all([
    db.calculationRun.findFirst({ where: { projectId }, orderBy: { createdAt: 'desc' } }),
    db.calculationRun.count({ where: { projectId } }),
    db.studySession.count({ where: { activity: { station: { projectId } } } }),
  ])

  const hasAnyData = sessionsCount > 0
  let run: CalculationRunDto | null = null
  if (latest) {
    run = {
      id: latest.id,
      createdAt: latest.createdAt.toISOString(),
      status: latest.status as CalculationRunDto['status'],
      formulaVersion: latest.formulaVersion,
      settings: safeParse(latest.settingsSnapshot),
      result: latest.resultSnapshot ? (safeParse(latest.resultSnapshot) as Record<string, unknown>) : null,
    }
  }

  const needsRecalc = run === null ? hasAnyData : run.status === 'STALE'

  return { run, needsRecalc, hasAnyData, runsCount }
}

function safeParse(json: string): Record<string, unknown> {
  try {
    return JSON.parse(json) as Record<string, unknown>
  } catch {
    return {}
  }
}
