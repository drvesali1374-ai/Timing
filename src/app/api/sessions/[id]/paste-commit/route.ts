// ثبت Paste چندسلولی — FR-07 (اعتبارسنجی مجدد سمت سرور)
import { NextRequest } from 'next/server'
import { handle, ok, readJson } from '@/lib/api-helpers'
import { pasteCommit, buildSessionDetail } from '@/application/timing-service'
import { pasteSchema } from '@/domain/validation'

type Ctx = { params: Promise<{ id: string }> }

export function POST(req: NextRequest, ctx: Ctx) {
  return handle(req, async () => {
    const { id } = await ctx.params
    const body = pasteSchema.parse(await readJson(req))
    const result = await pasteCommit(id, body)
    const sheet = await buildSessionDetail(id)
    return ok({ ...result, sheet })
  })
}
