"use client";

/**
 * تب راهنما — روش‌شناسی با منابع (بند ۴/۱۰ — صداقت ADR-008):
 * الگوریتم‌ها، فرمول شاخص‌ها، فرض‌ها و نبودِ ادعای بهینگی قطعی.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info } from "lucide-react";
import type { BalanceOverviewDto } from "@/shared/contracts/balance";

interface GuideTabProps {
  overview: BalanceOverviewDto | undefined;
}

export function GuideTab({ overview }: GuideTabProps) {
  return (
    <div className="space-y-4">
      <Alert>
        <Info className="size-4" aria-hidden />
        <AlertTitle>صداقت روش</AlertTitle>
        <AlertDescription>
          راهکارهای الگوریتمی «بهترین راهکار یافت‌شده» هستند، نه «بهینه اثبات‌شده» (ADR-008).
          حل‌گر دقیق MILP/CP-SAT در نسخه پایه نیست — رابط افزونه برای افزودن آن‌ها طراحی شده و هزینه/مجوز آن مستند است.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">الگوریتم‌ها (کتابخانه فاز ۶)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-xs leading-relaxed">
          <div>
            <p className="font-medium">LCR — قاعده نامزد بزرگ</p>
            <p className="text-muted-foreground">فعالیت‌ها به ترتیب زمان نزولی؛ هر فعالیت در اولین ایستگاه ممکن (تقدم + ظرفیت + ناسازگاری) قرار می‌گیرد. ساده و قابل‌توضیح.</p>
          </div>
          <div>
            <p className="font-medium">RPW — وزن موقعیتی رتبه‌بندی‌شده (Helgeson–Birnie، ۱۹۶۱)</p>
            <p className="text-muted-foreground">وزن هر فعالیت = زمان خودش + مجموع زمان همه جانشینان (انتقالی)؛ ترتیب نزولی وزن، سپس جای‌گذاری حریصانه. تقدم را در اولویت‌بندی لحاظ می‌کند.</p>
          </div>
          <div>
            <p className="font-medium">KW — کیلبریج–وستر (Kilbridge–Wester، ۱۹۶۱)</p>
            <p className="text-muted-foreground">
              مرتب‌سازی بر اساس ستون‌های پیش‌نیازی (رتبه توپولوژیک) و زمان نزولی درون ستون.
              ساده‌سازی مستند: جای‌گذاری حریصانه در اولین ایستگاه ممکن — نه نسخه کلاسیک «پرکردن پیوسته ستون‌ها» (KNOWN_LIMITATIONS).
            </p>
          </div>
          <div>
            <p className="font-medium">دستی — کنترل انسانی</p>
            <p className="text-muted-foreground">تخصیص کاربر با اعتبارسنجی فوری: نقض سخت (تقدم/ناسازگاری) رد با دلیل؛ اضافه‌بار ظرفیت با هشدار ذخیره و شاخص‌ها فوری بازمحاسبه می‌شوند.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">فرمول شاخص‌ها (مستند — FORMULA_CATALOG §BAL)</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-2 text-xs leading-relaxed">
            <div><dt className="font-medium">تاکت‌تایم</dt><dd className="text-muted-foreground">Takt = زمان خالص در دسترس ÷ تقاضا — یا ورودی مستقیم؛ خالص = منهای وقفه‌های برنامه‌ریزی‌شده.</dd></div>
            <div><dt className="font-medium">بار سریال ایستگاه</dt><dd className="text-muted-foreground">Σ(دستی + ماشینی + انتظار) فعالیت‌های غیرهم‌پوشان — زمان machineAuto هرگز به کار اپراتور جمع نمی‌شود.</dd></div>
            <div><dt className="font-medium">بیکاری ایستگاه</dt><dd className="text-muted-foreground">تاکت − بار سریال (منفی = اضافه‌بار/گلوگاه).</dd></div>
            <div><dt className="font-medium">راندمان بالانس</dt><dd className="text-muted-foreground">E = ΣT سریال ÷ (m × C) — مخرج: تعداد ایستگاه × بیشینه بار (گلوگاه).</dd></div>
            <div><dt className="font-medium">تأخیر بالانس</dt><dd className="text-muted-foreground">d = ۱ − E.</dd></div>
            <div><dt className="font-medium">حداقل نظری ایستگاه</dt><dd className="text-muted-foreground">mMin = ceil(ΣT سریال ÷ تاکت) — کران پایین با فرض: بدون تجزیه فعالیت، همه فعالیت‌ها ≤ تاکت، بدون قیود منطقی/فضایی.</dd></div>
            <div><dt className="font-medium">نیروی نظری هر شیفت</dt><dd className="text-muted-foreground">ceil(ΣT اپراتور ÷ تاکت) — جدا از «نیروی عملیاتی» (فرض ۱ اپراتور/ایستگاه). «ایستگاه» و «نیروی شیفت» دو مفهوم غیرهمسان‌اند.</dd></div>
            <div><dt className="font-medium">هم‌پوشانی</dt><dd className="text-muted-foreground">فعالیت‌های هم‌پوشان به بار سریال جمع نمی‌شوند (فرض هم‌زمانی) و جدا گزارش می‌شوند — جمع کورکورانه ممنوع (بند ۷).</dd></div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">وضعیت داده این پروژه</CardTitle>
        </CardHeader>
        <CardContent className="text-xs leading-relaxed text-muted-foreground">
          {overview ? (
            <ul className="space-y-1">
              <li>◆ فعالیت فعال: {overview.readiness.activitiesActive} — جلسات نهایی‌شده تحلیل: {overview.readiness.finalizedSessions}</li>
              <li>◆ فعالیت با زمان معتبر: مشاهده‌شده {overview.readiness.activitiesWithTime.observed} · نماینده {overview.readiness.activitiesWithTime.representative} · نرمال {overview.readiness.activitiesWithTime.normal} · استاندارد {overview.readiness.activitiesWithTime.standard}</li>
              <li>◆ فعالیت بدون زمان از تخصیص کنار گذاشته می‌شود (بدون عدد جعلی) — با «بازتنظیم دستی» در ورودی سناریو زمان بدهید.</li>
            </ul>
          ) : (
            <p>در حال بارگذاری…</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">منابع روش</CardTitle>
        </CardHeader>
        <CardContent className="text-[11px] leading-relaxed text-muted-foreground">
          <ul className="space-y-1">
            <li>◆ Helgeson, W. & Birnie, D. (1961) — Ranked Positional Weight method (RPW).</li>
            <li>◆ Kilbridge, M. & Wester, L. (1961) — A heuristic method of assembly line balancing.</li>
            <li>◆ مرور مسائل SALB/MALB: MDPI Sensors (2025) و Production Engineering Archives (2026) — STANDARDS_CATALOG ردیف ۷ و ۸.</li>
            <li>◆ Nof, H. (ed.), Handbook of Industrial Engineers — شاخص‌های بالانس و تعریف تاکت.</li>
            <li>◆ ADR-008 (مخزن): تصمیم سه الگوریتم قطعی + Manual؛ بدون MILP/CP-SAT در پایه با استدلال هزینه/مجوز/قطعیت.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
