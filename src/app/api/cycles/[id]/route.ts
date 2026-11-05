// ویرایش/حذف چرخه — FR-07 (حذف، داده را برای Undo برمی‌گرداند)
import { NextRequest } from 'next/server'
import { handle, ok, readJson } from '@/lib/api-helpers'
import { updateCycle, deleteCycle, buildSessionDetail } from '@/application/timing-service'
import { cycleUpdateSchema } from '@/domain/validation'

type Ctx = { params: Promise<{ id: string }> }

export function PUT(req: NextRequest, ctx: Ctx) {
  return handle(req, async () => {
    const { id } = await ctx.params
    const body = cycleUpdateSchema.parse(await readJson(req))
    const { cycle, sessionId } = await updateCycle(id, body)
    const sheet = await buildSessionDetail(sessionId)
    return ok({ cycle, sheet })
  })
}

export function DELETE(req: NextRequest, ctx: Ctx) {
  return handle(req, async () => {
    const { id } = await ctx.params
    const { removedData, sessionId } = await deleteCycle(id)
    const sheet = await buildSessionDetail(sessionId)
    return ok({ removed: removedData, sheet })
  })
}
