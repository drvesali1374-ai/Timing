// وضعیت مشاهده (خروج/بازگشت به محاسبات) — FR-11
import { NextRequest } from 'next/server'
import { handle, ok, readJson } from '@/lib/api-helpers'
import { setObservationValidity, buildSessionDetail } from '@/application/timing-service'
import { validityPutSchema } from '@/domain/validation'

type Ctx = { params: Promise<{ id: string }> }

export function PUT(req: NextRequest, ctx: Ctx) {
  return handle(req, async () => {
    const { id } = await ctx.params
    const body = validityPutSchema.parse(await readJson(req))
    const { observation, sessionId } = await setObservationValidity(id, body)
    const sheet = await buildSessionDetail(sessionId)
    return ok({ observation, sheet })
  })
}
