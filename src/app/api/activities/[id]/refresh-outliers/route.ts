// بازمحاسبهٔ دستی پرچم‌های غیرعادی فعالیت — FR-18
// (اجرای خودکار پس از تغییر داده هم وجود دارد؛ این مسیر برای اطمینان کاربر است)
import { NextRequest } from 'next/server'
import { handle, ok } from '@/lib/api-helpers'
import { refreshOutliersForActivity } from '@/application/outlier-service'
import { getActivityAnalysis } from '@/application/analysis-service'
import { db } from '@/lib/db'
import { AppError } from '@/domain/types'

type Ctx = { params: Promise<{ id: string }> }

export function POST(req: NextRequest, ctx: Ctx) {
  return handle(req, async () => {
    const { id } = await ctx.params
    const activity = await db.activity.findUnique({ where: { id }, select: { id: true } })
    if (!activity) throw new AppError('ACTIVITY_NOT_FOUND', 'فعالیت یافت نشد.', 404)
    const results = await refreshOutliersForActivity(id)
    const analysis = await getActivityAnalysis(id)
    return ok({
      refreshed: results.reduce((s, r) => s + r.flagged + r.unflagged, 0),
      results,
      analysis,
    })
  })
}
