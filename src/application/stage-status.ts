// ═══════════════════════════════════════════════════════════
// سرویس وضعیت مراحل مطالعه — ۷.۲ / FR-03
// وضعیت چهارگانه از داده واقعی محاسبه می‌شود:
// انجام‌نشده / در حال انجام / تکمیل‌شده / نیازمند بررسی
// مراحل فازهای بعدی با برچسب صادقانه «فاز بعدی» نمایش داده می‌شوند.
// ═══════════════════════════════════════════════════════════
import { db } from '@/lib/db'
import { DEVELOPMENT_PHASES, type StageKey, type StageStatus } from '@/domain/types'

export interface StageState {
  status: StageStatus | 'FUTURE_PHASE'
  phase?: number
  hint: string
}

export interface StageSummary {
  stages: Record<string, StageState>
  /** پیشرفت شفاف مطالعه: میانگین وزن مراحل فعال (تکمیل=۱، در حال انجام=۰٫۵) */
  progress: number
  counts: {
    stations: number
    activities: number
    elements: number
    operators: number
    groups: number
    categories: number
    elementsWithRating: number
    finalized: boolean
  }
}

export async function computeStageSummary(projectId: string): Promise<StageSummary> {
  const [project, stations, activities, elements, operators, groups, categories, assessments, sessions, validCycles] =
    await Promise.all([
      db.project.findUnique({ where: { id: projectId }, select: { studyDate: true, finalization: true } }),
      db.station.findMany({ where: { projectId }, select: { id: true } }),
      db.activity.findMany({
        where: { station: { projectId } },
        select: { id: true, groupId: true, targetSampleCount: true },
      }),
      db.workElement.findMany({
        where: { activity: { station: { projectId } } },
        select: { id: true, activityId: true },
      }),
      db.operator.findMany({ where: { projectId }, select: { id: true } }),
      db.activityGroup.findMany({
        where: { projectId },
        include: { groupAllowances: { select: { id: true, category: { select: { isActive: true } } } } },
      }),
      db.allowanceCategory.findMany({ where: { projectId }, select: { id: true, isActive: true } }),
      db.ratingAssessment.findMany({
        where: { workElement: { activity: { station: { projectId } } } },
        select: { id: true },
      }),
      db.studySession.findMany({
        where: { activity: { station: { projectId } } },
        select: { id: true, activityId: true },
      }),
      db.cycleObservation.count({
        where: {
          isComplete: true,
          session: { activity: { station: { projectId } } },
          observations: { none: { validityStatus: { in: ['EXCLUDED', 'INVALID'] } } },
        },
      }),
    ])

  const stationCount = stations.length
  const activityCount = activities.length
  const elementCount = elements.length
  const elementsWithRating = assessments.length
  const finalized = Boolean(project?.finalization)

  const activitiesWithoutElements = await db.activity.findMany({
    where: { station: { projectId }, workElements: { none: {} } },
    select: { id: true },
  })

  const stages: Record<string, StageState> = {}

  // مشخصات پروژه
  stages.info = {
    status: project?.studyDate ? 'DONE' : 'IN_PROGRESS',
    hint: project?.studyDate
      ? 'مشخصات اصلی پروژه تکمیل شده است.'
      : 'تاریخ مطالعه را در مشخصات پروژه ثبت کنید.',
  }

  // ساختار تولید
  if (stationCount === 0) {
    stages.structure = { status: 'PENDING', hint: 'هنوز ایستگاهی ثبت نشده است.' }
  } else if (activityCount === 0) {
    stages.structure = { status: 'IN_PROGRESS', hint: 'برای ایستگاه‌ها فعالیت ثبت کنید.' }
  } else if (activitiesWithoutElements.length > 0) {
    stages.structure = {
      status: 'NEEDS_REVIEW',
      hint: `${activitiesWithoutElements.length} فعالیت بدون عنصر کاری است؛ عناصر را تکمیل کنید.`,
    }
  } else {
    stages.structure = { status: 'DONE', hint: 'ساختار خط، ایستگاه‌ها و فعالیت‌ها کامل است.' }
  }

  // اپراتورها
  stages.operators = operators.length
    ? { status: 'DONE', hint: 'اپراتورهای مطالعه ثبت شده‌اند.' }
    : { status: 'PENDING', hint: 'حداقل یک اپراتور برای زمان‌سنجی لازم است.' }

  // گروه‌ها و مجازها
  const activeCategories = categories.filter((c) => c.isActive).length
  if (activeCategories === 0 && groups.length === 0) {
    stages.allowances = { status: 'PENDING', hint: 'دسته مجاز و گروه فعالیت تعریف نشده است.' }
  } else if (groups.length === 0) {
    stages.allowances = { status: 'IN_PROGRESS', hint: 'دسته‌ها ثبت شده؛ گروه فعالیت بسازید.' }
  } else {
    const groupsWithoutValues = groups.filter(
      (g) => g.groupAllowances.filter((ga) => ga.category.isActive).length === 0
    ).length
    stages.allowances =
      groupsWithoutValues > 0
        ? {
            status: 'IN_PROGRESS',
            hint: `${groupsWithoutValues} گروه بدون مقدار مجاز فعال است.`,
          }
        : { status: 'DONE', hint: 'گروه‌ها و دسته‌های مجاز تکمیل شده‌اند.' }
  }

  // وستینگهاوس
  if (elementCount === 0) {
    stages.westinghouse = { status: 'PENDING', hint: 'ابتدا عناصر کاری را در ساختار تولید تعریف کنید.' }
  } else if (elementsWithRating === 0) {
    stages.westinghouse = { status: 'PENDING', hint: 'هیچ عنصری ارزیابی نشده است.' }
  } else if (elementsWithRating < elementCount) {
    stages.westinghouse = {
      status: 'IN_PROGRESS',
      hint: `${elementsWithRating} از ${elementCount} عنصر ارزیابی شده است.`,
    }
  } else {
    stages.westinghouse = { status: 'DONE', hint: 'همه عناصر کاری ارزیابی شده‌اند.' }
  }

  // زمان‌سنجی — فاز ۳ فعال؛ وضعیت از دادهٔ واقعی — FR-06/07/12
  const activitiesWithElements = new Set(elements.map((e) => e.activityId))
  const sessionActivityIds = new Set(sessions.map((s) => s.activityId))
  const activitiesMissingSessions = activities.filter(
    (a) => activitiesWithElements.has(a.id) && !sessionActivityIds.has(a.id)
  )
  if (elementCount === 0 || operators.length === 0) {
    stages.timing = {
      status: 'PENDING',
      hint: 'برای زمان‌سنجی، ابتدا عناصر کاری و اپراتورها را تکمیل کنید.',
    }
  } else if (sessions.length === 0) {
    stages.timing = { status: 'PENDING', hint: 'هنوز جلسه‌ای ایجاد نشده است؛ جلسه = فعالیت × اپراتور × روش.' }
  } else if (validCycles === 0) {
    stages.timing = { status: 'IN_PROGRESS', hint: 'جلسه‌ها ایجاد شده‌اند؛ چرخه‌ها را در برگه ثبت کنید.' }
  } else if (activitiesMissingSessions.length > 0) {
    stages.timing = {
      status: 'NEEDS_REVIEW',
      hint: `${activitiesMissingSessions.length} فعالیت دارای عنصر، هنوز جلسه زمان‌سنجی ندارد.`,
    }
  } else {
    stages.timing = {
      status: validCycles > 0 ? 'DONE' : 'IN_PROGRESS',
      hint: `تاکنون ${validCycles} چرخهٔ معتبر ثبت شده است.`,
    }
  }

  // مراحل فازهای بعدی — برچسب صادقانه (قابلیت‌ها حذف نشده‌اند؛ ترتیب توسعه‌اند)
  stages.analysis = { status: 'FUTURE_PHASE', phase: DEVELOPMENT_PHASES.analysis, hint: 'آمار، تشخیص غیرعادی و مقایسه اپراتورها.' }
  stages.charts = { status: 'FUTURE_PHASE', phase: DEVELOPMENT_PHASES.charts, hint: 'نمودار فرایند OPC/FPC.' }
  stages.dashboard = { status: 'FUTURE_PHASE', phase: DEVELOPMENT_PHASES.dashboard, hint: 'کارت‌های خلاصه و شاخص‌های تخصصی.' }
  stages.reports = { status: 'FUTURE_PHASE', phase: DEVELOPMENT_PHASES.reports, hint: 'خروجی Excel و PDF.' }

  // پیشرفت شفاف مطالعه — تعریف: میانگین وزن مراحل فعال نسخه اول
  const activeKeys: StageKey[] = ['info', 'structure', 'operators', 'allowances', 'westinghouse', 'timing']
  const weight = (s: StageState): number =>
    s.status === 'DONE' ? 1 : s.status === 'IN_PROGRESS' || s.status === 'NEEDS_REVIEW' ? 0.5 : 0
  const progress =
    activeKeys.reduce((sum, k) => sum + weight(stages[k]), 0) / activeKeys.length

  return {
    stages,
    progress,
    counts: {
      stations: stationCount,
      activities: activityCount,
      elements: elementCount,
      operators: operators.length,
      groups: groups.length,
      categories: categories.length,
      elementsWithRating,
      finalized,
    },
  }
}
