// جابه‌جایی گره در توالی (بالا/پایین) + بازسازی زنجیره — فاز ۵ «ترتیب گره‌ها»
import { NextRequest } from 'next/server'
import { handle, ok, readJson } from '@/lib/api-helpers'
import { moveChartNodeOrder } from '@/application/chart-service'
import { chartOrderMoveSchema } from '@/domain/validation'

type Ctx = { params: Promise<{ id: string; chartType: string }> }

export function POST(req: NextRequest, ctx: Ctx) {
  return handle(req, async () => {
    await ctx.params // اعتبارسنجی وجود پروژه و نوع نمودار در سرویس انجام می‌شود
    const body = chartOrderMoveSchema.parse(await readJson(req))
    const result = await moveChartNodeOrder(body)
    return ok(result)
  })
}
