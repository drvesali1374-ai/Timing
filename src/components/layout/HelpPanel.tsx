'use client'

// ═══════════════════════════════════════════════════════════
// پنل راهنمای مرحله — FR-28 / ۷.۲
// نوار کنار صفحه، جمع‌شونده، با اقدام بعدی پیشنهادی
// ═══════════════════════════════════════════════════════════
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, Lightbulb, ListChecks, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { projectsApi } from '@/lib/api/endpoints'
import { qk } from '@/lib/api/keys'
import { useAppStore } from '@/store/app-store'
import { useIsMobile } from '@/hooks/use-mobile'
import { STUDY_STAGES, STAGE_STATUS_LABELS, type StageStatus } from '@/domain/types'
import { cn } from '@/lib/utils'

/** محتوای راهنمای هر مرحله — از محتوای واقعی قواعد همان مرحله */
const STAGE_GUIDES: Record<string, { steps: string[]; next: string }> = {
  info: {
    steps: [
      'نام پروژه، خط تولید، محصول و تاریخ مطالعه را کامل کنید.',
      'روش اعمال مجاز را انتخاب کنید: درصدی از زمان نرمال یا سهم از زمان استاندارد.',
      'روش تجمیع چند اپراتور را در تنظیمات محاسبات مشخص کنید.',
    ],
    next: 'سپس به «ساختار تولید» بروید و ایستگاه‌ها را ثبت کنید.',
  },
  structure: {
    steps: [
      'ایستگاه‌های خط تولید را اضافه و با Drag & Drop مرتب کنید.',
      'برای هر ایستگاه، فعالیت‌ها را با نوع فرایندی (عملیات/بازرسی/حمل‌ونقل/تأخیر/انبارش) ثبت کنید.',
      'برای هر فعالیت، عناصر کاری را با نوع (دستی/ماشین/انتظار/هم‌زمان) تعریف کنید.',
      'شناسه عناصر پایدار است؛ تغییر نام ارتباط تاریخی را از بین نمی‌برد.',
    ],
    next: 'سپس اپراتورها را معرفی و گروه‌های مجاز را تعریف کنید.',
  },
  operators: {
    steps: [
      'هر اپراتور را با نام نمایشی و کد داخلی ثبت کنید.',
      'اپراتور در سطح پروژه تعریف می‌شود و در چند فعالیت شرکت می‌کند.',
      'برگه زمان‌سنجی هر اپراتور برای هر فعالیت مستقل خواهد بود (فاز ۳).',
    ],
    next: 'سپس «گروه‌ها و مجازها» را تنظیم کنید.',
  },
  allowances: {
    steps: [
      'دسته‌های مجاز پروژه را تعریف کنید (مثلاً استراحت شخصی، نیازهای طبیعی، خستگی).',
      'گروه‌های فعالیت بسازید و درصد هر دسته را در سطح گروه تعیین کنید.',
      'فعالیت را به گروه تخصیص دهید؛ مقادیر به‌صورت ارث‌بری اعمال می‌شوند.',
      'در صورت نیاز، هر دسته را در سطح فعالیت بازنویسی (Override) کنید.',
    ],
    next: 'سپس ارزیابی وستینگهاوس عناصر را انجام دهید.',
  },
  westinghouse: {
    steps: [
      'جدول مرجع و منبع/نسخه آن را بازبینی کنید؛ جدول Seed صرفاً نقطه شروع است.',
      'برای هر عنصر کاری، چهار عامل مهارت/تلاش/شرایط/یکنواختی را ارزیابی کنید.',
      'ضریب R = ۱ + مجموع عوامل؛ برای هر عنصر یک‌بار ثبت و به همه مشاهدات همان عنصر اعمال می‌شود.',
      'در صورت نیاز، ارزیابی را از عنصر مشابه کپی کنید.',
    ],
    next: 'با فعال‌شدن فاز ۳، برگه زمان‌سنجی آغاز می‌شود.',
  },
}

export function HelpPanel({ projectId }: { projectId: string }) {
  const { helpOpen, setHelpOpen, view } = useAppStore()
  const isMobile = useIsMobile()
  const stage = view.name === 'project' ? view.stage : 'structure'
  const guide = STAGE_GUIDES[stage]
  const { data: summary } = useQuery({
    queryKey: qk.projectSummary(projectId),
    queryFn: () => projectsApi.summary(projectId),
  })
  const stageState = summary?.stages[stage]

  if (isMobile) return null // در موبایل از دکمه راهنمای فیلدها استفاده می‌شود

  if (!helpOpen) {
    return (
      <div className="sticky top-0 hidden h-fit w-11 shrink-0 self-start pt-20 xl:block no-print">
        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          aria-label="نمایش راهنمای مرحله"
          className="group flex flex-col items-center gap-1.5 rounded-2xl border bg-card px-1.5 py-3 text-faint shadow-[var(--shadow-1)] transition-colors hover:border-brand/40 hover:text-brand"
        >
          <Lightbulb className="size-5" aria-hidden />
          <span className="text-[10px] font-bold [writing-mode:vertical-rl]">راهنمای مرحله</span>
        </button>
      </div>
    )
  }

  const stageMeta = STUDY_STAGES.find((s) => s.key === stage)

  return (
    <aside
      className="scroll-slim sticky top-14 hidden h-[calc(100vh-3.5rem)] w-72 shrink-0 overflow-y-auto border-r bg-surface-2/60 p-4 xl:block no-print"
      aria-label="راهنمای مرحله"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-xl bg-amber-soft text-amber">
            <ListChecks className="size-4.5" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-extrabold">راهنمای مرحله</p>
            <p className="text-[11px] text-muted-foreground">{stageMeta?.label}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="size-7" onClick={() => setHelpOpen(false)} aria-label="جمع‌کردن راهنما">
          <X className="size-4" aria-hidden />
        </Button>
      </div>

      {summary && stageState && stageState.status !== 'FUTURE_PHASE' && (
        <div className="mb-3 rounded-xl bg-card p-3 shadow-[var(--shadow-1)]">
          <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
            وضعیت این مرحله:
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[10px]',
                stageState.status === 'DONE' && 'bg-green-soft text-green',
                stageState.status === 'IN_PROGRESS' && 'bg-cyan-soft text-cyan',
                stageState.status === 'NEEDS_REVIEW' && 'bg-amber-soft text-amber',
                stageState.status === 'PENDING' && 'bg-muted text-muted-foreground'
              )}
            >
              {STAGE_STATUS_LABELS[stageState.status as StageStatus]}
            </span>
          </p>
          <p className="text-xs leading-6 text-muted-foreground">{stageState.hint}</p>
        </div>
      )}

      {guide ? (
        <ol className="space-y-2">
          {guide.steps.map((step, i) => (
            <li key={i} className="flex items-start gap-2 rounded-xl bg-card p-2.5 text-xs leading-6 shadow-[var(--shadow-1)]">
              <span className="num mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[10px] font-bold text-brand">
                {(i + 1).toLocaleString('fa-IR')}
              </span>
              <span className="text-muted-foreground">{step}</span>
            </li>
          ))}
          <li className="rounded-xl bg-brand-soft p-2.5 text-xs leading-6">
            <b className="text-accent-foreground">اقدام بعدی پیشنهادی: </b>
            <span className="text-muted-foreground">{guide.next}</span>
          </li>
        </ol>
      ) : (
        <p className="rounded-xl bg-card p-3 text-xs leading-6 text-muted-foreground shadow-[var(--shadow-1)]">
          راهنمای اختصاصی این بخش در فاز مربوط به آن تکمیل می‌شود. برای فیلدهای موجود، از آیکون راهنمای
          کنار هر فیلد استفاده کنید.
        </p>
      )}

      <button
        type="button"
        onClick={() => setHelpOpen(false)}
        className="mt-3 flex w-full items-center justify-center gap-1 rounded-xl border border-dashed py-2 text-[11px] text-faint transition-colors hover:border-brand/40 hover:text-brand"
      >
        <ChevronLeft className="size-3.5" aria-hidden />
        جمع‌کردن پنل راهنما
      </button>
    </aside>
  )
}
