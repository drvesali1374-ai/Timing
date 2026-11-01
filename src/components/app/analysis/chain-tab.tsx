"use client";

/**
 * تب زنجیره زمان — مشاهده‌شده ← نماینده ← نرمال ← استاندارد (B4 · بند ۳/۴/۵ فاز ۵).
 * پایه درصد مجاز و ضریب ارزیابی صریح نمایش می‌یابد؛ هر گام به نسخه فرمول
 * و مشاهدات ورودی قابل ردیابی است؛ گام وابسته بی‌داده = «تکمیل‌نشده» صادقانه.
 */

import { ArrowLeft, Sigma } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ALLOWANCE_BASE_FA } from "@/shared/analysis/types";
import type { AnalysisDto } from "@/shared/contracts/analysis";
import { faDigits, fmtSec, HonestyWarnings, MethodNotes, StepStatusBadge } from "./analysis-bits";

export function ChainTab({ analysis }: { analysis: AnalysisDto | undefined }) {
  if (!analysis) return null;
  const s = analysis.settings;

  return (
    <div className="space-y-4">
      {/* هدر قراردادها — پایه درصد روشن (بند ۴) */}
      <Card className="py-0 border-primary/30 bg-primary/5">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-[11px] text-muted-foreground">روش تجمیع</p>
            <p className="text-sm font-semibold">
              {s.aggMethod === "mean" ? "میانگین (TS-001)" : s.aggMethod === "median" ? "میانه (TS-002)" : `قاعده پرت ${s.outlierRule} سپس میانگین`}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">ارزیابی عملکرد</p>
            <p className="text-sm font-semibold">
              {s.ratingEnabled ? `${faDigits(s.ratingFactorPct)}٪ (ضریب ${(s.ratingFactorPct / 100).toFixed(3)})` : "غیرفعال — «زمان خام»"}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">قرارداد مجاز</p>
            <p className="text-sm font-semibold" dir="rtl">
              {s.allowanceMethod === "on-normal" ? "ST = NT × (۱+r)" : "ST = NT ÷ (۱−r)"} با r={faDigits(s.allowanceRatePct)}٪
            </p>
            <p className="text-[10px] text-muted-foreground">{ALLOWANCE_BASE_FA[s.allowanceMethod]}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">نسخه پیکربندی</p>
            <p className="font-mono text-sm font-semibold" dir="ltr">{analysis.trace.configSemver ?? "—"}</p>
            <p className="text-[10px] text-muted-foreground">
              {analysis.trace.formulaVersions.map((f) => `${f.key}@${f.semver}`).join(" · ") || "—"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* زنجیره هر عنصر */}
      <Card className="py-0">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Sigma className="size-4 text-primary" aria-hidden /> زنجیره کامل عناصر
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="max-h-[560px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right min-w-40">عنصر</TableHead>
                  <TableHead className="text-right">نماینده (s)</TableHead>
                  <TableHead className="text-right">نرمال/خام (s)</TableHead>
                  <TableHead className="text-right">استاندارد (s)</TableHead>
                  <TableHead className="text-right">فرمول‌ها (نسخه)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analysis.elements.map((e) => (
                  <TableRow key={e.elementKey}>
                    <TableCell className="py-2">
                      <p className="max-w-44 truncate text-xs font-medium" title={e.elementKey}>{e.elementName}</p>
                      <p className="text-[10px] text-muted-foreground">n مؤثر: {faDigits(e.counts.effective)}</p>
                    </TableCell>
                    <TableCell className="py-2">
                      <p className="font-mono text-xs tabular-nums" dir="ltr">{fmtSec(e.chain.representative.value)}</p>
                      <StepStatusBadge status={e.chain.representative.status} />
                    </TableCell>
                    <TableCell className="py-2">
                      <p className="font-mono text-xs tabular-nums" dir="ltr">{fmtSec(e.chain.normal.value)}</p>
                      <div className="mt-0.5 flex items-center gap-1">
                        <StepStatusBadge status={e.chain.normal.status} />
                        {!e.chain.normal.ratingApplied ? (
                          <Badge variant="outline" className="text-[9px] text-amber-700">خام</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px]">RF {faDigits(e.chain.normal.ratingFactorPct ?? 0)}٪</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-2">
                      <p className="font-mono text-xs tabular-nums" dir="ltr">{fmtSec(e.chain.standard.value)}</p>
                      <div className="mt-0.5 flex items-center gap-1">
                        <StepStatusBadge status={e.chain.standard.status} />
                        <Badge variant="outline" className="text-[9px]" title={e.chain.standard.baseFa}>
                          {e.chain.standard.allowanceMethod === "on-normal" ? "پایه: نرمال" : "پایه: استاندارد"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="py-2 text-[10px] text-muted-foreground" dir="ltr">
                      {e.formulaTrace
                        .filter((f) => f.formulaKey !== "—")
                        .map((f) => `${f.formulaKey}@${f.formulaSemver}`)
                        .join("\n")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* جمع چرخه + هشدارها */}
      <Card className="py-0">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
            جمع استاندارد چرخه
            <StepStatusBadge status={analysis.standardCycle.status} />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-4 pt-0">
          <div className="flex items-center gap-3">
            {analysis.elements
              .filter((e) => e.chain.standard.status === "valid")
              .slice(0, 8)
              .map((e, i, arr) => (
                <div key={e.elementKey} className="flex items-center gap-2">
                  <div className="rounded-lg border bg-card px-2.5 py-1.5 text-center">
                    <p className="max-w-24 truncate text-[10px] text-muted-foreground">{e.elementName}</p>
                    <p className="font-mono text-xs font-bold tabular-nums" dir="ltr">{fmtSec(e.chain.standard.value)}</p>
                  </div>
                  {i < arr.length - 1 ? <ArrowLeft className="size-3.5 text-muted-foreground" aria-hidden /> : null}
                </div>
              ))}
            {analysis.elements.filter((e) => e.chain.standard.status === "valid").length === 0 ? (
              <p className="text-xs text-muted-foreground">هیچ عنصر زمان استاندارد معتبر ندارد.</p>
            ) : null}
          </div>
          <p className="text-xl font-bold tabular-nums" dir="ltr">
            Σ = {analysis.standardCycle.totalMs !== null ? `${fmtSec(analysis.standardCycle.totalMs)} s` : "—"}
          </p>
          <HonestyWarnings warnings={analysis.standardCycle.warningsFa} />
          <MethodNotes
            notes={[
              "زنجیره با فرمول‌های نسخه‌دار پروژه (TS-001/002 → TS-010 → TS-011/012) از موتور فرمول فاز ۲ ارزیابی و با هسته مستقل راستی‌آزمایی متقابل می‌شود.",
              "بدون ارزیابی عملکرد، خروجی «زمان خام» نام دارد و «زمان نرمال قطعی» تلقی نمی‌شود (B4).",
              "دو قرارداد مجاز (on-normal/on-standard) نابرابرند؛ پایه درصد در ستون استاندارد و گزارش‌ها صریح است.",
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
