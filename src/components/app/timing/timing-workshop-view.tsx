"use client";

/**
 * کارگاه زمان‌سنجی — فهرست جلسات + ایجاد + ورود به ثبت/جزئیات (فاز ۴).
 * ثبت زمان مستقل از نمودار/فعالیت است (منابع جایگزین عنصر) — بند ۷ فاز ۴.
 */

import { useMemo, useState } from "react";
import { ClipboardList, PlayCircle, Timer, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingCards, PageHeader } from "@/components/app/ui-bits";
import { useTimingSessions } from "@/hooks/use-timing";
import { useSession } from "@/hooks/use-api";
import { formatDurationMs } from "@/shared/timing/types";
import { faDigits, IntegrityBanner, MethodBadge, SaveStateChip } from "./timing-bits";
import { NewSessionDialog } from "./new-session-dialog";
import { ChronometerView } from "./chronometer-view";
import { SessionDetailView } from "./session-detail-view";
import type { TimingMethod } from "@/shared/timing/types";

interface TimingWorkshopViewProps {
  projectId: string;
  onBack: () => void;
  onTitle?: (title: string) => void;
}

type InnerView = { mode: "list" } | { mode: "chrono"; sessionId: string } | { mode: "detail"; sessionId: string };

export function TimingWorkshopView({ projectId, onBack, onTitle }: TimingWorkshopViewProps) {
  const session = useSession();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inner, setInner] = useState<InnerView>({ mode: "list" });
  const sessions = useTimingSessions(projectId);

  // روش پیش‌فرض از جلسه آخر یا پیوسته (پروفایل پیوسته پیش‌فرض عمومی است؛ کاربر هنگام ایجاد تغییر می‌دهد)
  const defaultMethod: TimingMethod = useMemo<TimingMethod>(() => {
    const last = sessions.data?.[0];
    return (last?.method as TimingMethod) ?? "continuous";
  }, [sessions.data]);

  if (inner.mode === "chrono") {
    return (
      <ChronometerView
        projectId={projectId}
        sessionId={inner.sessionId}
        onExit={() => setInner({ mode: "list" })}
      />
    );
  }
  if (inner.mode === "detail") {
    return (
      <SessionDetailView
        projectId={projectId}
        sessionId={inner.sessionId}
        onBack={() => setInner({ mode: "list" })}
        onOpenChronometer={() => setInner({ mode: "chrono", sessionId: inner.sessionId })}
      />
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="کارگاه زمان‌سنجی"
        description="ثبت واقعی زمان‌ها با کرنومتر یکنواخت (monotonic)، وقفه‌ها، اصلاح‌ها و صف آفلاین — داده خام append-only قابل بازیابی."
        actions={
          <>
            <Button variant="outline" onClick={onBack} className="gap-2">
              بازگشت به پروژه
            </Button>
            <Button onClick={() => setDialogOpen(true)} disabled={!session.data} className="gap-2">
              <Timer className="size-4" aria-hidden /> جلسه جدید
            </Button>
          </>
        }
      />

      {/* خلاصه وضعیت */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { k: "جلسات", v: faDigits(sessions.data?.length ?? 0), icon: ClipboardList },
          { k: "در حال ثبت", v: faDigits(sessions.data?.filter((s) => s.status === "running").length ?? 0), icon: PlayCircle },
          { k: "نهایی‌شده", v: faDigits(sessions.data?.filter((s) => s.status === "finalized").length ?? 0), icon: TrendingUp },
          { k: "چرخه‌های کامل", v: faDigits(sessions.data?.reduce((a, s) => a + s.completedCycles, 0) ?? 0), icon: Timer },
        ].map((item) => {
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

      {/* فهرست جلسات */}
      {sessions.isLoading ? (
        <LoadingCards count={3} />
      ) : sessions.isError ? (
        <ErrorState message={(sessions.error as Error)?.message ?? "خطا در بارگذاری جلسات."} onRetry={() => void sessions.refetch()} />
      ) : (sessions.data?.length ?? 0) === 0 ? (
        <EmptyState
          title="هنوز جلسه‌ای ثبت نشده است"
          description="با «جلسه جدید» شروع کنید: عناصر را از فعالیت‌های پروژه، نمودار فرایندی یا ورود دستی انتخاب کنید — ثبت زمان به نمودار وابسته نیست."
          action={
            <Button onClick={() => setDialogOpen(true)} className="gap-2">
              <Timer className="size-4" aria-hidden /> ایجاد نخستین جلسه
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {sessions.data?.map((s) => (
            <Card key={s.id} className="py-0 transition-shadow hover:shadow-md">
              <CardHeader className="flex-row items-start justify-between space-y-0 p-4 pb-2">
                <div className="min-w-0 space-y-1.5">
                  <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
                    <MethodBadge method={s.method} />
                    <Badge
                      variant={s.status === "running" ? "default" : s.status === "finalized" ? "secondary" : "outline"}
                      className="text-[11px]"
                    >
                      {s.statusLabelFa}
                    </Badge>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    ناظر: {s.observer} · {faDigits(s.elementCount)} عنصر · {faDigits(s.eventCount)} رویداد ·{" "}
                    {faDigits(s.completedCycles)}/{faDigits(s.cycleCount || s.completedCycles)} چرخه
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(s.createdAt).toLocaleString("fa-IR")}
                    {s.startedAtWall && s.endedAtWall
                      ? ` · ${formatDurationMs(new Date(s.endedAtWall).getTime() - new Date(s.startedAtWall).getTime())} تقویمی`
                      : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  {s.status === "finalized" ? (
                    <SaveStateChip state="synced" detail="قفل تحلیل" />
                  ) : null}
                  <Button
                    size="sm"
                    variant={s.status === "running" || s.status === "paused" ? "default" : "outline"}
                    className="gap-1.5"
                    onClick={() => setInner({ mode: "chrono", sessionId: s.id })}
                  >
                    {s.status === "running" || s.status === "paused" ? (
                      <>
                        <PlayCircle className="size-4" aria-hidden /> ادامه ثبت
                      </>
                    ) : (
                      <>
                        <PlayCircle className="size-4" aria-hidden /> ثبت
                      </>
                    )}
                  </Button>
                  <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => setInner({ mode: "detail", sessionId: s.id })}>
                    <ClipboardList className="size-4" aria-hidden /> جزئیات
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                {s.flags.length > 0 ? <IntegrityBanner flags={s.flags} compact /> : s.notes ? (
                  <p className="truncate rounded-lg bg-muted/30 p-2 text-[11px] text-muted-foreground">{s.notes}</p>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* یادداشت روش‌شناختی */}
      <div className="rounded-lg border border-dashed bg-muted/30 p-3 text-[11px] leading-6 text-muted-foreground">
        <span className="font-semibold text-foreground">روش‌های ثبت:</span> پیوسته (قرائت متوالی + کنترل تلورانس TS-005) ·
        بازگشت به صفر (مدت مستقیم هر عنصر) · حلقه‌ای (Lap/Split). فاصله‌ها از <code dir="ltr">performance.now()</code> یکنواخت
        سنجیده می‌شوند و زمان تقویمی جدا برای ممیزی ثبت می‌شود؛ پس از بارگذاری مجدد/خواب دستگاه، قطعات مربوط صادقانه
        «بازیابی‌شده/نیازمند بررسی» علامت می‌خورند — دقت بیش از واقع ادعا نمی‌شود.
      </div>

      {session.data ? (
        <NewSessionDialog
          projectId={projectId}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          defaultMethod={defaultMethod}
          onCreated={(id) => setInner({ mode: "chrono", sessionId: id })}
        />
      ) : null}
    </div>
  );
}
