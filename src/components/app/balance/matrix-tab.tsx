"use client";

/**
 * تب ماتریس تخصیص + ویرایش دستی — بند ۹ فاز ۶ (کنترل انسانی).
 * کاربر ایستگاه هر فعالیت را تغییر می‌دهد؛ اعتبارسنجی فوری سمت سرور:
 * قیود سخت → رد با دلیل؛ قیود نرم → پرچم. شاخص‌ها فوری بازمحاسبه می‌شوند.
 * ویرایشگر با key={resultId} ریمونت می‌شود → پیش‌نویس همیشه از نتیجه جاری شروع می‌شود (بدون setState-in-effect).
 */

import { useMemo, useState } from "react";
import { Save, Undo2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoadingBlock, ErrorState, EmptyState } from "@/components/app/ui-bits";
import { cn } from "@/lib/utils";
import type { BalanceScenarioDetailDto } from "@/shared/contracts/balance";
import { useSaveManualAssignment } from "@/hooks/use-balance";
import { faDigits, faSeconds, StatusChip, ViolationsList, WorkTypeBadge } from "./balance-bits";

interface MatrixTabProps {
  projectId: string;
  scenario: BalanceScenarioDetailDto | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

export function MatrixTab({ projectId, scenario, isLoading, isError, onRetry }: MatrixTabProps) {
  if (isLoading) return <LoadingBlock lines={6} />;
  if (isError) return <ErrorState message="خطا در بارگذاری سناریو." onRetry={onRetry} />;
  if (!scenario) return <EmptyState title="سناریویی انتخاب نشده است" description="از تب «سناریوها» انتخاب کنید." />;

  const current = scenario.currentResult;

  if (!current) {
    return (
      <EmptyState
        title="نتیجه‌ای برای ویرایش وجود ندارد"
        description="ابتدا از تب «یامازومی» یک الگوریتم اجرا کنید تا تخصیص اولیه ساخته شود؛ سپس می‌توانید دستی تغییرش دهید."
      />
    );
  }

  return <MatrixEditor key={current.id} projectId={projectId} scenario={scenario} current={current} />;
}

function MatrixEditor({ projectId, scenario, current }: {
  projectId: string;
  scenario: BalanceScenarioDetailDto;
  current: NonNullable<BalanceScenarioDetailDto["currentResult"]>;
}) {
  const save = useSaveManualAssignment(projectId, scenario.scenario.id);
  const [draft, setDraft] = useState<Record<string, number>>(current.assignments);
  const [dirty, setDirty] = useState(false);

  const stationCount = useMemo(() => {
    const values = Object.values(draft);
    return values.length > 0 ? Math.max(...values) : 0;
  }, [draft]);

  const activities = scenario.problem.activities;
  const byId = new Map(activities.map((a) => [a.id, a]));

  /** اعتبارسنجی زنده در UI — فقط برای بازخورد فوری؛ مرجع نهایی سرور است */
  const liveWarnings: string[] = [];
  for (const a of activities) {
    const st = draft[a.id];
    if (st === undefined) continue;
    for (const p of a.predecessors) {
      const pred = byId.get(p);
      const pst = pred ? draft[p] : undefined;
      if (pred && pst !== undefined && pst > st) {
        liveWarnings.push(`«${p}» (ایستگاه ${faDigits(pst)}) باید قبل/هم‌ایستگاهِ «${a.id}» باشد.`);
      }
    }
  }

  return (
    <div className="space-y-4">
      <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-sm">
                  ماتریس تخصیص — {current.algorithmLabelFa}
                  {dirty ? <span className="ms-2 text-[10px] font-normal text-amber-600">پیش‌نویس ذخیره‌نشده</span> : null}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm" variant="outline" className="h-7 gap-1 text-[11px]"
                    disabled={!dirty}
                    onClick={() => {
                      setDraft(current.assignments);
                      setDirty(false);
                    }}
                  >
                    <Undo2 className="size-3" aria-hidden /> بازگردانی
                  </Button>
                  <Button
                    size="sm" className="h-7 gap-1 text-[11px]"
                    disabled={!dirty || save.isPending}
                    onClick={() => void save.mutateAsync(draft).then(() => setDirty(false))}
                  >
                    <Save className="size-3" aria-hidden /> {save.isPending ? "در حال ذخیره…" : "ذخیره تخصیص دستی"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-[10px] leading-relaxed text-muted-foreground">
                شماره ایستگاه را مستقیم تغییر دهید (≥ ۱). ذخیره با اعتبارسنجی فوری: نقض تقدم/ناسازگاری رد می‌شود و دلیلش نمایش داده می‌شود؛
                اضافه‌بار ظرفیت با هشدار ذخیره می‌شود. شاخص‌ها بعد از ذخیره فوری بازمحاسبه و در تاریخچه ثبت می‌شوند.
              </p>

              {liveWarnings.length > 0 && dirty ? (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-[11px] leading-relaxed text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                  <p className="mb-1 flex items-center gap-1 font-semibold">
                    <AlertTriangle className="size-3.5" aria-hidden /> هشدار زنده (پیش از ذخیره — {faDigits(liveWarnings.length)}):
                  </p>
                  <ul className="max-h-24 space-y-0.5 overflow-y-auto">
                    {liveWarnings.slice(0, 8).map((w, i) => (
                      <li key={i}>◆ {w}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="max-h-[28rem] overflow-y-auto rounded-lg border">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-background">
                    <TableRow>
                      <TableHead className="text-xs">فعالیت</TableHead>
                      <TableHead className="text-xs">نام</TableHead>
                      <TableHead className="text-xs">نوع کار</TableHead>
                      <TableHead className="text-xs">زمان</TableHead>
                      <TableHead className="text-xs">منبع زمان</TableHead>
                      <TableHead className="w-28 text-xs">ایستگاه</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activities.map((a) => {
                      const st = draft[a.id];
                      const isMissing = a.timeStatus === "missing";
                      return (
                        <TableRow key={a.id} className={cn(isMissing && "opacity-60")}>
                          <TableCell className="font-mono text-[11px]">{a.id}</TableCell>
                          <TableCell className="max-w-40 truncate text-xs" title={a.name}>{a.name}</TableCell>
                          <TableCell><WorkTypeBadge workType={a.workType} /></TableCell>
                          <TableCell className="text-xs tabular-nums">{isMissing ? "—" : `${faSeconds(a.timeMs)}ث`}</TableCell>
                          <TableCell className="max-w-52 truncate text-[10px] text-muted-foreground" title={a.timeSourceFa}>{a.timeSourceFa}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={1}
                              max={200}
                              className="h-7 w-20 text-xs tabular-nums"
                              value={st ?? ""}
                              disabled={isMissing}
                              aria-label={`ایستگاه فعالیت ${a.id}`}
                              onChange={(e) => {
                                const v = Number.parseInt(e.target.value, 10);
                                setDraft((d) => ({ ...d, [a.id]: Number.isFinite(v) && v >= 1 ? v : (d[a.id] ?? 1) }));
                                setDirty(true);
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {stationCount > 0 ? (
                <p className="text-[10px] text-muted-foreground">
                  پیش‌نویس: {faDigits(stationCount)} ایستگاه — {faDigits(activities.filter((a) => draft[a.id] !== undefined && a.timeStatus === "valid").length)} از {faDigits(activities.length)} فعالیت تخصیص دارد.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                آخرین نتیجه ثبت‌شده <StatusChip status={current.status} />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <ViolationsList violations={current.violations} />
            </CardContent>
          </Card>
    </div>
  );
}
