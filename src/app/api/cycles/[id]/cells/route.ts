// به‌روزرسانی دسته‌ای سلول‌های یک چرخه — FR-07/08/09/10
import { NextRequest } from 'next/server'
import { handle, ok, readJson } from '@/lib/api-helpers'
import { updateCells, buildSessionDetail } from '@/application/timing-service'
import { cellsPutSchema } from '@/domain/validation'

type Ctx = { params: Promise<{ id: string }> }

export function PUT(req: NextRequest, ctx: Ctx) {
  return handle(req, async () => {
    const { id } = await ctx.params
    const body = cellsPutSchema.parse(await readJson(req))
    const { warnings, sessionId } = await updateCells(id, body)
    const sheet = await buildSessionDetail(sessionId)
    return ok({ warnings, sheet })
  })
}
