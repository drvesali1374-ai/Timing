// چیدمان شخصی‌سازی‌شدهٔ داشبورد — FR-21 (فاز ۶)
// ترتیب/مرئی‌بودن کارت‌ها و نمودارها در تنظیمات پروژه ذخیره می‌شود.
// این تنظیم صرفاً نمایشی است و محاسبات را «نیازمند محاسبهٔ مجدد» نمی‌کند.
import { NextRequest } from 'next/server'
import { handle, ok, readJson } from '@/lib/api-helpers'
import { getProjectSettings, putProjectSettings } from '@/application/settings-service'
import { dashboardLayoutSchema } from '@/domain/validation'
import { PROJECT_SETTING_KEYS } from '@/domain/types'

type Ctx = { params: Promise<{ id: string }> }

export function GET(_req: NextRequest, ctx: Ctx) {
  return handle(_req, async () => {
    const { id } = await ctx.params
    const settings = await getProjectSettings(id)
    const raw = settings[PROJECT_SETTING_KEYS.dashboardLayout]
    let layout: unknown = null
    if (raw) {
      try {
        layout = JSON.parse(raw)
      } catch {
        layout = null // مقدار خراب → چیدمان پیش‌فرض؛ خطا پنهان نمی‌شود بلکه بی‌اثر می‌شود
      }
    }
    return ok({ layout })
  })
}

export function PUT(req: NextRequest, ctx: Ctx) {
  return handle(req, async () => {
    const { id } = await ctx.params
    const body = dashboardLayoutSchema.parse(await readJson(req))
    await putProjectSettings(id, {
      [PROJECT_SETTING_KEYS.dashboardLayout]: JSON.stringify(body),
    })
    return ok({ layout: body })
  })
}
