"use client";

/**
 * راهنمای قدم‌به‌قدم انجام مطالعه زمان‌سنجی (دستورالعمل بخش ۸).
 * ----------------------------------------------------------------
 * ۱۴ مرحله از تعریف پروژه تا گزارش نهایی؛ هر مرحله: هدف، چرایی، اطلاعات لازم،
 * روش، مثال واقعی صنعتی + دکمه رفتن به بخش مربوطه + قبلی/بعدی + ردکردن مراحل اختیاری.
 * پیشرفت به‌ازای پروژه در localStorage ذخیره می‌شود (با خروج/ورود حفظ می‌شود).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Factory,
  FileText,
  Flag,
  GitBranch,
  Scale,
  Table2,
  Target,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/app/ui-bits";
import { faDigits } from "@/components/app/timing/timing-bits";

interface StepDef {
  id: string;
  title: string;
  icon: React.ElementType;
  optional?: boolean;
  goal: string;
  why: string;
  prepare: string;
  how: string[];
  example: string;
  open?: () => void;
  openLabel?: string;
}

export function StudyGuideView({
  projectId,
  onBack,
  onOpenStations,
  onOpenConfig,
  onOpenDiagrams,
  onOpenTiming,
  onOpenAnalysis,
  onOpenBalance,
}: {
  projectId: string;
  onBack: () => void;
  onOpenStations: () => void;
  onOpenConfig: () => void;
  onOpenDiagrams: () => void;
  onOpenTiming: () => void;
  onOpenAnalysis: () => void;
  onOpenBalance: () => void;
}) {
  const storageKey = `tazmin-guide-progress:${projectId}`;
  // مقداردهی اولیه lazy از localStorage (این نما فقط سمت کلاینت رندر می‌شود — پس از بارگذاری نشست)
  const [current, setCurrent] = useState(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey) ?? "{}") as { current?: number };
      return typeof parsed.current === "number" ? parsed.current : 0;
    } catch {
      return 0;
    }
  });
  const [done, setDone] = useState<Record<string, boolean>>(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey) ?? "{}") as { done?: Record<string, boolean> };
      return parsed.done ?? {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ current, done }));
    } catch {
      /* بهترین تلاش */
    }
  }, [current, done, storageKey]);

  const steps = useMemo<StepDef[]>(() => [
    {
      id: "project",
      title: "ساخت پروژه و اطلاعات خط تولید",
      icon: Factory,
      goal: "تعریف مطالعه: نام پروژه، خط تولید، محصول و مسئول مطالعه.",
      why: "هر مطالعه باید جدا از سایر پروژه‌ها نگهداری شود تا داده‌ها و گزارش‌ها قابل ردیابی باشند.",
      prepare: "نام خط، محصول، بخش/سالن، نام مسئول مطالعه و تاریخ.",
      how: [
        "از داشبورد «ایجاد پروژه جدید» را بزنید.",
        "اطلاعات پایه (نام، کد، خط تولید، محصول) را پر کنید.",
        "پروفایل پیش‌فرض «مطالعه عمومی زمان صنعتی» برای شروع کافی است.",
      ],
      example: "پروژه «زمان‌سنجی خط مونتاژ پنل» · کد TS-101 · خط: مونتاژ پنل · محصول: پنل کنترل صنعتی.",
      openLabel: "بازگشت به جزئیات پروژه",
      open: onBack,
    },
    {
      id: "stations",
      title: "تعریف ایستگاه‌های کاری",
      icon: Factory,
      goal: "ورود ایستگاه‌های خط تولید به ترتیب جریان کار.",
      why: "ایستگاه‌ها محل انجام فعالیت‌ها هستند؛ بالانس خط و گزارش‌ها بر همین تقسیم‌بندی ساخته می‌شوند.",
      prepare: "فهرست ایستگاه‌ها به ترتیب جریان (مثلاً از Excel).",
      how: [
        "وارد نمای «خط و ایستگاه‌های کاری» شوید.",
        "ایستگاه‌ها را تکی یا با «ورود گروهی» (چسباندن از Excel) ثبت کنید.",
      ],
      example: "آماده‌سازی قطعات → مونتاژ → بازرسی → بسته‌بندی.",
      openLabel: "رفن به خط و ایستگاه‌ها",
      open: onOpenStations,
    },
    {
      id: "activities",
      title: "تعریف یا واردکردن فعالیت‌ها",
      icon: ClipboardList,
      goal: "ثبت کارهای قابل‌اندازه‌گیری هر ایستگاه و اتصال به ایستگاه مربوط.",
      why: "زمان‌ها برای فعالیت‌ها ثبت می‌شوند — بدون فعالیت، جدول ثبت زمان خالی می‌ماند.",
      prepare: "فهرست فعالیت‌های هر ایستگاه (مثلاً از Excel) با توضیح مرز شروع/پایان.",
      how: [
        "در کارگاه پیکربندی، تب «فعالیت‌ها» را باز کنید.",
        "با «ورود گروهی» فهرست را یک‌جا بچسبانید یا تک‌تک بسازید.",
        "ایستگاه هر فعالیت را در همان فرم انتخاب کنید.",
      ],
      example: "ایستگاه مونتاژ: برداشتن قطعه، جای‌گذاری قطعه، نصب پیچ، کنترل اتصال.",
      openLabel: "رفتن به فعالیت‌ها",
      open: onOpenConfig,
    },
    {
      id: "concepts",
      title: "تفاوت ایستگاه، فعالیت و گام نمودار",
      icon: BookOpen,
      goal: "شناخت سه مفهوم کلیدی پیش از کار با نمودار.",
      why: "این سه مفهوم با هم مرتبط‌اند اما یکی نیستند؛ شناختشان جلوی خطای مدل‌سازی را می‌گیرد.",
      prepare: "—",
      how: [
        "ایستگاه = محل انجام کار روی خط (مثل ایستگاه مونتاژ).",
        "فعالیت = کار قابل‌اندازه‌گیری (مثل نصب پیچ) که در ایستگاه انجام می‌شود.",
        "گام نمودار = نمایش یک عملیات/حمل/بازرسی در نمودار OPC/FPC — گام می‌تواند به فعالیت ارجاع دهد.",
      ],
      example: "فعالیت «نصب پیچ» در ایستگاه «مونتاژ» انجام می‌شود و در نمودار OPC به‌صورت گام «عملیات نصب پیچ» نشان داده می‌شود.",
    },
    {
      id: "diagram",
      title: "طراحی یا اتصال نمودار OPC/FPC",
      icon: GitBranch,
      optional: true,
      goal: "ساخت نمودار فرایندی یا اتصال گام‌ها به فعالیت‌ها (اختیاری).",
      why: "نمودار، تصویر کلان جریان کار را می‌سازد؛ برای تحلیل زمان الزامی نیست.",
      prepare: "ترتیب گام‌ها و نوع هر گام (عملیات/حمل/بازرسی/تأخیر/انبارش).",
      how: [
        "در کارگاه نمودار، نمودار جدید OPC یا FPC بسازید.",
        "گام‌ها را رسم و در پنل خواص، فعالیت مرتبط هر گام را انتخاب کنید.",
        "از سمت فعالیت‌ها هم می‌توانید با دکمه اتصال، گام مرتبط بسازید.",
      ],
      example: "OPC خط پنل: آماده‌سازی → مونتاژ → بازرسی نهایی → بسته‌بندی.",
      openLabel: "رفتن به طراح نمودار",
      open: onOpenDiagrams,
    },
    {
      id: "times",
      title: "ورود زمان‌های اندازه‌گیری‌شده",
      icon: Table2,
      goal: "ثبت زمان‌ها در «برگه ثبت زمان» — جدول فعالیت × نمونه.",
      why: "این داده خام مطالعه است؛ همه محاسبات (میانگین، داده پرت، زمان استاندارد) از همین اعداد می‌آیند.",
      prepare: "زمان‌های اندازه‌گیری‌شده با کرنومتر/ابزار — مثلاً از دفتر یا Excel.",
      how: [
        "در «ثبت مشاهدات زمان‌سنجی» یک برگه جدید بسازید.",
        "فعالیت‌ها را به جدول اضافه کنید و تعداد نمونه‌ها را تنظیم کنید.",
        "هر سلول را پر کنید (مثل 12.5) یا کل جدول را از Excel بچسبانید.",
        "با «ذخیره برگه» ذخیره کنید.",
      ],
      example: "نصب قطعه در ۵ نمونه: 12.1 ، 12.5 ، 12.3 ، 12.2 ، 12.6 ثانیه.",
      openLabel: "رفتن به ثبت زمان",
      open: onOpenTiming,
    },
    {
      id: "interruptions",
      title: "ثبت وقفه‌ها و توضیحات",
      icon: Flag,
      optional: true,
      goal: "ثبت توقف‌های رخ‌داده هنگام اندازه‌گیری با علت و مدت.",
      why: "وقفه‌ها بخشی از واقعیت خط‌اند و زمینه بهبود را نشان می‌دهند؛ از زمان‌های عنصر جدا گزارش می‌شوند.",
      prepare: "یادداشت وقفه‌ها: علت، مدت، نمونه مرتبط.",
      how: [
        "در برگه ثبت، «ثبت وقفه» را بزنید.",
        "علت را از فهرست انتخاب کنید؛ اگر «سایر» است، علت را بنویسید (الزامی).",
        "مدت را وارد کنید یا اگر نامشخص است همان‌طور ثبت کنید.",
      ],
      example: "کمبود قطعه در نمونه ۳، مدت ۴۵ ثانیه؛ گفت‌وگو با سرپرست، مدت نامشخص.",
      openLabel: "رفتن به ثبت زمان",
      open: onOpenTiming,
    },
    {
      id: "check",
      title: "بررسی صحت داده‌ها",
      icon: CheckCircle2,
      goal: "کنترل مقادیر واردشده پیش از تحلیل.",
      why: "یک عدد اشتباه (مثلاً 125 به‌جای 12.5) نتیجه محاسبات را به‌شدت منحرف می‌کند.",
      prepare: "—",
      how: [
        "در جدول، سلول‌های نامعتبر با پیام فارسی مشخص می‌شوند.",
        "مقادیر غیرعادی (خیلی بزرگ/کوچک) را با میانگین سطر مقایسه کنید.",
        "با «ارسال به کارگاه تحلیل» داده‌ها قفل و وارد تحلیل می‌شوند.",
      ],
      example: "اگر میانگین سطر 12.3 ثانیه است و یک سلول 123 ثانیه، احتمالاً یک صفر اضافه ثبت شده است.",
      openLabel: "رفتن به ثبت زمان",
      open: onOpenTiming,
    },
    {
      id: "stats",
      title: "درک میانگین، میانه و داده پرت",
      icon: BarChart3,
      goal: "شناخت خروجی‌های آماری تحلیل.",
      why: "میانگین به‌تنهایی کافی نیست؛ میانه و داده پرت تصویر واقعی‌تری از زمان واقعی می‌دهند.",
      prepare: "—",
      how: [
        "میانگین = مجموع ÷ تعداد؛ حساس به داده پرت.",
        "میانه = مقدار وسط؛ در برابر داده پرت مقاوم است.",
        "داده پرت = مقداری که از بقیه جدا افتاده — نرم‌افزار با قاعده آماری آن را علامت می‌زند.",
      ],
      example: "نمونه‌های 12.1، 12.5، 12.3، 12.2، 24.6 → عدد 24.6 پرت است (تقریباً دو برابر بقیه).",
      openLabel: "رفتن به کارگاه تحلیل",
      open: onOpenAnalysis,
    },
    {
      id: "adequacy",
      title: "تشخیص کفایت نمونه",
      icon: Target,
      goal: "بررسی اینکه تعداد نمونه‌ها برای نتیجه قابل‌اعتماد کافی است.",
      why: "با نمونه کم، نتیجه‌ها با اطمینان پایین همراه‌اند؛ نرم‌افزار تعداد لازم را محاسبه می‌کند.",
      prepare: "—",
      how: [
        "در کارگاه تحلیل، شاخص کفایت نمونه هر عنصر را ببینید.",
        "اگر کافی نیست، در جلسه بعدی نمونه‌های بیشتری اندازه بگیرید و اضافه کنید.",
      ],
      example: "با ضریب تغییرات ~۵٪ و خطای هدف ۱۰٪، حدود ۱۰ نمونه لازم است.",
      openLabel: "رفتن به کارگاه تحلیل",
      open: onOpenAnalysis,
    },
    {
      id: "representative",
      title: "محاسبه زمان نماینده",
      icon: BarChart3,
      goal: "تعیین یک زمان معرف برای هر فعالیت.",
      why: "زمان نماینده خلاصه رفتار واقعی فعالیت است و ورودی محاسبات بعدی می‌شود.",
      prepare: "—",
      how: [
        "پس از ارسال برگه به تحلیل، زنجیره زمان خودکار محاسبه می‌شود.",
        "روش میانگین یا میانه بر اساس پروفایل انتخاب شده است.",
      ],
      example: "نماینده «نصب پیچ» با میانگین = (12.1+12.5+12.3+12.2+12.6)÷5 = 12.34 ثانیه.",
      openLabel: "رفتن به کارگاه تحلیل",
      open: onOpenAnalysis,
    },
    {
      id: "normal-standard",
      title: "محاسبه زمان نرمال و استاندارد",
      icon: Scale,
      goal: "رساندن زمان نماینده به زمان قابل‌تخصیص با ضریب عملکرد و مجازها.",
      why: "زمان استاندارد مبنای برنامه‌ریزی تولید، ظرفیت و هدف‌گذاری است.",
      prepare: "ضریب ارزیابی عملکرد اپراتور (درصورت انجام) و نرخ مجازهای سازمان.",
      how: [
        "زمان نرمال = زمان نماینده × ضریب عملکرد.",
        "زمان استاندارد = زمان نرمال + مجازها (درصد مجاز در پیکربندی).",
        "این زنجیره در کارگاه تحلیل با فرمول‌های نسخه‌دار محاسبه و قابل ردیابی است.",
      ],
      example: "12.34s × ضریب ۰.۹۵ = 11.72s نرمال؛ با مجاز ۱۲٪ → 13.13s استاندارد.",
      openLabel: "رفتن به کارگاه تحلیل",
      open: onOpenAnalysis,
    },
    {
      id: "balance",
      title: "انجام بالانس خط تولید",
      icon: Scale,
      optional: true,
      goal: "توزیع فعالیت‌ها بین ایستگاه‌ها برای هم‌ترازی خط با تاکت.",
      why: "خط نامتوازن یعنی ایستگاه گلوگاهی خسته و بقیه بیکار — بالانس توزیع کار را بهینه می‌کند.",
      prepare: "زمان‌های تحلیل‌شده + تقاضا/زمان در دسترس (برای تاکت).",
      how: [
        "در کارگاه بالانس، سناریو بسازید و تاکت را مستقیم یا از تقاضا وارد کنید.",
        "الگوریتم را اجرا کنید و نمودار یامازومی و شاخص‌ها را ببینید.",
      ],
      example: "با تاکت ۳۰ ثانیه و فعالیت‌های 8+12+7+9 ثانیه، ترکیب‌های ایستگاه بررسی می‌شود.",
      openLabel: "رفتن به کارگاه بالانس",
      open: onOpenBalance,
    },
    {
      id: "report",
      title: "دریافت گزارش نهایی",
      icon: FileText,
      goal: "خروجی قابل ارائه از کل مطالعه.",
      why: "گزارش، خروجی قابل دفاع برای مدیریت و مبنای تصمیم بهبود است.",
      prepare: "—",
      how: [
        "در کارگاه تحلیل، از تب گزارش‌ها قالب را انتخاب کنید.",
        "خروجی را در قالب مناسب دریافت کنید — همه اعداد با ردیابی منبع داده‌اند.",
      ],
      example: "گزارش شامل: میانگین/انحراف هر فعالیت، زمان‌های نماینده/نرمال/استاندارد و ارجاع به برگه ثبت.",
      openLabel: "رفتن به گزارش‌های تحلیل",
      open: onOpenAnalysis,
    },
  ], [onBack, onOpenStations, onOpenConfig, onOpenDiagrams, onOpenTiming, onOpenAnalysis, onOpenBalance]);

  const step = steps[current];
  const completedCount = steps.filter((s) => done[s.id]).length;
  const progressPct = Math.round((completedCount / steps.length) * 100);

  const toggleDone = useCallback(() => {
    setDone((prev) => ({ ...prev, [step.id]: !prev[step.id] }));
  }, [step]);

  const go = useCallback((delta: number) => {
    setCurrent((c) => Math.max(0, Math.min(steps.length - 1, c + delta)));
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  }, [steps.length]);

  const Icon = step.icon;

  return (
    <div className="space-y-5">
      <PageHeader
        title="راهنمای انجام مطالعه زمان‌سنجی از ابتدا تا گزارش نهایی"
        description={`پیشرفت شما ذخیره می‌شود — ${faDigits(completedCount)} از ${faDigits(steps.length)} مرحله تکمیل شده.`}
        actions={
          <Button variant="outline" onClick={onBack} className="gap-2">
            <ArrowRight className="size-4" aria-hidden /> بازگشت به پروژه
          </Button>
        }
      />

      <Card className="py-0">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>مرحله {faDigits(current + 1)} از {faDigits(steps.length)}</span>
            <span>{faDigits(progressPct)}٪</span>
          </div>
          <Progress value={progressPct} aria-label="پیشرفت راهنما" />
          <div className="flex flex-wrap gap-1">
            {steps.map((s, i) => (
              <button
                key={s.id}
                onClick={() => { setCurrent(i); window.scrollTo({ top: 0 }); }}
                aria-label={`مرحله ${faDigits(i + 1)}: ${s.title}`}
                title={`${s.title}${s.optional ? " (اختیاری)" : ""}`}
                className={`size-2.5 rounded-full transition-colors ${
                  i === current ? "bg-primary scale-125" : done[s.id] ? "bg-primary/60" : "bg-border"
                }`}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ناوبری مراحل */}
      <nav aria-label="فهرست مراحل" className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map((s, i) => {
          const StepIcon = s.icon;
          return (
            <button
              key={s.id}
              onClick={() => { setCurrent(i); window.scrollTo({ top: 0 }); }}
              className={`flex items-center gap-2 rounded-lg border p-2.5 text-start text-xs transition-colors hover:bg-accent ${
                i === current ? "border-primary/60 bg-primary/5" : ""
              }`}
              aria-current={i === current ? "step" : undefined}
            >
              <StepIcon className={`size-4 shrink-0 ${done[s.id] ? "text-primary" : "text-muted-foreground"}`} aria-hidden />
              <span className="min-w-0 flex-1 truncate">
                {faDigits(i + 1)}. {s.title}
              </span>
              {s.optional ? <Badge variant="outline" className="text-[9px]">اختیاری</Badge> : null}
              {done[s.id] ? <CheckCircle2 className="size-3.5 shrink-0 text-primary" aria-hidden /> : null}
            </button>
          );
        })}
      </nav>

      {/* محتوای مرحله */}
      <Card className="py-0">
        <CardHeader className="space-y-1 p-4 pb-2">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-5" aria-hidden />
            </span>
            {faDigits(current + 1)}. {step.title}
            {step.optional ? <Badge variant="outline" className="text-[10px]">مرحله اختیاری — می‌توانید رد کنید</Badge> : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          <div className="grid gap-3 text-sm leading-7 sm:grid-cols-2">
            <div className="rounded-lg border p-3">
              <p className="mb-1 text-xs font-semibold text-muted-foreground">هدف این مرحله</p>
              <p>{step.goal}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="mb-1 text-xs font-semibold text-muted-foreground">چرا به آن نیاز دارید؟</p>
              <p>{step.why}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="mb-1 text-xs font-semibold text-muted-foreground">اطلاعاتی که باید آماده کنید</p>
              <p>{step.prepare}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="mb-1 text-xs font-semibold text-muted-foreground">مثال واقعی صنعتی</p>
              <p className="rounded-md bg-muted/50 p-2 text-[13px]">{step.example}</p>
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold text-muted-foreground">روش انجام</p>
            <ol className="space-y-1.5 text-sm leading-7">
              {step.how.map((h, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-1 grid size-5 shrink-0 place-items-center rounded-full bg-primary/10 font-mono text-[10px] text-primary">
                    {faDigits(i + 1)}
                  </span>
                  {h}
                </li>
              ))}
            </ol>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => go(-1)} disabled={current === 0} className="gap-1.5">
                <ArrowRight className="size-4" aria-hidden /> مرحله قبل
              </Button>
              <Button variant="outline" size="sm" onClick={() => go(1)} disabled={current === steps.length - 1} className="gap-1.5">
                مرحله بعد <ArrowLeft className="size-4" aria-hidden />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant={done[step.id] ? "default" : "outline"} size="sm" onClick={toggleDone} className="gap-1.5">
                <CheckCircle2 className="size-4" aria-hidden /> {done[step.id] ? "تکمیل شد ✓" : "علامت‌گذاری به‌عنوان انجام‌شده"}
              </Button>
              {step.open ? (
                <Button size="sm" onClick={step.open} className="gap-1.5">
                  {step.openLabel ?? "رفتن به بخش مربوطه"} <ArrowLeft className="size-4" aria-hidden />
                </Button>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
