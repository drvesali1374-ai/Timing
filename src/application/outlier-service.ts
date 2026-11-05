// ═══════════════════════════════════════════════════════════
// سرویس تشخیص مشاهدات غیرعادی — FR-18 / FR-11
// • مبنای تشخیص: مشاهدات عنصر با وضعیت VALID یا SUSPECT و مدت
//   محاسبه‌شده (در سراسر جلسات و اپراتورهای همان عنصر — همسو با OT)
// • علامت‌گذاری فقط «مشکوک» است؛ حذف خودکار ممنوع و داده خام
//   هرگز تغییر نمی‌کند.
// • تصمیم EXCLUDED فقط از آن کاربر است و هرگز بازنویسی نمی‌شود.
// • پس از هر تغییر داده (سلول، Paste، خروج/بازگشت) بازمحاسبه می‌شود؛
//   اگر مشاهده دیگر پرت نباشد، برچسب مشکوک به‌صورت شفاف برداشته
//   می‌شود (SUSPECT → VALID) و امتیاز پاک می‌گردد.
// ═══════════════════════════════════════════════════════════
import { db } from '@/lib/db'
import { detectOutliers, type OutlierOptions } from '@/calculation/outlier'
import { getAppSettings } from './settings-service'
import { markProjectCalculationsStale } from './calc-stale'

/** خواندن پیکربندی تشخیص از تنظیمات سراسری — FR-18 (آستانه/روش قابل تغییر) */
export async function getOutlierConfig(): Promise<OutlierOptions & { methodKey: string; thresholdKey: number }> {
  const settings = await getAppSettings()
  const method = settings['outlier.method'] === 'iqr' ? 'iqr' : 'mad'
  const thresholdRaw = Number(settings['outlier.threshold'])
  const threshold = Number.isFinite(thresholdRaw) && thresholdRaw > 0 ? thresholdRaw : 3.5
  return { method, threshold, methodKey: method, thresholdKey: threshold }
}

export interface OutlierRefreshResult {
  elementId: string
  basisCount: number
  flagged: number
  unflagged: number
}

/** بازمحاسبه پرچم‌های غیرعادی برای یک عنصر — داده خام دست‌نخورده می‌ماند */
export async function refreshOutliersForElement(elementId: string): Promise<OutlierRefreshResult> {
  const config = await getOutlierConfig()

  const observations = await db.elementObservation.findMany({
    where: { workElementId: elementId },
    select: {
      id: true,
      derivedDuration: true,
      validityStatus: true,
      outlierScore: true,
      outlierRule: true,
    },
  })

  // مبنای تشخیص: در محاسبات (VALID+SUSPECT) و دارای مدت — FR-14 همسو
  const basis = observations.filter(
    (o) => (o.validityStatus === 'VALID' || o.validityStatus === 'SUSPECT') && o.derivedDuration !== null
  )

  const flags = detectOutliers(
    basis.map((o) => ({ value: o.derivedDuration as number, ref: o.id })),
    { method: config.method, threshold: config.threshold }
  )
  const flaggedById = new Map(flags.map((f) => [f.ref as string, f]))

  let flagged = 0
  let unflagged = 0

  for (const o of basis) {
    const flag = flaggedById.get(o.id)
    if (flag) {
      const changed =
        o.validityStatus !== 'SUSPECT' ||
        o.outlierScore !== flag.score ||
        o.outlierRule !== flag.rule
      if (changed) {
        await db.elementObservation.update({
          where: { id: o.id },
          data: {
            validityStatus: 'SUSPECT',
            outlierScore: flag.score,
            outlierRule: flag.rule,
          },
        })
        flagged++
      }
    } else if (o.validityStatus === 'SUSPECT' || o.outlierScore !== null || o.outlierRule !== null) {
      // دیگر پرت نیست → برداشتن برچسب مشکوک به‌صورت شفاف
      await db.elementObservation.update({
        where: { id: o.id },
        data: { validityStatus: 'VALID', outlierScore: null, outlierRule: null },
      })
      unflagged++
    }
  }

  // اگر تغییری رخ داده، پروژه‌ی صاحب عنصر باید STALE شود — FR-27
  if (flagged + unflagged > 0) {
    const el = await db.workElement.findUnique({
      where: { id: elementId },
      select: { activity: { select: { station: { select: { projectId: true } } } } },
    })
    if (el) await markProjectCalculationsStale(el.activity.station.projectId)
  }

  return { elementId, basisCount: basis.length, flagged, unflagged }
}

/** بازمحاسبه برای همه عناصر یک فعالیت */
export async function refreshOutliersForActivity(activityId: string): Promise<OutlierRefreshResult[]> {
  const elements = await db.workElement.findMany({
    where: { activityId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: { id: true },
  })
  const results: OutlierRefreshResult[] = []
  for (const e of elements) {
    results.push(await refreshOutliersForElement(e.id))
  }
  return results
}

/** بازمحاسبه برای همه عناصر یک پروژه (پس از تغییر تنظیمات آستانه/روش) */
export async function refreshOutliersForProject(projectId: string): Promise<OutlierRefreshResult[]> {
  const elements = await db.workElement.findMany({
    where: { activity: { station: { projectId } } },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: { id: true },
  })
  const results: OutlierRefreshResult[] = []
  for (const e of elements) {
    results.push(await refreshOutliersForElement(e.id))
  }
  return results
}
