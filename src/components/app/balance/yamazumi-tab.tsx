"use client";

/**
 * تب یامازومی (Yamazumi/OBC) — بند ۸ فاز ۶.
 * ستون بار هر ایستگاه: پشته فعالیت‌ها (رنگ بر اساس نوع کار)، تفکیک
 * دستی/ماشینی/انتظار/هم‌پوشان، خط تاکت واضح و اجزای سازنده قابل مشاهده.
 * SVG خالص — بدون وابستگی نموداری (الگوی فاز ۵).
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { LoadingBlock, ErrorState, EmptyState } from "@/components/app/ui-bits";
import { cn } from "@/lib/utils";
import type { BalanceScenarioDetailDto } from "@/shared/contracts/balance";
import { useSolveBalance } from "@/hooks/use-balance";
import type { BalanceAlgorithmId, BalanceWorkType, StationLoad } from "@/shared/balance/types";
import { faDigits, faSeconds, WORK_TYPE_COLORS, WorkTypeBadge } from "./balance-bits";

interface YamazumiTabProps {
  projectId: string;
  scenario: BalanceScenarioDetailDto | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

const ALGO_OPTIONS: Array<{ id: BalanceAlgorithmId; labelFa: string }> = [
  { id: "lcr", labelFa: "LCR — قاعده نامزد بزرگ" },
  { id: "rpw", labelFa: "RPW — وزن موقعیتی (هلسون–برنی)" },
  { id: "kilbridge-wester", labelFa: "KW — کیلبریج–وستر" },
];

/** یک ستون یامازومی — پشته فعالیت‌ها با رنگ نوع کار */
function StationColumn({ station, taktMs, scale, activitiesById }: {
  station: StationLoad;
  taktMs: number;
  scale: number;
  activitiesById: Map<string, { id: string; name: string; workType: BalanceWorkType; timeMs: number }>;
}) {
  const W = 72;
  const GAP = 14;
  const OVERLAP_H = station.overlapMs > 0 ? Math.max(6, station.overlapMs * scale) : 0;
  // پشته از پایین به بالا: دستی/ماشینی/انتظار به ترتیب فعالیت‌های سریال، سپس نوار هم‌پوشان جدا
  const segments = station.activityIds
    .map((id) => activitiesById.get(id))
    .filter((a): a is { id: string; name: string; workType: BalanceWorkType; timeMs: number } => a !== undefined)
    .filter((a) => a.workType !== "overlap");

  const totalH = Math.max(station.serialMs * scale, 4);
  const overlapColor = "fill-rose-400 stroke-rose-500";

  // محاسبه موقعیت پشته (از پایین به بالا) — reduce بدون جهش متغیر
  const stack = segments.reduce<Array<{ a: { id: string; name: string; workType: BalanceWorkType; timeMs: number }; h: number; y: number }>>((acc, a) => {
    const h = Math.max(a.timeMs * scale, 2);
    const prevBottom = acc.length > 0 ? acc[acc.length - 1].y : totalH + 12;
    acc.push({ a, h, y: prevBottom - h });
    return acc;
  }, []);

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={W + GAP} height={totalH + OVERLAP_H + 24} role="img" aria-label={`ایستگاه ${station.station}: بار ${faSeconds(station.serialMs)} ثانیه`}>
        {/* خط تاکت */}
        <line x1={0} x2={W + GAP} y1={totalH + 12 - taktMs * scale} y2={totalH + 12 - taktMs * scale} stroke="currentColor" strokeWidth={1.5} strokeDasharray="5 4" className="text-rose-600" />
        <text x={W + GAP - 2} y={totalH + 12 - taktMs * scale - 3} textAnchor="end" fontSize={8} className="fill-rose-600">تاکت</text>

        {/* پشته — از پایین */}
        <g>
          {stack.map(({ a, h, y }) => (
            <g key={a.id}>
              <rect
                x={GAP / 2} y={y} width={W} height={h}
                rx={2}
                className={WORK_TYPE_COLORS[a.workType]}
                strokeWidth={0.5}
              >
                <title>{`${a.name} — ${faSeconds(a.timeMs)}ث (${a.workType})`}</title>
              </rect>
              {h >= 14 ? (
                <text x={GAP / 2 + W / 2} y={y + h / 2 + 3} textAnchor="middle" fontSize={7.5} className="fill-white font-medium">
                  {faSeconds(a.timeMs)}ث
                </text>
              ) : null}
            </g>
          ))}
        </g>

        {/* نوار هم‌پوشان — جدا از پشته سریال (جمع نمی‌شود — بند ۷) */}
        {station.overlapMs > 0 ? (
          <g>
            <rect x={GAP / 2} y={2} width={W} height={OVERLAP_H} rx={2} className={overlapColor} strokeWidth={0.5} opacity={0.75}>
              <title>{`هم‌پوشان: ${faSeconds(station.overlapMs)}ث — جمع نمی‌شود (فرض هم‌زمانی)`}</title>
            </rect>
            <text x={GAP / 2 + W / 2} y={2 + OVERLAP_H / 2 + 3} textAnchor="middle" fontSize={7.5} className="fill-white">هم‌پوشان {faSeconds(station.overlapMs)}ث</text>
          </g>
        ) : null}

        {/* خط پایه */}
        <line x1={GAP / 2} x2={GAP / 2 + W} y1={totalH + 12} y2={totalH + 12} stroke="currentColor" strokeWidth={1} className="text-foreground" />
      </svg>
      <p className="text-[11px] font-medium">ایستگاه {faDigits(station.station)}</p>
      <p className={cn("text-[10px] tabular-nums", station.serialMs > taktMs ? "font-semibold text-rose-600" : "text-muted-foreground")}>
        {faSeconds(station.serialMs)}ث / {faDigits(Math.round(station.loadPctOfTakt))}٪
      </p>
    </div>
  );
}

export function YamazumiTab({ projectId, scenario, isLoading, isError, onRetry }: YamazumiTabProps) {
  const [algo, setAlgo] = useState<BalanceAlgorithmId>("lcr");
  const solve = useSolveBalance(projectId, scenario?.scenario.id ?? null);

  if (isLoading) return <LoadingBlock lines={6} />;
  if (isError) return <ErrorState message="خطا در بارگذاری سناریو." onRetry={onRetry} />;
  if (!scenario) return <EmptyState title="سناریویی انتخاب نشده است" description="از تب «سناریوها» یک سناریو بسازید یا انتخاب کنید." />;

  const current = scenario.currentResult;
  const taktMs = scenario.problem.taktMs;
  const activitiesById = new Map(
    scenario.problem.activities.map((a) => [a.id, { id: a.id, name: a.name, workType: a.workType, timeMs: a.timeMs }]),
  );

  const maxLoad = Math.max(taktMs, ...(current?.stations.map((st) => st.serialMs) ?? [taktMs]));
  const scale = 240 / Math.max(maxLoad, 1); // پیکسل بر میلی‌ثانیه — تاکت در نمودار مرجع است

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">اجرای الگوریتم — {scenario.scenario.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="grid gap-1.5">
              <Label className="text-xs">الگوریتم</Label>
              <Select value={algo} onValueChange={(v) => setAlgo(v as BalanceAlgorithmId)}>
                <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ALGO_OPTIONS.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.labelFa}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="gap-2"
              disabled={solve.isPending}
              onClick={() => void solve.mutateAsync({ algorithm: algo })}
            >
              {solve.isPending ? "در حال اجرا…" : "اجرا و ذخیره نتیجه"}
            </Button>
            <p className="text-[10px] text-muted-foreground">
              تاکت: {faSeconds(taktMs)}ث ({scenario.problem.taktSourceFa}) — نتایج append-only ذخیره می‌شوند؛ مقایسه در تب «مقایسه».
            </p>
          </div>
          {current ? (
            <div className="flex flex-wrap gap-1.5">
              <span className="text-[10px] text-muted-foreground">آخرین نتیجه:</span>
              <span className="text-[10px] font-medium">{current.algorithmLabelFa}</span>
              {current.notesFa.map((n, i) => (
                <span key={i} className="text-[10px] text-muted-foreground">· {n}</span>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {!current ? (
        <EmptyState
          title="هنوز نتیجه‌ای برای این سناریو ذخیره نشده است"
          description="یک الگوریتم را اجرا کنید تا نمودار یامازومی، ماتریس تخصیص و شاخص‌ها ساخته شود."
        />
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              نمودار یامازومی — {faDigits(current.metrics.stationCount)} ایستگاه · گلوگاه {faSeconds(current.metrics.bottleneckMs)}ث
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2 text-[10px]">
              {(["operatorManual", "machineAuto", "waiting", "overlap"] as BalanceWorkType[]).map((wt) => (
                <span key={wt} className="flex items-center gap-1">
                  <span className={cn("inline-block size-2.5 rounded-sm", WORK_TYPE_COLORS[wt].split(" ")[0])} aria-hidden />
                  <WorkTypeBadge workType={wt} />
                </span>
              ))}
              <span className="flex items-center gap-1 text-muted-foreground">
                <span className="inline-block w-4 border-t-2 border-dashed border-rose-600" aria-hidden /> خط تاکت ({faSeconds(taktMs)}ث)
              </span>
            </div>

            <div className="overflow-x-auto pb-2">
              <div className="flex min-w-max items-end gap-1 pt-8">
                {current.stations.map((st) => (
                  <StationColumn key={st.station} station={st} taktMs={taktMs} scale={scale} activitiesById={activitiesById} />
                ))}
              </div>
            </div>

            <p className="text-[10px] leading-relaxed text-muted-foreground">
              ارتفاع پشته = بار سریال (دستی + ماشینی + انتظار)؛ نوار جداگانه بالای ستون = فعالیت‌های هم‌پوشان که به بار جمع نمی‌شوند (فرض هم‌زمانی — بند ۷).
              خط‌چین قرمز = تاکت. ستون بالاتر از خط = اضافه‌بار (گلوگاه).
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
