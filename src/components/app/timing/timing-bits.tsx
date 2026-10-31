"use client";

/**
 * اجزای مشترک کارگاه زمان‌سنجی (فاز ۴) — نشان‌ها/بنرهای صداقت دقت.
 */

import { AlertTriangle, CheckCircle2, CloudOff, Database, RefreshCcw, ShieldAlert, Timer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  INTEGRITY_FLAG_LABELS_FA,
  SESSION_SAVE_STATE_LABELS_FA,
  TIMING_METHOD_LABELS_FA,
  formatDurationMs,
  type IntegrityFlag,
  type SessionSaveState,
  type TimingMethod,
} from "@/shared/timing/types";

const fa = (input: string | number): string => String(input).replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);

export { fa as faDigits };

/** زمان بزرگ خوانا — نمایش milisecond با ارقام لاتین برای تمایز دیجیتال. */
export function BigTimer({ ms, active = true, className }: { ms: number; active?: boolean; className?: string }) {
  return (
    <p
      dir="ltr"
      className={cn(
        "select-none font-mono text-5xl font-black tabular-nums tracking-wider sm:text-7xl",
        active ? "text-foreground" : "text-muted-foreground",
        className,
      )}
      aria-live="off"
    >
      {formatDurationMs(ms)}
    </p>
  );
}

/** نمایش split بازگشت به صفر (روش عنصری). */
export function SplitTimer({ ms, label }: { ms: number; label: string }) {
  return (
    <div className="text-center">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p dir="ltr" className="font-mono text-2xl font-bold tabular-nums text-foreground/90">
        {formatDurationMs(ms)}
      </p>
    </div>
  );
}

/** نشان وضعیت ذخیره/همگام‌سازی — قابل مشاهده برای کاربر (بند ۶ فاز ۴). */
export function SaveStateChip({ state, queuedCount, detail }: { state: SessionSaveState; queuedCount?: number; detail?: string | null }) {
  const config: Record<SessionSaveState, { icon: React.ElementType; classes: string }> = {
    local: { icon: Database, classes: "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300" },
    synced: { icon: CheckCircle2, classes: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
    queued: { icon: CloudOff, classes: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300" },
    conflict: { icon: ShieldAlert, classes: "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300" },
    recovered: { icon: RefreshCcw, classes: "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-300" },
  };
  const c = config[state];
  const Icon = c.icon;
  return (
    <div className="flex flex-col gap-1">
      <span
        role="status"
        aria-live="polite"
        className={cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium", c.classes)}
      >
        <Icon className="size-3.5" aria-hidden />
        {SESSION_SAVE_STATE_LABELS_FA[state]}
        {state === "queued" && queuedCount ? ` — ${fa(queuedCount)} رویداد` : ""}
      </span>
      {detail && state !== "local" ? <span className="text-[10px] leading-4 text-muted-foreground">{detail}</span> : null}
    </div>
  );
}

/** بنر پرچم‌های یکپارچگی — صداقت دقت (ADR-004). */
export function IntegrityBanner({ flags, compact = false }: { flags: IntegrityFlag[]; compact?: boolean }) {
  if (flags.length === 0) return null;
  return (
    <div
      role="alert"
      className={cn(
        "rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-amber-800 dark:text-amber-300",
        compact ? "text-[11px]" : "text-xs",
      )}
    >
      <p className="flex items-center gap-1.5 font-semibold">
        <AlertTriangle className="size-4 shrink-0" aria-hidden />
        پرچم‌های کیفیت ثبت ({fa(flags.length)})
      </p>
      <ul className="mt-1 space-y-0.5 pr-5">
        {flags.map((f) => (
          <li key={f} className="leading-5">
            {INTEGRITY_FLAG_LABELS_FA[f]} — این قطعات «نیازمند بررسی» تلقی می‌شوند و دقت آنها تضمین نمی‌شود.
          </li>
        ))}
      </ul>
    </div>
  );
}

/** نشان روش زمان‌سنجی. */
export function MethodBadge({ method }: { method: TimingMethod | string }) {
  return (
    <Badge variant="outline" className="gap-1 text-[11px]">
      <Timer className="size-3" aria-hidden />
      {TIMING_METHOD_LABELS_FA[method as TimingMethod] ?? method}
    </Badge>
  );
}

/** نشان وضعیت چرخه. */
export function CycleStatusBadge({ status, deviationPct }: { status: string; deviationPct?: number | null }) {
  const map: Record<string, { label: string; classes: string }> = {
    valid: { label: "معتبر", classes: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
    suspect: { label: "نیازمند بررسی", classes: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300" },
    incomplete: { label: "ناتمام", classes: "border-slate-300 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400" },
    recovered: { label: "بازیابی‌شده", classes: "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-300" },
  };
  const c = map[status] ?? { label: status, classes: "" };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium", c.classes)}>
      {c.label}
      {status === "suspect" && deviationPct != null ? ` (انحراف ${fa(deviationPct.toFixed(1))}٪)` : ""}
    </span>
  );
}

/** نشان نوع رویداد در جدول. */
export function EventTypeBadge({ type }: { type: string }) {
  const labels: Record<string, string> = {
    start: "شروع",
    cycleStart: "شروع چرخه",
    reading: "قرائت",
    element: "عنصر",
    lap: "حلقه",
    pause: "مکث",
    resume: "ادامه",
    stop: "پایان",
    note: "یادداشت",
    correction: "اصلاح",
    finalize: "نهایی‌سازی",
  };
  const tone: Record<string, string> = {
    pause: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
    resume: "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300",
    stop: "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300",
    correction: "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-300",
    note: "border-slate-300 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400",
  };
  return (
    <span className={cn("inline-flex rounded border px-1.5 py-0.5 text-[10px] font-medium", tone[type] ?? "border-border bg-muted text-muted-foreground")}>
      {labels[type] ?? type}
    </span>
  );
}

/** KPI کوچک. */
export function KpiCell({ k, v, note, tone = "default" }: { k: string; v: string; note?: string; tone?: "default" | "warning" }) {
  return (
    <div className={cn("rounded-lg border p-3 text-center", tone === "warning" ? "border-amber-300 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/40" : "bg-muted/30")}>
      <p className="text-[11px] text-muted-foreground">{k}</p>
      <p dir="auto" className="mt-0.5 font-mono text-lg font-bold tabular-nums">{v}</p>
      {note ? <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">{note}</p> : null}
    </div>
  );
}

/** راهنمای کلید میانبر. */
export function ShortcutHint({ keys, label }: { keys: string[]; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
      {keys.map((k) => (
        <kbd key={k} className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">{k}</kbd>
      ))}
      <span>{label}</span>
    </span>
  );
}
