"use client";

/**
 * اجزای مشترک کارگاه تحلیل (فاز ۵) — نشان‌ها/قالب‌بندی/قطعات صداقت.
 */

import { AlertTriangle, CircleDot, Info, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ChainStepStatus } from "@/shared/analysis/types";

const fa = (input: string | number): string => String(input).replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);

export { fa as faDigits };

/** ثانیه خوانا — ۳ رقم اعشار با ارقام لاتین (تمایز دیجیتال). */
export function fmtSec(ms: number | null | undefined, digits = 3): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return "—";
  return (ms / 1000).toFixed(digits);
}

/** درصد خوانا. */
export function fmtPct(ratio: number | null | undefined, digits = 1): string {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return "—";
  return `${(ratio * 100).toFixed(digits)}%`;
}

/** نشان وضعیت گام زنجیره — valid/incomplete/invalid با رنگ صادقانه. */
export function StepStatusBadge({ status }: { status: ChainStepStatus }) {
  const conf: Record<ChainStepStatus, { label: string; cls: string }> = {
    valid: { label: "معتبر", cls: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
    incomplete: { label: "تکمیل‌نشده", cls: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300" },
    invalid: { label: "نامعتبر", cls: "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300" },
  };
  const c = conf[status];
  return <Badge variant="outline" className={cn("text-[10px]", c.cls)}>{c.label}</Badge>;
}

/** نشان علامت مشاهده — پرت/حذف جدا نمایش می‌شوند. */
export function MarkBadges({ outlierMarked, excluded }: { outlierMarked?: boolean | null; excluded?: boolean | null }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {outlierMarked ? (
        <Badge variant="outline" className="gap-1 border-amber-300 bg-amber-50 text-[10px] text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
          <AlertTriangle className="size-3" aria-hidden /> پرت
        </Badge>
      ) : null}
      {excluded ? (
        <Badge variant="outline" className="gap-1 border-red-300 bg-red-50 text-[10px] text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          <CircleDot className="size-3" aria-hidden /> حذف
        </Badge>
      ) : null}
      {!outlierMarked && !excluded ? <span className="text-[10px] text-muted-foreground">—</span> : null}
    </span>
  );
}

/** قطعه هشدارهای صداقت — هر جا خروجی وابسته ناقص/هشدار دارد. */
export function HonestyWarnings({ warnings, className }: { warnings: string[]; className?: string }) {
  if (warnings.length === 0) return null;
  return (
    <div role="status" className={cn("space-y-1 rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-[11px] leading-6 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200", className)}>
      {warnings.map((w, i) => (
        <p key={i} className="flex items-start gap-1.5">
          <AlertTriangle className="mt-1 size-3 shrink-0" aria-hidden />
          <span>{w}</span>
        </p>
      ))}
    </div>
  );
}

/** قطعه یادداشت روش‌شناختی خنثی (آبی/خاکستری). */
export function MethodNotes({ notes, className }: { notes: string[]; className?: string }) {
  if (notes.length === 0) return null;
  return (
    <div className={cn("space-y-1 rounded-lg border border-dashed bg-muted/30 p-3 text-[11px] leading-6 text-muted-foreground", className)}>
      {notes.map((n, i) => (
        <p key={i} className="flex items-start gap-1.5">
          <Info className="mt-1 size-3 shrink-0" aria-hidden />
          <span>{n}</span>
        </p>
      ))}
    </div>
  );
}

/** نشان قاعده پرت با منبع. */
export function OutlierRuleBadge({ rule, sourceFa }: { rule: string; sourceFa: string }) {
  return (
    <Badge variant="outline" title={sourceFa} className="gap-1 border-violet-300 bg-violet-50 text-[10px] text-violet-700 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-300">
      <ShieldAlert className="size-3" aria-hidden /> {rule}
    </Badge>
  );
}
