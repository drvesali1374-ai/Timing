// چیدمان خودکار (بازنشانی) نمودار — FR-20.6
import { NextRequest } from 'next/server'
import { handle, ok } from '@/lib/api-helpers'
import { applyChartAutoLayout } from '@/application/chart-service'

type Ctx = { params: Promise<{ id: string; chartType: string }> }

export function POST(req: NextRequest, ctx: Ctx) {
  return handle(req, async () => {
    const { id, chartType } = await ctx.params
    const chart = await applyChartAutoLayout(id, chartType)
    return ok(chart)
  })
}
