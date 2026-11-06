// اجرای محاسبهٔ کامل پروژه و ثبت Snapshot نسخه‌دار — FR-27
import { NextRequest } from 'next/server'
import { handle, ok } from '@/lib/api-helpers'
import { runProjectCalculation } from '@/application/calculation-run-service'

type Ctx = { params: Promise<{ id: string }> }

export function POST(req: NextRequest, ctx: Ctx) {
  return handle(req, async () => {
    const { id } = await ctx.params
    const run = await runProjectCalculation(id)
    return ok({ run }, 201)
  })
}
