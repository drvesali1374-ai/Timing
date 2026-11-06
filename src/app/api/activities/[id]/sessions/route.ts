// جلسات زمان‌سنجی فعالیت — FR-06
import { NextRequest } from 'next/server'
import { handle, ok, readJson } from '@/lib/api-helpers'
import { listSessions, createSession, buildSessionDetail } from '@/application/timing-service'
import { sessionCreateSchema } from '@/domain/validation'

type Ctx = { params: Promise<{ id: string }> }

export function GET(req: NextRequest, ctx: Ctx) {
  return handle(req, async () => {
    const { id } = await ctx.params
    const sessions = await listSessions(id)
    return ok({ sessions })
  })
}

export function POST(req: NextRequest, ctx: Ctx) {
  return handle(req, async () => {
    const { id } = await ctx.params
    const body = sessionCreateSchema.parse(await readJson(req))
    const session = await createSession(id, body)
    const sheet = await buildSessionDetail(session.id)
    return ok({ session: sheet.session, sheet }, 201)
  })
}
