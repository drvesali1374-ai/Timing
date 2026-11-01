"use client";

/**
 * تب گراف تقدم/تأخر — بند ۲/۸ فاز ۶.
 * رسم SVG لایه‌ای بر اساس ستون‌های توپولوژیک + لبه‌های پیش‌نیازی +
 * گزارش چرخه/تناقض/اتصال نامعتبر/غیرقابل دستیابی (صادقانه).
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingBlock, ErrorState, EmptyState } from "@/components/app/ui-bits";
import type { BalanceScenarioDetailDto } from "@/shared/contracts/balance";
import type { BalanceActivity } from "@/shared/balance/types";
import { faDigits, faSeconds, ViolationsList } from "./balance-bits";
import { cn } from "@/lib/utils";

interface PrecedenceTabProps {
  scenario: BalanceScenarioDetailDto | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

/** گراف لایه‌ای — گره‌ها در ستون توپولوژیک خود */
function PrecedenceGraph({ activities, columns }: {
  activities: BalanceActivity[];
  columns: Record<string, number>;
}) {
  const NODE_W = 120;
  const NODE_H = 34;
  const COL_GAP = 70;
  const ROW_GAP = 14;

  const byId = new Map(activities.map((a) => [a.id, a]));
  const maxCol = Math.max(0, ...activities.map((a) => columns[a.id] ?? 0));
  const groups: BalanceActivity[][] = Array.from({ length: maxCol + 1 }, () => []);
  for (const a of activities) groups[columns[a.id] ?? 0].push(a);
  for (const g of groups) g.sort((x, y) => (x.id < y.id ? -1 : 1));

  const positions = new Map<string, { x: number; y: number }>();
  let yCursor = 0;
  const colOffsets: number[] = [];
  for (const g of groups) {
    colOffsets.push(yCursor);
    for (const a of g) {
      positions.set(a.id, { x: (columns[a.id] ?? 0) * (NODE_W + COL_GAP), y: yCursor });
      yCursor += NODE_H + ROW_GAP;
    }
    yCursor += ROW_GAP * 2;
  }
  const width = (maxCol + 1) * (NODE_W + COL_GAP) - COL_GAP + 20;
  const height = yCursor + 10;

  const edges: Array<{ from: string; to: string }> = [];
  for (const a of activities) {
    for (const p of a.predecessors) {
      if (byId.has(p)) edges.push({ from: p, to: a.id });
    }
  }

  return (
    <svg
      viewBox={`0 0 ${Math.max(width, 200)} ${Math.max(height, 100)}`}
      className="min-w-full"
      style={{ height: Math.max(height, 100) }}
      role="img"
      aria-label="گراف تقدم و تأخر فعالیت‌ها"
    >
      <defs>
        <marker id="arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
          <polygon points="0 0, 7 3.5, 0 7" className="fill-muted-foreground" />
        </marker>
      </defs>
      {edges.map((e, i) => {
        const from = positions.get(e.from);
        const to = positions.get(e.to);
        if (!from || !to) return null;
        const x1 = from.x + NODE_W;
        const y1 = from.y + NODE_H / 2;
        const x2 = to.x;
        const y2 = to.y + NODE_H / 2;
        const mx = (x1 + x2) / 2;
        return (
          <path
            key={i}
            d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
            fill="none"
            strokeWidth={1.2}
            className="stroke-muted-foreground/60"
            markerEnd="url(#arrow)"
          />
        );
      })}
      {activities.map((a) => {
        const pos = positions.get(a.id);
        if (!pos) return null;
        const missing = a.timeStatus === "missing";
        return (
          <g key={a.id}>
            <rect
              x={pos.x} y={pos.y} width={NODE_W} height={NODE_H} rx={6}
              className={cn(
                missing ? "fill-stone-100 stroke-stone-300 dark:fill-stone-800 dark:stroke-stone-600" : "fill-primary/10 stroke-primary/50",
              )}
              strokeWidth={1}
            />
            <text x={pos.x + 8} y={pos.y + 14} fontSize={9} className="fill-foreground font-medium">
              {a.id.length > 16 ? `${a.id.slice(0, 15)}…` : a.id}
            </text>
            <text x={pos.x + 8} y={pos.y + 26} fontSize={8} className="fill-muted-foreground">
              {missing ? "بدون زمان معتبر" : `${faSeconds(a.timeMs)}ث`}
            </text>
          </g>
        );
      })}
      {groups.map((g, i) =>
        g.length > 0 ? (
          <text key={i} x={i * (NODE_W + COL_GAP) + NODE_W / 2} y={colOffsets[i] - 4} textAnchor="middle" fontSize={8} className="fill-muted-foreground">
            ستون {faDigits(i + 1)}
          </text>
        ) : null,
      )}
    </svg>
  );
}

export function PrecedenceTab({ scenario, isLoading, isError, onRetry }: PrecedenceTabProps) {
  if (isLoading) return <LoadingBlock lines={6} />;
  if (isError) return <ErrorState message="خطا در بارگذاری سناریو." onRetry={onRetry} />;
  if (!scenario) return <EmptyState title="سناریویی انتخاب نشده است" description="از تب «سناریوها» انتخاب کنید." />;

  const graph = scenario.problem.graphCheck;
  const activities = scenario.problem.activities;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            سلامت گراف تقدم — {graph.ok ? "سالم" : "ناسالم"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="space-y-1 text-xs leading-relaxed">
            {graph.messagesFa.map((m, i) => (
              <li key={i} className={cn(graph.ok ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300")}>◆ {m}</li>
            ))}
          </ul>
          {graph.ok ? (
            <p className="text-[10px] text-muted-foreground">
              ستون = رتبه توپولوژیک (پایه الگوریتم کیلبریج–وستر). گره‌های خاکستری = فعالیت بدون زمان معتبر — از تخصیص کنار گذاشته می‌شوند.
            </p>
          ) : (
            <p className="text-[10px] text-muted-foreground">
              گراف ناسالم: الگوریتم‌های کلاسیک راهکار تولید نمی‌کنند — ابتدا چرخه/ارجاع نامعتبر را در کارگاه پیکربندی (فعالیت‌ها) رفع کنید.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">گراف تقدم و تأخر ({faDigits(activities.length)} فعالیت)</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {graph.ok ? (
            <PrecedenceGraph activities={activities} columns={graph.columns} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="py-1.5 text-start font-medium">فعالیت</th>
                    <th className="py-1.5 text-start font-medium">پیش‌نیازها</th>
                    <th className="py-1.5 text-start font-medium">وضعیت زمان</th>
                  </tr>
                </thead>
                <tbody>
                  {activities.map((a) => (
                    <tr key={a.id} className="border-b last:border-0">
                      <td className="py-1.5 font-mono text-[11px]">{a.id}</td>
                      <td className="py-1.5 text-muted-foreground">{a.predecessors.length > 0 ? a.predecessors.join("، ") : "—"}</td>
                      <td className="py-1.5">{a.timeStatus === "valid" ? `${faSeconds(a.timeMs)}ث` : "بدون زمان"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {scenario.currentResult ? (
        <ViolationsList violations={scenario.currentResult.violations} title="وضعیت قیود آخرین نتیجه" />
      ) : null}
    </div>
  );
}
