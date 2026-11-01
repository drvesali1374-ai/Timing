"use client";

/**
 * تب شاخص‌ها — بند ۶ فاز ۶: بار/بیکاری/گلوگاه/راندمان E/تأخیر d/حداقل نظری/
 * برآورد نیرو — هر شاخص با فرمول/مخرج مستند (FORMULA_CATALOG §BAL).
 * تفکیک «ایستگاه» از «نیروی شیفت» (بند ۷) و کار ماشین از کار اپراتور.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { LoadingBlock, ErrorState, EmptyState } from "@/components/app/ui-bits";
import { cn } from "@/lib/utils";
import type { BalanceScenarioDetailDto } from "@/shared/contracts/balance";
import { faDigits, faPct, faSeconds, MetricCard, ViolationsList } from "./balance-bits";

interface MetricsTabProps {
  scenario: BalanceScenarioDetailDto | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

export function MetricsTab({ scenario, isLoading, isError, onRetry }: MetricsTabProps) {
  if (isLoading) return <LoadingBlock lines={6} />;
  if (isError) return <ErrorState message="خطا در بارگذاری سناریو." onRetry={onRetry} />;
  if (!scenario) return <EmptyState title="سناریویی انتخاب نشده است" description="از تب «سناریوها» انتخاب کنید." />;

  const current = scenario.currentResult;
  if (!current) {
    return (
      <EmptyState
        title="شاخصی برای نمایش وجود ندارد"
        description="ابتدا از تب «یامازومی» الگوریتم را اجرا کنید — شاخص‌ها با هر نتیجه بازمحاسبه می‌شوند."
      />
    );
  }

  const m = current.metrics;
  const takt = scenario.problem.taktMs;
  const objectiveParts = [
    { label: "وزن ایستگاه", w: scenario.problem.objectives.minimizeStations },
    { label: "وزن یکنواختی", w: scenario.problem.objectives.smoothLoad },
    { label: "وزن تغییر", w: scenario.problem.objectives.minChanges },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard labelFa="تعداد ایستگاه (m)" value={faDigits(m.stationCount)} formulaFa="ایستگاه‌های غیرخالی نتیجه" />
        <MetricCard
          labelFa="گلوگاه (C)"
          value={`${faSeconds(m.bottleneckMs)}ث`}
          formulaFa="max بار سریال ایستگاه‌ها"
          tone={m.bottleneckMs > takt ? "bad" : "good"}
        />
        <MetricCard
          labelFa="راندمان بالانس (E)"
          value={faPct(m.efficiencyPct)}
          formulaFa="E = ΣT سریال ÷ (m × C) — مخرج: تعداد ایستگاه × بیشینه بار"
          tone={m.efficiencyPct != null && m.efficiencyPct >= 70 ? "good" : "warn"}
        />
        <MetricCard labelFa="تأخیر بالانس (d)" value={faPct(m.delayPct)} formulaFa="d = ۱ − E" />
        <MetricCard
          labelFa="حداقل نظری ایستگاه‌ها"
          value={m.minStationsTheoretical != null ? faDigits(m.minStationsTheoretical) : "—"}
          formulaFa="mMin = ceil(ΣT سریال ÷ تاکت) — فرض: بدون تجزیه فعالیت، بدون قیود منطقی/فضایی"
        />
        <MetricCard
          labelFa="نیروی نظری هر شیفت"
          value={m.theoreticalOperators != null ? faDigits(m.theoreticalOperators) : "—"}
          formulaFa="ceil(ΣT اپراتور ÷ تاکت) — کران پایین، جدا از پیشنهاد عملیاتی"
        />
        <MetricCard
          labelFa="نیروی عملیاتی"
          value={faDigits(m.operationalOperators)}
          formulaFa="فرض: ۱ اپراتور در هر ایستگاه — «ایستگاه» ≠ «نیروی شیفت» (تفکیک بند ۷)"
        />
        <MetricCard
          labelFa="اشتغال اپراتورها"
          value={faPct(m.operatorUtilizationPct)}
          formulaFa="ΣT اپراتور ÷ (m × تاکت)"
          tone={m.operatorUtilizationPct != null && m.operatorUtilizationPct > 100 ? "bad" : "default"}
        />
        <MetricCard labelFa="بیکاری کل" value={`${faSeconds(m.totalIdleMs)}ث`} formulaFa="Σ(تاکت − بار سریال هر ایستگاه)" />
        <MetricCard labelFa="زمان اپراتور (Σ)" value={`${faSeconds(m.totalOperatorMs)}ث`} formulaFa="دستی + بازرسی + حرکت + راه‌اندازی" />
        <MetricCard labelFa="زمان ماشین (Σ)" value={`${faSeconds(m.totalMachineMs)}ث`} formulaFa="machineAuto — جدا از کار اپراتور (هرگز جمع نمی‌شود)" />
        <MetricCard labelFa="هم‌پوشان (Σ)" value={`${faSeconds(m.totalOverlapMs)}ث`} formulaFa="جمع نمی‌شود — فرض هم‌زمانی (گزارش جدا)" />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">بار ایستگاه‌ها — نسبت به تاکت ({faSeconds(takt)}ث)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {current.stations.map((st) => (
            <div key={st.station} className="grid items-center gap-2 sm:grid-cols-[8rem_1fr_10rem]">
              <p className="text-xs font-medium">ایستگاه {faDigits(st.station)}</p>
              <div className="space-y-1">
                <Progress
                  value={Math.min(st.loadPctOfTakt, 100)}
                  className={cn("h-3", st.loadPctOfTakt > 100 ? "[&>div]:bg-rose-500" : st.loadPctOfTakt > 85 ? "[&>div]:bg-amber-500" : "[&>div]:bg-emerald-600")}
                  aria-label={`بار ایستگاه ${st.station}: ${Math.round(st.loadPctOfTakt)} درصد تاکت`}
                />
                <div className="flex flex-wrap gap-x-3 text-[10px] text-muted-foreground">
                  <span>دستی {faSeconds(st.operatorMs)}ث</span>
                  <span>ماشین {faSeconds(st.machineMs)}ث</span>
                  <span>انتظار {faSeconds(st.waitMs)}ث</span>
                  {st.overlapMs > 0 ? <span className="text-rose-600">هم‌پوشان {faSeconds(st.overlapMs)}ث (جمع‌نشده)</span> : null}
                </div>
              </div>
              <p className={cn("text-xs tabular-nums", st.serialMs > takt ? "font-semibold text-rose-600" : "text-muted-foreground")}>
                {faPct(st.loadPctOfTakt)} · بیکاری {faSeconds(st.idleMs)}ث
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">تابع هدف وزنی (بند ۵)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm font-semibold tabular-nums">
            مقدار: {m.objectiveValue != null ? faDigits(m.objectiveValue.toFixed(3)) : "—"}
            <span className="ms-1 text-[10px] font-normal text-muted-foreground">(کمتر = بهتر — «بهترین راهکار یافت‌شده» نه بهینه قطعی)</span>
          </p>
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            هدف = [w₁×(m÷mMin) + w₂×(σ بار÷تاکت) + w₃×(جابه‌جایی÷N)] ÷ Σw —
            نرمال‌سازی مستند در FORMULA_CATALOG §BAL؛ w₁/w₂/w₃ از ورودی سناریو:
            {" "}{objectiveParts.map((p) => `${p.label}=${faDigits(p.w.toFixed(2))}`).join(" · ")}
            {m.changesVsReference !== null ? ` — ${faDigits(m.changesVsReference)} جابه‌جایی نسبت به مرجع` : " — بدون مرجع وضع موجود"}
          </p>
        </CardContent>
      </Card>

      <ViolationsList violations={current.violations} title="گزارش قیود این نتیجه" />

      {current.notesFa.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">یادداشت‌های روش (صداقت ADR-008)</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-xs leading-relaxed text-muted-foreground">
              {current.notesFa.map((n, i) => (
                <li key={i}>◆ {n}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
