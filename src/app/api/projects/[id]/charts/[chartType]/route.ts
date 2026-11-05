// خواندن نمودار فرایند با سینک تنبل از فعالیت‌ها — FR-20.2
// GET هم گره‌های فعالیت‌های جدید را می‌سازد و گره‌های یتیم را پاک می‌کند
import { NextRequest } from 'next/server'
import { handle, ok } from '@/lib/api-helpers'
import { getChart } from '@/application/chart-service'

type Ctx = { params: Promise<{ id: string; chartType: string }> }

export function GET(_req: NextRequest, ctx: Ctx) {
  return handle(_req, async () => {
    const { id, chartType } = await ctx.params
    const chart = await getChart(id, chartType)
    return ok(chart)
  })
}
