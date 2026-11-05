// فهرست فعالیت‌های پروژه با شمارش داده برای انتخاب در نمای تحلیل
import { NextRequest } from 'next/server'
import { handle, ok } from '@/lib/api-helpers'
import { listActivitiesForAnalysis } from '@/application/analysis-service'
import { db } from '@/lib/db'
import { AppError } from '@/domain/types'

type Ctx = { params: Promise<{ id: string }> }

export function GET(_req: NextRequest, ctx: Ctx) {
  return handle(_req, async () => {
    const { id } = await ctx.params
    const project = await db.project.findUnique({ where: { id }, select: { id: true } })
    if (!project) throw new AppError('PROJECT_NOT_FOUND', 'پروژه یافت نشد.', 404)
    const stations = await listActivitiesForAnalysis(id)
    return ok({ stations })
  })
}
