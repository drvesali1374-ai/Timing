"use client";

/**
 * تب راهنمای تحلیل — منابع و روش هر پروفایل (بند ۹ فاز ۵).
 * هیچ مقدار مجاز زمان بی‌منبع به‌عنوان معیار جهان‌شمول نمایش داده نمی‌شود؛
 * منبع/نسخه/فرض/محدودیت پروفایل و فرمول‌ها صریح ثبت می‌شوند.
 */

import { BookOpen, ExternalLink, Info, ShieldQuestion } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ALLOWANCE_BASE_FA, OUTLIER_RULE_SOURCES_FA } from "@/shared/analysis/types";
import type { AnalysisDto } from "@/shared/contracts/analysis";
import { MethodNotes } from "./analysis-bits";

export function GuideTab({ analysis }: { analysis: AnalysisDto | undefined }) {
  if (!analysis) return null;
  const p = analysis.profile;

  return (
    <div className="space-y-4">
      {/* پروفایل روش‌شناختی — بند ۹ */}
      <Card className="py-0">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <BookOpen className="size-4 text-primary" aria-hidden /> پروفایل روش‌شناختی این پروژه
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-4 pt-0 text-xs leading-6">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <p className="text-[11px] text-muted-foreground">الگو</p>
              <p className="font-medium">{p.nameFa ?? "ثبت‌نشده — پیش‌فرض‌های محصول"}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">نسخه الگو</p>
              <p className="font-mono" dir="ltr">{p.templateVersion ?? "—"}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">منبع</p>
              <p className="font-medium">
                {p.sourceName ?? "—"}
                {p.sourceVersion ? ` — نسخه ${p.sourceVersion}` : ""}
              </p>
              {p.sourceUrl ? (
                <a href={p.sourceUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline">
                  <ExternalLink className="size-3" aria-hidden /> مشاهده منبع
                </a>
              ) : null}
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">قرارداد مجاز فعال</p>
              <p className="font-medium">{ALLOWANCE_BASE_FA[analysis.settings.allowanceMethod]}</p>
            </div>
          </div>

          {p.assumptionsFa.length > 0 ? (
            <div>
              <p className="mb-1 text-[11px] font-semibold">فرض‌های پروفایل:</p>
              <ul className="list-inside list-disc space-y-0.5 text-[11px] text-muted-foreground">
                {p.assumptionsFa.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {p.limitationsFa.length > 0 ? (
            <div>
              <p className="mb-1 text-[11px] font-semibold">محدودیت‌های پروفایل:</p>
              <ul className="list-inside list-disc space-y-0.5 text-[11px] text-muted-foreground">
                {p.limitationsFa.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* هشدار «استاندارد جهانی نیست» — بند ۹ */}
      <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4 text-xs leading-6 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200" role="note">
        <p className="flex items-start gap-2 font-semibold">
          <ShieldQuestion className="mt-0.5 size-4 shrink-0" aria-hidden />
          هیچ مقدار مجاز زمان، معیار جهان‌شمول نیست
        </p>
        <p className="mt-1">
          نرخ مجاز فعال ({analysis.settings.allowanceRatePct}٪) و ضریب ارزیابی ({analysis.settings.ratingEnabled ? `${analysis.settings.ratingFactorPct}٪` : "غیرفعال"}) مقادیری
          سازمانی/پیشنهادی‌اند؛ اعتبار آنها به منبع، شرایط کاری و توافق سازمان وابسته است. این سامانه آنها را «تنظیم صریح پروژه» با تاریخچه نسخه نمایش می‌دهد، نه استاندارد جهانی.
        </p>
      </div>

      {/* کاتالوگ فرمول‌های نسخه‌دار — خروجی فاز ۵ */}
      <Card className="py-0">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">کاتالوگ فرمول‌های نسخه‌دار (عنصر/چرخه)</CardTitle>
          <p className="text-[11px] text-muted-foreground">فرمول‌های فعال این پروژه با منبع روش‌شناختی — نسخه هر فرمول در همه خروجی‌ها ردیابی می‌شود.</p>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">کلید</TableHead>
                  <TableHead className="text-right">نام</TableHead>
                  <TableHead className="text-right">نسخه</TableHead>
                  <TableHead className="text-right">سطح</TableHead>
                  <TableHead className="text-right">وضعیت</TableHead>
                  <TableHead className="text-right">منبع</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analysis.formulaCatalog.map((f) => (
                  <TableRow key={f.key}>
                    <TableCell className="py-2 font-mono text-xs" dir="ltr">{f.key}</TableCell>
                    <TableCell className="max-w-40 truncate py-2 text-xs" title={f.descriptionFa}>{f.nameFa}</TableCell>
                    <TableCell className="py-2 font-mono text-xs" dir="ltr">{f.semver}</TableCell>
                    <TableCell className="py-2 text-[11px] text-muted-foreground">{f.scopeLevel}</TableCell>
                    <TableCell className="py-2">
                      <Badge variant="outline" className={f.status === "active" ? "text-[10px] text-emerald-700" : "text-[10px] text-muted-foreground"}>
                        {f.status === "active" ? "فعال" : f.status === "deprecated" ? "منسوخ" : "پیش‌نویس"}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-52 py-2 text-[10px] text-muted-foreground" title={f.assumptionsFa.join(" · ")}>{f.sourceFa}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* منابع آماری و قواعد پرت */}
      <Card className="py-0">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Info className="size-4 text-primary" aria-hidden /> منابع روش‌های آماری و قواعد پرت
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <ul className="space-y-1.5 text-[11px] leading-6 text-muted-foreground">
            <li>· میانگین/میانه/انحراف معیار نمونه (n−1): ریاضی محض — تصحیح بسل (TS-001/002، ST-001).</li>
            <li>· چندک با درون‌یابی خطی (نوع ۷): Hyndman &amp; Fan (۱۹۹۶) — پیش‌فرض R/NumPy.</li>
            <li>· قاعده پرت فعال: {OUTLIER_RULE_SOURCES_FA[analysis.settings.outlierRule]} — تشخیص ≠ حذف خودکار.</li>
            <li>· فاصله اطمینان تقریب نرمال x̄ ± z·s/√n و کفایت n_req=(z·CV/e)²: آمار استاندارد (ST-010) — فرض‌ها در تب کیفیت نمونه.</li>
            <li>· z-score سه‌سیگمایی: غربال رایج — «مشکوک»، نه اثبات پرت.</li>
            <li>· زنجیره زمان: TS-010 (ILO مفهومی)، TS-011/TS-012 (روش رایج مجاز) — دو قرارداد نابرابر.</li>
          </ul>
        </CardContent>
      </Card>

      <MethodNotes notes={analysis.guideFa} />
    </div>
  );
}
