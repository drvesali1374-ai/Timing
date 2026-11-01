"use client";

/**
 * تب مقایسه — بند ۵/۸/۹ فاز ۶: مقایسه وضع موجود/پیشنهادی و مقایسه
 * راهکارهای الگوریتمی/دستی این سناریو (تاریخچه append-only).
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LoadingBlock, ErrorState, EmptyState } from "@/components/app/ui-bits";
import { cn } from "@/lib/utils";
import type { BalanceScenarioDetailDto, BalanceResultDto } from "@/shared/contracts/balance";
import { faDigits, faPct, faSeconds, StatusChip } from "./balance-bits";

interface CompareTabProps {
  scenario: BalanceScenarioDetailDto | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

function ResultRow({ r, isCurrent, reference }: { r: BalanceResultDto; isCurrent: boolean; reference: BalanceResultDto | null }) {
  const m = r.metrics;
  const delta = reference
    ? {
        stations: m.stationCount - reference.metrics.stationCount,
        efficiency: (m.efficiencyPct ?? 0) - (reference.metrics.efficiencyPct ?? 0),
      }
    : null;
  return (
    <TableRow className={cn(isCurrent && "bg-muted/50")}>
      <TableCell className="text-xs">
        <div className="flex items-center gap-1.5">
          <span className="font-medium">{r.algorithmLabelFa}</span>
          {isCurrent ? <Badge className="text-[9px]" variant="secondary">جاری</Badge> : null}
        </div>
        <span className="text-[10px] text-muted-foreground">
          {faDigits(r.algorithmVersion)} · {new Date(r.createdAt).toLocaleString("fa-IR")}
        </span>
      </TableCell>
      <TableCell><StatusChip status={r.status} /></TableCell>
      <TableCell className="text-xs tabular-nums">{faDigits(m.stationCount)}</TableCell>
      <TableCell className="text-xs tabular-nums">{faSeconds(m.bottleneckMs)}ث</TableCell>
      <TableCell className="text-xs tabular-nums">{faPct(m.efficiencyPct)}</TableCell>
      <TableCell className="text-xs tabular-nums">{faPct(m.delayPct)}</TableCell>
      <TableCell className="text-xs tabular-nums">{faSeconds(m.totalIdleMs)}ث</TableCell>
      <TableCell className="text-xs tabular-nums">{faDigits(m.operationalOperators)}</TableCell>
      <TableCell className="text-xs tabular-nums">
        {m.objectiveValue != null ? faDigits(m.objectiveValue.toFixed(3)) : "—"}
        {delta ? (
          <span className={cn("ms-1 text-[9px]", delta.stations < 0 ? "text-emerald-600" : delta.stations > 0 ? "text-rose-600" : "text-muted-foreground")}>
            ({delta.stations > 0 ? "+" : ""}{faDigits(delta.stations)} ایستگاه)
          </span>
        ) : null}
      </TableCell>
    </TableRow>
  );
}

export function CompareTab({ scenario, isLoading, isError, onRetry }: CompareTabProps) {
  if (isLoading) return <LoadingBlock lines={6} />;
  if (isError) return <ErrorState message="خطا در بارگذاری سناریو." onRetry={onRetry} />;
  if (!scenario) return <EmptyState title="سناریویی انتخاب نشده است" description="از تب «سناریوها» انتخاب کنید." />;

  const results = scenario.results;
  const current = scenario.currentResult;
  const hasReference = scenario.scenario.inputs.referenceAssignment !== null;

  if (!current) {
    return (
      <EmptyState
        title="نتیجه‌ای برای مقایسه وجود ندارد"
        description="از تب «یامازومی» الگوریتم‌ها را اجرا کنید — هر اجرا در تاریخچه ثبت می‌شود و اینجا قابل مقایسه است."
      />
    );
  }

  // مرجع مقایسه: اولین نتیجه ثبت‌شده (وضع اولیه) — دلتا نسبت به آن
  const first = results.length > 0 ? results[results.length - 1] : null;

  return (
    <div className="space-y-4">
      {hasReference ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">مقایسه وضع موجود ↔ پیشنهادی</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs leading-relaxed">
            <p>
              تخصیص مرجع «وضع موجود» در ورودی سناریو ثبت شده است — شاخص «جابه‌جایی نسبت به مرجع»
              در جدول زیر برای نتیجه جاری: {current.metrics.changesVsReference != null ? `${faDigits(current.metrics.changesVsReference)} فعالیت` : "—"}
            </p>
            <p className="text-[10px] text-muted-foreground">
              برای مقایسه کامل قبل/بعد، وضع موجود را به‌صورت یک نتیجه دستی (تب «ماتریس تخصیص») ثبت کنید تا در تاریخچه و جدول پایین کنار راهکارهای پیشنهادی قرار گیرد.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">مقایسه راهکارها (بدون مرجع وضع موجود)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs leading-relaxed text-muted-foreground">
              تخصیص وضع موجود در ورودی این سناریو ثبت نشده است — مقایسه «قبل/بعد» محدود به دلتای راهکارهاست.
              برای فعال‌سازی، در ورودی سناریو «تخصیص مرجع» را ثبت کنید یا وضع موجود را به‌صورت نتیجه دستی ذخیره کنید.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">تاریخچه راهکارها — {faDigits(results.length)} نتیجه (جدید → قدیم)</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">راهکار</TableHead>
                <TableHead className="text-xs">وضعیت</TableHead>
                <TableHead className="text-xs">ایستگاه</TableHead>
                <TableHead className="text-xs">گلوگاه</TableHead>
                <TableHead className="text-xs">راندمان E</TableHead>
                <TableHead className="text-xs">تأخیر d</TableHead>
                <TableHead className="text-xs">بیکاری</TableHead>
                <TableHead className="text-xs">نیرو</TableHead>
                <TableHead className="text-xs">هدف</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((r) => (
                <ResultRow key={r.id} r={r} isCurrent={r.id === current.id} reference={first && r.id !== first.id ? first : null} />
              ))}
            </TableBody>
          </Table>
          <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
            «بهترین راهکار یافت‌شده» نه «بهینه قطعی» (ADR-008) — مقایسه برای تصمیم مهندس است؛
            دلتا نسبت به قدیمی‌ترین نتیجه نمایش داده می‌شود.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
