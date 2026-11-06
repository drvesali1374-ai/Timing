// جزئیات/ویرایش/حذف جلسه — FR-06
import { NextRequest } from 'next/server'
import { handle, ok, readJson } from '@/lib/api-helpers'
import { AppError } from '@/domain/types'
import {
  buildSessionDetail,
  updateSession,
  deleteSession,
} from '@/application/timing-service'
import { sessionUpdateSchema } from '@/domain/validation'

type Ctx = { params: Promise<{ id: string }> }

export function GET(req: NextRequest, ctx: Ctx) {
  return handle(req, async () => {
    const { id } = await ctx.params
    const sheet = await buildSessionDetail(id)
    return ok({ sheet })
  })
}

export function PUT(req: NextRequest, ctx: Ctx) {
  return handle(req, async () => {
    const { id } = await ctx.params
    const raw = (await readJson(req)) as Record<string, unknown>
    // روش اندازه‌گیری پس از ایجاد قابل تغییر نیست — FR-06 / ۶.۴
    if ('timingMethod' in raw) {
      throw new AppError(
        'METHOD_IMMUTABLE',
        'روش اندازه‌گیری جلسه پس از ایجاد قابل تغییر نیست؛ برای روش دیگر، جلسه جدیدی ایجاد کنید.',
        422
      )
    }
    const body = sessionUpdateSchema.parse(raw)
    await updateSession(id, body)
    const sheet = await buildSessionDetail(id)
    return ok({ sheet })
  })
}

export function DELETE(req: NextRequest, ctx: Ctx) {
  return handle(req, async () => {
    const { id } = await ctx.params
    const counts = await deleteSession(id)
    return ok({ deleted: true, removedCounts: counts })
  })
}
