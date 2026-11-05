// تحلیل نتایج فعالیت — FR-12/14/15/16/17/18/19 (فاز ۴)
import { NextRequest } from 'next/server'
import { handle, ok } from '@/lib/api-helpers'
import { getActivityAnalysis } from '@/application/analysis-service'

type Ctx = { params: Promise<{ id: string }> }

export function GET(_req: NextRequest, ctx: Ctx) {
  return handle(_req, async () => {
    const { id } = await ctx.params
    const analysis = await getActivityAnalysis(id)
    return ok({ analysis })
  })
}
