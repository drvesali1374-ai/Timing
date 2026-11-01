"use client";

/**
 * اجزای مشترک کارگاه بالانس — قالب‌بندی فارسی، برچسب‌ها، رنگ اجزای Yamazumi.
 * بدون منطق دامنه — فقط نمایش (قاعده مرزها).
 */

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { BalanceWorkType, ConstraintViolation, BalanceStatus } from "@/shared/balance/types";

/** ارقام فارسی — الگوی analysis-bits */
export function faDigits(v: number | string | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return String(v).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}

/** ثانیه با دو رقم اعشار — ms → نمایش انسانی */
export function faSeconds(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "—";
  return faDigits((ms / 1000).toLocaleString("en-US", { maximumFractionDigits: 2 }));
}

export function faPct(p: number | null | undefined, frac = 1): string {
  if (p === null || p === undefined) return "—";
  return `${faDigits(p.toLocaleString("en-US", { maximumFractionDigits: frac }))}٪`;
}

/** رنگ‌های اجزای Yamazumi بر اساس نوع کار — بدون آبی/نیلی (پالت زمردی/کهربایی/رزی) */
export const WORK_TYPE_COLORS: Record<BalanceWorkType, string> = {
  operatorManual: "fill-emerald-600 stroke-emerald-700",
  machineAuto: "fill-amber-500 stroke-amber-600",
  waiting: "fill-stone-400 stroke-stone-500",
  transport: "fill-teal-500 stroke-teal-600",
  inspection: "fill-lime-600 stroke-lime-700",
  setupChangeover: "fill-orange-600 stroke-orange-700",
  overlap: "fill-rose-400 stroke-rose-500",
};

export const WORK_TYPE_COLORS_CLASS: Record<BalanceWorkType, string> = {
  operatorManual: "bg-emerald-600",
  machineAuto: "bg-amber-500",
  waiting: "bg-stone-400",
  transport: "bg-teal-500",
  inspection: "bg-lime-600",
  setupChangeover: "bg-orange-600",
  overlap: "bg-rose-400",
};

export function WorkTypeBadge({ workType }: { workType: BalanceWorkType }) {
  const labels: Record<BalanceWorkType, string> = {
    operatorManual: "دستی اپراتور",
    machineAuto: "خودکار ماشین",
    waiting: "انتظار",
    transport: "حرکت",
    inspection: "بازرسی",
    setupChangeover: "راه‌اندازی",
    overlap: "هم‌پوشان",
  };
  return (
    <Badge variant="outline" className={cn("gap-1 text-[10px] font-normal", WORK_TYPE_COLORS_CLASS[workType], "text-white border-transparent")}>
      {labels[workType]}
    </Badge>
  );
}

export function StatusChip({ status }: { status: BalanceStatus }) {
  const map: Record<BalanceStatus, { labelFa: string; cls: string }> = {
    solved: { labelFa: "حل‌شده", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
    "solved-with-flags": { labelFa: "حل با هشدار", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
    "infeasible-flagged": { labelFa: "نامعتبر — نقض قید", cls: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300" },
  };
  const s = map[status];
  return <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", s.cls)}>{s.labelFa}</span>;
}

export function ViolationsList({ violations, title = "گزارش قیود" }: { violations: ConstraintViolation[]; title?: string }) {
  if (violations.length === 0) {
    return (
      <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
        هیچ قیدی نقض نشده است — تقدم/تأخر، ظرفیت و ناسازگاری رعایت شده‌اند.
      </p>
    );
  }
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/50">
      <p className="mb-1.5 text-xs font-semibold text-amber-900 dark:text-amber-200">{title} — {faDigits(violations.length)} مورد:</p>
      <ul className="max-h-40 space-y-1 overflow-y-auto text-xs leading-relaxed text-amber-900 dark:text-amber-200">
        {violations.map((v, i) => (
          <li key={i} className="flex gap-1.5">
            <span aria-hidden className="shrink-0">◆</span>
            <span>{v.messageFa}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** جعبه شاخص با فرمول مستند (بند ۶) */
export function MetricCard({
  labelFa,
  value,
  formulaFa,
  tone = "default",
}: {
  labelFa: string;
  value: ReactNode;
  formulaFa?: string;
  tone?: "default" | "good" | "warn" | "bad";
}) {
  const toneCls =
    tone === "good"
      ? "border-emerald-200 dark:border-emerald-900"
      : tone === "warn"
        ? "border-amber-300 dark:border-amber-900"
        : tone === "bad"
          ? "border-rose-300 dark:border-rose-900"
          : "";
  return (
    <div className={cn("rounded-lg border bg-card p-3", toneCls)}>
      <p className="text-[11px] text-muted-foreground">{labelFa}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
      {formulaFa ? <p className="mt-1 border-t pt-1 text-[10px] leading-relaxed text-muted-foreground">{formulaFa}</p> : null}
    </div>
  );
}
