// ایجاد گره دستی بدون فعالیت زمان‌سنجی مستقیم — FR-20.5
import { NextRequest } from 'next/server'
import { handle, ok, readJson } from '@/lib/api-helpers'
import { createManualNode } from '@/application/chart-service'
import { chartManualNodeCreateSchema } from '@/domain/validation'

type Ctx = { params: Promise<{ id: string; chartType: string }> }

export function POST(req: NextRequest, ctx: Ctx) {
  return handle(req, async () => {
    const { id, chartType } = await ctx.params
    const body = chartManualNodeCreateSchema.parse(await readJson(req))
    const node = await createManualNode(id, chartType, body)
    return ok({ node }, 201)
  })
}
