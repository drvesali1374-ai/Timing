// گزارش کامل مطالعه (JSON برای نمای چاپ/PDF) — FR-22 (فاز ۶)
// فیلترهای اختیاری: activityId، operatorId
import { NextRequest } from 'next/server'
import { handle, ok } from '@/lib/api-helpers'
import { getStudyReport, getReportSelection } from '@/application/report-service'

type Ctx = { params: Promise<{ id: string }> }

export function GET(req: NextRequest, ctx: Ctx) {
  return handle(req, async () => {
    const { id } = await ctx.params
    const url = new URL(req.url)
    // mode=selection فقط فهرست انتخاب (ایستگاه/فعالیت/اپراتور) را برمی‌گرداند
    if (url.searchParams.get('mode') === 'selection') {
      return ok(await getReportSelection(id))
    }
    const activityId = url.searchParams.get('activityId') ?? undefined
    const operatorId = url.searchParams.get('operatorId') ?? undefined
    return ok(await getStudyReport(id, { activityId, operatorId }))
  })
}
