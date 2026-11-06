// حذف اتصال گره‌ها (زنجیره یا دستی) — تغییر نمودار مشاهدات را حذف نمی‌کند — FR-20.9
import { NextRequest } from 'next/server'
import { handle, ok } from '@/lib/api-helpers'
import { deleteChartEdge } from '@/application/chart-service'

type Ctx = { params: Promise<{ edgeId: string }> }

export function DELETE(req: NextRequest, ctx: Ctx) {
  return handle(req, async () => {
    const { edgeId } = await ctx.params
    await deleteChartEdge(edgeId)
    return ok({ deleted: true })
  })
}
