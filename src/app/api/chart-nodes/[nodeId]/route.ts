// به‌روزرسانی گره (برچسب/نوع دستی + مختصات درگ) و حذف گره دستی — FR-20.5/7
import { NextRequest } from 'next/server'
import { handle, ok, readJson } from '@/lib/api-helpers'
import { deleteChartNode, updateChartNode } from '@/application/chart-service'
import { chartNodeUpdateSchema } from '@/domain/validation'

type Ctx = { params: Promise<{ nodeId: string }> }

export function PATCH(req: NextRequest, ctx: Ctx) {
  return handle(req, async () => {
    const { nodeId } = await ctx.params
    const body = chartNodeUpdateSchema.parse(await readJson(req))
    const node = await updateChartNode(nodeId, body)
    return ok({ node })
  })
}

export function DELETE(req: NextRequest, ctx: Ctx) {
  return handle(req, async () => {
    const { nodeId } = await ctx.params
    await deleteChartNode(nodeId)
    return ok({ deleted: true })
  })
}
