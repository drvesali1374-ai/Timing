// آخرین Snapshot محاسبات پروژه + وضعیت تازگی — FR-27
import { NextRequest } from 'next/server'
import { handle, ok } from '@/lib/api-helpers'
import { getLatestCalculation } from '@/application/calculation-run-service'

type Ctx = { params: Promise<{ id: string }> }

export function GET(_req: NextRequest, ctx: Ctx) {
  return handle(_req, async () => {
    const { id } = await ctx.params
    const latest = await getLatestCalculation(id)
    return ok(latest)
  })
}
