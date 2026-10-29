"use client";

import { AlertTriangle, Bot, Check, CirclePlus, Sparkles, WifiOff } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KpiCard, PanelCard, SectionTitle, SourceBadge } from "../ui-bits";
import { demoFpcNodes, faDigits } from "../data";

const symbolShape: Record<string, { label: string; draw: React.ReactNode }> = {
  operation: {
    label: "عملیات",
    draw: <circle cx="18" cy="18" r="12" className="fill-primary/15 stroke-primary" strokeWidth="2.5" />,
  },
  transport: {
    label: "حمل‌ونقل",
    draw: <path d="M6 24 L18 6 L30 24 Z" className="fill-chart-2/15 stroke-chart-2" strokeWidth="2.5" />,
  },
  inspection: {
    label: "بازرسی",
    draw: <rect x="7" y="7" width="22" height="22" className="fill-amber-400/15 stroke-amber-500" strokeWidth="2.5" />,
  },
  delay: {
    label: "تأخیر",
    draw: <path d="M7 25 A11 11 0 0 1 29 25 Z" className="fill-destructive/10 stroke-destructive" strokeWidth="2.5" />,
  },
  storage: {
    label: "انبارش",
    draw: (
      <g className="stroke-foreground" strokeWidth="2.5">
        <path d="M7 8 H29" />
        <path d="M7 28 H29" />
        <path d="M10 8 V28" />
        <path d="M26 8 V28" />
      </g>
    ),
  },
};

const symbolCounts = demoFpcNodes.reduce<Record<string, number>>((acc, n) => {
  acc[n.symbol] = (acc[n.symbol] ?? 0) + 1;
  return acc;
}, {});

const totalTime = demoFpcNodes
  .filter((n) => n.time !== "—")
  .reduce((acc, n) => acc + Number(n.time.replace(/[٫۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[^\d.]/g, "")) || 0, 0);

const totalDistance = demoFpcNodes
  .filter((n) => n.distance !== "—")
  .reduce((acc, n) => acc + Number(String(n.distance).replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[^\d.]/g, "")) || 0, 0);

export function DiagramsView() {
  return (
    <div className="space-y-5">
      <SectionTitle
        title="نمودارهای فرایندی OPC / FPC"
        sub="FPC: جریان ماده/فرد/تجهیزات با نمادهای پنج‌گانه متعارف — جهت منطقی جریان مستقل از RTL صفحه است (بند B6)"
        tag
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Select defaultValue="fpc">
              <SelectTrigger className="h-8 w-24 text-xs" aria-label="نوع نمودار">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fpc">FPC</SelectItem>
                <SelectItem value="opc">OPC</SelectItem>
              </SelectContent>
            </Select>
            <Select defaultValue="current">
              <SelectTrigger className="h-8 w-28 text-xs" aria-label="نسخه روش">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current">روش موجود</SelectItem>
                <SelectItem value="proposed">روش پیشنهادی</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" className="h-8 gap-1 text-xs">
              <CirclePlus className="size-3.5" /> افزودن گام
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* بوم نمودار */}
        <PanelCard
          title="بوم ویرایشگر (drag-and-drop · zoom · pan · undo/redo)"
          className="lg:col-span-2"
          titleExtra={<Badge variant="outline" className="text-[10px]">نسخه نمودار: v3</Badge>}
        >
          <div className="rounded-xl border-2 border-dashed bg-muted/20 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
              <span>موضوع مطالعه: ماده (قطعهٔ پکیج) · جهت جریان: راست ← چپ منطقی</span>
              <div className="flex flex-wrap gap-1">
                {Object.entries(symbolShape).map(([k, v]) => (
                  <span key={k} className="inline-flex items-center gap-1 rounded border bg-background px-1.5 py-0.5">
                    <svg viewBox="0 0 36 36" className="size-3.5" aria-hidden>
                      {v.draw}
                    </svg>
                    {v.label}
                  </span>
                ))}
              </div>
            </div>

            {/* زنجیره گام‌ها */}
            <div className="flex items-stretch gap-0 overflow-x-auto pb-2" dir="rtl">
              {demoFpcNodes.map((n, i) => (
                <div key={n.step} className="flex items-stretch">
                  <div
                    className={`flex w-32 shrink-0 flex-col items-center gap-1.5 rounded-lg border p-2.5 text-center transition-colors sm:w-36 ${
                      n.connected ? "border-border bg-card hover:border-primary/50" : "border-destructive/50 bg-destructive/5"
                    }`}
                  >
                    <svg viewBox="0 0 36 36" className="size-9" aria-label={`نماد ${symbolShape[n.symbol].label}`} role="img">
                      {symbolShape[n.symbol].draw}
                    </svg>
                    <p className="text-[10px] leading-4 font-semibold sm:text-[11px]">{n.label}</p>
                    <p className="text-[10px] text-muted-foreground">{n.time !== "—" ? `${n.time}` : "بدون زمان"}</p>
                    <p className="text-[10px] text-muted-foreground">{n.distance !== "—" ? `${n.distance}` : "—"}</p>
                    <Badge variant="outline" className="text-[9px]">
                      گام {faDigits(n.step)}
                    </Badge>
                  </div>
                  {i < demoFpcNodes.length - 1 ? (
                    <div className="grid w-6 shrink-0 place-items-center text-muted-foreground" aria-hidden>
                      ←
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            <p className="mt-2 text-[10px] leading-5 text-muted-foreground">
              ⚠ پیکان‌ها همیشه مبدأ→مقصد معنایی‌اند؛ جهت متن فارسی RTL است ولی جهت جریان فرایند معکوس نمی‌شود.
            </p>
          </div>

          {/* اعتبارسنجی */}
          <div className="mt-4 space-y-2">
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-2.5 text-[11px] leading-5">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
              <p>
                <span className="font-semibold">هشدار اعتبارسنجی:</span> گام ۵ «کنترل کانکتور» بدون اتصال به گام بعد است —
                اتصال قطع یا ترتیب ناسازگار تشخیص داده شد.
              </p>
            </div>
            <div className="flex items-start gap-2 rounded-lg border border-emerald-600/30 bg-emerald-500/5 p-2.5 text-[11px] leading-5">
              <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
              <p>
                <span className="font-semibold">اعتبارسنجی موفق:</span> شناسه تکراری وجود ندارد · ارجاع فعالیت‌ها معتبر است ·
                خروجی چاپی/SVG آماده است.
              </p>
            </div>
          </div>
        </PanelCard>

        {/* ستون کناری: خلاصه + دستیار */}
        <div className="space-y-4">
          <PanelCard title="خلاصه رویدادها (از داده موجود)">
            <div className="grid grid-cols-2 gap-2.5">
              <KpiCard k="عملیات" v={faDigits(symbolCounts.operation ?? 0)} />
              <KpiCard k="حمل‌ونقل" v={faDigits(symbolCounts.transport ?? 0)} tone="muted" />
              <KpiCard k="بازرسی" v={faDigits(symbolCounts.inspection ?? 0)} tone="warning" />
              <KpiCard k="تأخیر" v={faDigits(symbolCounts.delay ?? 0)} tone="warning" />
              <KpiCard k="انبارش" v={faDigits(symbolCounts.storage ?? 0)} tone="muted" />
              <KpiCard k="مجموع زمان" v={`${faDigits("14.7")} دقیقه`} note="از گام‌های دارای زمان" />
              <KpiCard k="مجموع مسافت" v={`${faDigits(30)} متر`} note="فقط حمل‌ونقل" />
              <KpiCard k="مقایسه" v="۲ نسخه" note="موجود ↔ پیشنهادی" />
            </div>
          </PanelCard>

          <PanelCard
            title="دستیار آفلاین نمودار"
            titleExtra={
              <Badge variant="outline" className="gap-1 border-amber-500/40 text-[10px] text-amber-700 dark:text-amber-400">
                <WifiOff className="size-3" /> وضعیت آفلاین
              </Badge>
            }
          >
            <div className="space-y-3 text-[11px] leading-6">
              <div className="rounded-lg border bg-muted/30 p-2.5">
                <p className="font-semibold">وضعیت صادقانه لایه‌ها:</p>
                <p className="mt-1 flex items-center gap-1.5 text-muted-foreground">
                  <Check className="size-3.5 text-emerald-600" /> لایه الف — قواعد قطعی و کتابخانه دانش محلی: فعال
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-muted-foreground">
                  <WifiOff className="size-3.5 text-amber-600" /> لایه ب — مدل زبانی محلی (WebGPU): غیرفعال در این دستگاه
                </p>
                <p className="mt-1.5 text-muted-foreground">
                  در نبود مدل، وضعیت «قواعد آفلاین فعال؛ مدل زبانی محلی غیرفعال» نمایش داده می‌شود — ادعای AI کامل نیست
                  (بند B7).
                </p>
              </div>
              <Button variant="outline" size="sm" className="w-full gap-1.5">
                <Sparkles className="size-4" /> تبدیل شرح فرایند به پیش‌نویس گام‌ها
              </Button>
              <div className="rounded-lg border border-dashed p-2.5">
                <p className="flex items-center gap-1.5 font-semibold">
                  <Bot className="size-4 text-primary" /> پیشنهاد دستیار (نیازمند تأیید کاربر):
                </p>
                <ul className="mt-1.5 list-inside list-disc space-y-1 text-muted-foreground">
                  <li>گام ۳ «انتظار ۶ دقیقه» — فرضیهٔ قابل بررسی برای حذف/کاهش (نه نتیجه قطعی)</li>
                  <li>گام ۲ و ۷ قابل ادغام در یک مسیر رفت‌وبرگشت‌اند — با دلیل ثبت‌شده</li>
                </ul>
                <div className="mt-2 flex gap-1.5">
                  <Button size="sm" className="h-7 flex-1 text-[11px]">پذیرش</Button>
                  <Button size="sm" variant="outline" className="h-7 flex-1 text-[11px]">رد</Button>
                  <Button size="sm" variant="ghost" className="h-7 flex-1 text-[11px]">ویرایش</Button>
                </div>
                <p className="mt-2 text-[10px] text-muted-foreground">
                  پیشنهادها روی نسخه تأییدشده اعمال نمی‌شوند مگر با پذیرش کاربر؛ شناسه/نسخه پیشنهاد ذخیره می‌شود.
                </p>
              </div>
            </div>
          </PanelCard>

          <div className="rounded-lg border border-dashed bg-muted/30 p-3 text-[11px] leading-6 text-muted-foreground">
            <SourceBadge label="نمادها: روش رایج متعارف (OPC/FPC)" />
            <p className="mt-1.5">
              واژه‌نامه OPC (Outline/Operation Process Chart) و هم‌معناها در راهنمای داخلی محصول مستند می‌شود؛ ادعای
              انطباق رسمی بدون منبع معتبر وجود ندارد.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-dashed bg-muted/30 p-3 text-[11px] leading-6 text-muted-foreground">
        <span className="font-semibold text-foreground">در محصول نهایی (فاز ۳):</span> ایجاد گام از نوار ابزار، جابه‌جایی
        drag-and-drop، اتصال با خط جهت‌دار و تغییر مسیر، چیدمان خودکار اولیه + ویرایش آزاد، شبکه اختیاری/تراز، انتخاب
        چندگانه، undo/redo، گروه‌بندی و یادداشت، ذخیره خودکار کنترل‌شده، خروجی چاپی SVG/PNG.
      </div>
    </div>
  );
}
