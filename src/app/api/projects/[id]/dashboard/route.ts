// داشبورد تحلیل پروژه — FR-21 (فاز ۶)
// کارت‌های خلاصه + شاخص‌ها/نمودارهای تخصصی + نیازهای بازبینی
import { NextRequest } from 'next/server'
import { handle, ok } from '@/lib/api-helpers'
import { getProjectDashboard } from '@/application/dashboard-service'

type Ctx = { params: Promise<{ id: string }> }

export function GET(_req: NextRequest, ctx: Ctx) {
  return handle(_req, async () => {
    const { id } = await ctx.params
    const dashboard = await getProjectDashboard(id)
    return ok(dashboard)
  })
}
