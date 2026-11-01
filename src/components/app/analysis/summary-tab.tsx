"use client";

/**
 * تب خلاصه — KPIها + تنظیمات صریح پروژه + جلسات (فاز ۵ بند ۳/۴).
 * تنظیمات با منبع/یادداشت صداقت نمایش داده می‌شوند؛ ویرایش از کارگاه پیکربندی
 * (پارامترهای project-scope موجود) انجام می‌شود — نه دکمه جادویی در تحلیل.
 */

import { CalendarClock, ClipboardList, GitBranch, Sigma, Timer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TIMING_METHOD_LABELS_FA } from "@/shared/timing/types";
import { ALLOWANCE_BASE_FA } from "@/shared/analysis/types";
import type { AnalysisDto } from "@/shared/contracts/analysis";
import { faDigits, fmtSec, HonestyWarnings, MethodNotes, StepStatusBadge } from "./analysis-bits";

export function SummaryTab({ analysis }: { analysis: AnalysisDto | undefined }) {
  if (!analysis) return null;
  const totalObs = analysis.elements.reduce((a, e) => a + e.counts.total, 0);
  const usableObs = analysis.elements.reduce((a, e) => a + e.counts.usable, 0);
  const excludedObs = analysis.elements.reduce((a, e) => a + e.counts.userExcluded, 0);

  const kpis = [
    { k: "جلسات نهایی‌شده", v: faDigits(analysis.sessions.length), icon: ClipboardList },
    { k: "عناصر تحلیل‌شده", v: faDigits(analysis.elements.length), icon: Sigma },
    { k: "کل مشاهدات", v: faDigits(totalObs), icon: Timer },
    { k: "قابل استفاده", v: faDigits(usableObs), icon: CalendarClock },
    { k: "حذف با علامت", v: faDigits(excludedObs), icon: GitBranch },
  ];

  return (
    <div className="space-y-5">
      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.k} className="py-0">
              <CardContent className="flex items-center gap-3 p-4">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-4.5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground">{item.k}</p>
                  <p className="font-mono text-lg font-bold tabular-nums">{item.v}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* زنجیره استاندارد چرخه */}
      <Card className="py-0">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
            <GitBranch className="size-4 text-primary" aria-hidden /> زمان استاندارد چرخه (Σ عناصر معتبر)
            <StepStatusBadge status={analysis.standardCycle.status} />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 p-4 pt-0">
          <p className="text-2xl font-bold tabular-nums" dir="ltr">
            {analysis.standardCycle.totalMs !== null ? `${fmtSec(analysis.standardCycle.totalMs)} s` : "—"}
          </p>
          <p className="text-xs text-muted-foreground">
            {faDigits(analysis.standardCycle.validElements)} عنصر معتبر از {faDigits(analysis.elements.length)} عنصر — مرز چرخه = مجموع عناصر (TS-004؛ جمع کورکورانه رویدادهای موازی نیست).
          </p>
          <HonestyWarnings warnings={analysis.standardCycle.warningsFa} />
        </CardContent>
      </Card>

      {/* تنظیمات صریح پروژه — بند ۳/۴ فاز ۵ */}
      <Card className="py-0">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">تنظیمات صریح تحلیل (پارامترهای پروژه)</CardTitle>
          <p className="text-[11px] text-muted-foreground">
            این مقادیر از پیکربندی پروژه خوانده می‌شوند (کارگاه پیکربندی → فرم مقادیر)؛ تغییر آنها اثر فوری بر زنجیره دارد و در نسخه‌های پیکربندی ردیابی می‌شود.
          </p>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">پارامتر</TableHead>
                <TableHead className="text-right">مقدار فعال</TableHead>
                <TableHead className="text-right">یادداشت صداقت</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analysis.settingsSources.map((s) => (
                <TableRow key={s.stableKey}>
                  <TableCell className="py-2 text-xs">{s.nameFa}</TableCell>
                  <TableCell className="py-2 text-xs font-medium">{s.valueLabelFa}</TableCell>
                  <TableCell className="py-2 text-[11px] text-muted-foreground">
                    {s.noteFa ?? (
                      s.stableKey === "allowance.method" ? (
                        <span>{ALLOWANCE_BASE_FA[analysis.settings.allowanceMethod]} — دو قرارداد نابرابرند.</span>
                      ) : (
                        "—"
                      )
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* جلسات */}
      <Card className="py-0">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">جلسات نهایی‌شده — ورودی تحلیل</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="max-h-80 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">ناظر</TableHead>
                  <TableHead className="text-right">روش</TableHead>
                  <TableHead className="text-right">چرخه‌ها</TableHead>
                  <TableHead className="text-right">مشاهدات</TableHead>
                  <TableHead className="text-right">میانگین چرخه (s)</TableHead>
                  <TableHead className="text-right">زمینه</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analysis.sessions.map((s) => (
                  <TableRow key={s.sessionId}>
                    <TableCell className="py-2 text-xs">{s.observer}</TableCell>
                    <TableCell className="py-2 text-xs">{TIMING_METHOD_LABELS_FA[s.method]}</TableCell>
                    <TableCell className="py-2 font-mono text-xs tabular-nums">
                      {faDigits(s.cyclesValid)}/{faDigits(s.cyclesTotal)}
                      {s.cyclesSuspect > 0 ? <Badge variant="outline" className="ms-1 text-[9px] text-amber-700">{faDigits(s.cyclesSuspect)} مشکوک</Badge> : null}
                      {s.cyclesRecovered > 0 ? <Badge variant="outline" className="ms-1 text-[9px] text-violet-700">{faDigits(s.cyclesRecovered)} بازیابی</Badge> : null}
                    </TableCell>
                    <TableCell className="py-2 font-mono text-xs tabular-nums">{faDigits(s.observationsCount)}</TableCell>
                    <TableCell className="py-2 font-mono text-xs tabular-nums" dir="ltr">{fmtSec(s.meanCycleTimeMs)}</TableCell>
                    <TableCell className="py-2 text-[11px] text-muted-foreground">
                      {Object.entries(s.sessionContext).length > 0
                        ? Object.entries(s.sessionContext).map(([k, v]) => `${k.split(".").pop()}: ${v}`).join(" · ")
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <MethodNotes notes={analysis.guideFa.slice(0, 3)} />
    </div>
  );
}
