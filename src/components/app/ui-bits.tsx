"use client";

/**
 * اجزای نمایشی مشترک — فقط ابزار نمایش؛ بدون منطق دامنه (قاعده A6).
 */
import { AlertTriangle, CheckCircle2, Clock, FileSearch, Loader2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProjectReadinessDto, ProjectStatus } from "@/shared/contracts/api";
import { cn } from "@/lib/utils";

// ─────────────── نشان وضعیت پروژه ───────────────

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const map: Record<ProjectStatus, { label: string; className: string }> = {
    active: { label: "فعال", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900" },
    archived: { label: "بایگانی", className: "bg-stone-100 text-stone-700 dark:bg-stone-900 dark:text-stone-300 border-stone-200 dark:border-stone-700" },
    completed: { label: "تکمیل‌شده", className: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border-teal-200 dark:border-teal-900" },
  };
  const s = map[status];
  return (
    <Badge variant="outline" className={cn("font-medium", s.className)}>
      {status === "active" && <span className="ml-1 inline-block size-1.5 rounded-full bg-emerald-500" aria-hidden />}
      {s.label}
    </Badge>
  );
}

export function DemoBadge() {
  return (
    <Badge variant="outline" className="gap-1 border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
      <span aria-hidden>🎓</span> پروژه نمونه آموزشی
    </Badge>
  );
}

// ─────────────── نشانگرهای آمادگی (صادقانه — بر پایه داده واقعی) ───────────────

export function ReadinessChips({ readiness, compact = false }: { readiness: ProjectReadinessDto; compact?: boolean }) {
  const items: Array<{ key: keyof ProjectReadinessDto; label: string; hint: string }> = [
    { key: "configReady", label: "پیکربندی", hint: "نسخه پیکربندی فعال وجود دارد" },
    { key: "diagramReady", label: "نمودار", hint: "نمودار فرایندی OPC/FPC فعال وجود دارد — فاز ۳" },
    { key: "measurementReady", label: "اندازه‌گیری", hint: "منتظر تعریف فعالیت‌ها — فاز ۲ و ۴" },
    { key: "analysisReady", label: "تحلیل", hint: "منتظر ثبت مشاهدات — فاز ۴ و ۵" },
    { key: "approvalReady", label: "تأیید", hint: "منتظر زمان استاندارد — فاز ۵" },
  ];
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", compact ? "text-[11px]" : "text-xs")} aria-label="نشانگرهای آمادگی پروژه">
      {items.map((it) => (
        <span
          key={it.key}
          title={it.hint}
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-medium",
            readiness[it.key]
              ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
              : "border-dashed border-stone-300 bg-stone-50 text-stone-400 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-500",
          )}
        >
          {readiness[it.key] ? <CheckCircle2 className="size-3" aria-hidden /> : <Clock className="size-3" aria-hidden />}
          {it.label}
        </span>
      ))}
    </div>
  );
}

// ─────────────── تاریخ فارسی ───────────────

const faDate = new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" });
const faDateTime = new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" });

export function FaDate({ iso, withTime = false }: { iso: string; withTime?: boolean }) {
  const d = new Date(iso);
  return <time dateTime={iso}>{(withTime ? faDateTime : faDate).format(d)}</time>;
}

// ─────────────── وضعیت‌های بارگذاری/خطا/خالی ───────────────

export function LoadingCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="در حال بارگذاری">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card p-4 space-y-3">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function LoadingBlock({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-3 p-4" aria-busy="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className="h-5" style={{ width: `${90 - i * 15}%` }} />
      ))}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-900 dark:bg-red-950/40">
      <AlertTriangle className="size-8 text-red-500" aria-hidden />
      <p className="font-medium text-red-800 dark:text-red-300">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          تلاش دوباره
        </Button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card p-10 text-center">
      <FileSearch className="size-10 text-stone-400" aria-hidden />
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      {action}
    </div>
  );
}

// ─────────────── سربرگ صفحه ───────────────

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-bold sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-4 animate-spin", className)} aria-hidden />;
}

export function MembersCount({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Users className="size-3.5" aria-hidden /> {count} عضو
    </span>
  );
}
