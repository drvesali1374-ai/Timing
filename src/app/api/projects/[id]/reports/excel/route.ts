// خروجی Excel گزارش‌ها — FR-22 (فاز ۶)
// type: overview | summary | operators | raw
// فیلترهای اختیاری: activityId، operatorId
import { NextRequest, NextResponse } from 'next/server'
import { handle } from '@/lib/api-helpers'
import { AppError } from '@/domain/types'
import { buildExcelReport, EXCEL_REPORT_TYPE_LABELS, type ExcelReportType } from '@/infrastructure/excel-export'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, ctx: Ctx) {
  return handle(req, async () => {
    const { id } = await ctx.params
    const url = new URL(req.url)
    const type = (url.searchParams.get('type') ?? 'overview') as ExcelReportType
    if (!(type in EXCEL_REPORT_TYPE_LABELS)) {
      throw new AppError('VALIDATION_ERROR', 'نوع گزارش نامعتبر است.', 422)
    }
    const activityId = url.searchParams.get('activityId') ?? undefined
    const operatorId = url.searchParams.get('operatorId') ?? undefined

    const { buffer, filename } = await buildExcelReport(id, type, { activityId, operatorId })

    // نام فایل فارسی — RFC 5987 برای پشتیبانی مرورگرها
    const encodedName = encodeURIComponent(filename)
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'content-disposition': `attachment; filename="report-${type}.xlsx"; filename*=UTF-8''${encodedName}`,
        'cache-control': 'no-store',
      },
    })
  })
}
