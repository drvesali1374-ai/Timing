// افزودن چرخه به جلسه — FR-07
import { NextRequest } from 'next/server'
import { handle, ok, readJson } from '@/lib/api-helpers'
import { addCycles, buildSessionDetail } from '@/application/timing-service'
import { cyclesAddSchema } from '@/domain/validation'

type Ctx = { params: Promise<{ id: string }> }

export function POST(req: NextRequest, ctx: Ctx) {
  return handle(req, async () => {
    const { id } = await ctx.params
    const body = cyclesAddSchema.parse(await readJson(req))
    const created = await addCycles(id, body)
    const sheet = await buildSessionDetail(id)
    return ok({ created, sheet }, 201)
  })
}
