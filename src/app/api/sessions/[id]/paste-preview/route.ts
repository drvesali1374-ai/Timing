// پیش‌نمایش Paste چندسلولی — FR-07 (بدون نوشتن)
import { NextRequest } from 'next/server'
import { handle, ok, readJson } from '@/lib/api-helpers'
import { pastePreview } from '@/application/timing-service'
import { pasteSchema } from '@/domain/validation'

type Ctx = { params: Promise<{ id: string }> }

export function POST(req: NextRequest, ctx: Ctx) {
  return handle(req, async () => {
    const { id } = await ctx.params
    const body = pasteSchema.parse(await readJson(req))
    const preview = await pastePreview(id, body)
    return ok({ preview })
  })
}
