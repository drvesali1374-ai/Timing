'use client'

import { PendingPhaseView } from '@/components/common/Feedback'

export default function DashboardPendingView(_props: { projectId?: string }) {
  return (
    <PendingPhaseView
      phase={6}
      title="داشبورد تحلیل"
      items={[
        'کارت‌های خلاصه در ابتدا: زمان استاندارد (در صورت قابل محاسبه بودن)، میانگین، تعداد نمونه و وضعیت هدف',
        'شاخص‌ها و نمودارهای تخصصی در بخش‌های بازشونده',
        'شخصی‌سازی: فعال/غیرفعال‌کردن و مرتب‌سازی کارت‌ها و نمودارها با ذخیره چیدمان',
        'در داده ناقص/غیرقابل محاسبه، کارت علت را نشان می‌دهد — نمایش صفر یا مقدار ساختگی ممنوع',
      ]}
    />
  )
}
