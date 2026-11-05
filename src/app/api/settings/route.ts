// تنظیمات سراسری — FR-29
import { NextRequest } from 'next/server'
import { handle, ok, readJson } from '@/lib/api-helpers'
import { getAppSettings, putAppSettings } from '@/application/settings-service'
import { appSettingsPutSchema } from '@/domain/validation'

export function GET(req: NextRequest) {
  return handle(req, async () => {
    return ok({ settings: await getAppSettings() })
  })
}

export function PUT(req: NextRequest) {
  return handle(req, async () => {
    const body = appSettingsPutSchema.parse(await readJson(req))
    return ok({ settings: await putAppSettings(body) })
  })
}
