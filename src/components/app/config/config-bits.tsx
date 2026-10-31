"use client";

/**
 * اجزای نمایشی مشترک کارگاه پیکربندی — نشان‌ها و قطعات تکراری (بدون منطق دامنه).
 */
import { useState } from "react";
import { AlertTriangle, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DATA_TYPE_LABELS_FA,
  FORMULA_STATUS_LABELS_FA,
  SCOPE_LEVEL_LABELS_FA,
  WORK_TYPE_LABELS_FA_UI,
  type ConfigParameterDataType,
  type ConfigWorkType,
} from "@/shared/contracts/config";
import { cn } from "@/lib/utils";
import { faCount, formatParamValueFa } from "@/hooks/use-config";

// ── کلید فنی / نسخه‌ها (همیشه ltr + mono) ───────────────────

export function MonoKey({ value, className }: { value: string; className?: string }) {
  return (
    <code
      dir="ltr"
      className={cn("rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground", className)}
    >
      {value}
    </code>
  );
}

export function SemverBadge({ semver, className }: { semver: string; className?: string }) {
  return (
    <Badge variant="outline" className={cn("font-mono", className)} dir="ltr">
      v{semver}
    </Badge>
  );
}

export function DefVersionBadge({ version }: { version: number }) {
  return (
    <Badge variant="outline" className="font-mono text-[10px]" dir="ltr" title="نسخه تعریف پارامتر">
      v{version}
    </Badge>
  );
}

export function ArchivedBadge() {
  return (
    <Badge variant="outline" className="border-stone-300 bg-stone-100 text-stone-600 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-400">
      بایگانی
    </Badge>
  );
}

// ── نشان وضعیت فرمول ────────────────────────────────────────

export function FormulaStatusBadge({ status }: { status: string }) {
  if (status === "active") {
    return (
      <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
        {FORMULA_STATUS_LABELS_FA[status] ?? status}
      </Badge>
    );
  }
  if (status === "draft") {
    return (
      <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
        {FORMULA_STATUS_LABELS_FA[status] ?? status}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="line-through decoration-stone-400 text-stone-500 dark:text-stone-400">
      {FORMULA_STATUS_LABELS_FA[status] ?? status}
    </Badge>
  );
}

export function OriginBadge({ origin }: { origin: "system" | "custom" }) {
  return origin === "system" ? <Badge variant="secondary">سیستمی</Badge> : <Badge variant="outline">سفارشی</Badge>;
}

export function ScopeLevelBadge({ scope }: { scope: string }) {
  return (
    <Badge variant="outline" className="text-[11px]">
      {SCOPE_LEVEL_LABELS_FA[scope as keyof typeof SCOPE_LEVEL_LABELS_FA] ?? scope}
    </Badge>
  );
}

export function DataTypeBadge({ dataType }: { dataType: ConfigParameterDataType | string }) {
  return (
    <Badge variant="outline" className="text-[11px] text-muted-foreground">
      {DATA_TYPE_LABELS_FA[dataType as ConfigParameterDataType] ?? dataType}
    </Badge>
  );
}

// ── نشان نوع کار / طبقه‌بندی ارزش (فعالیت‌ها) ───────────────

const WORK_TYPE_STYLES: Record<ConfigWorkType, string> = {
  operatorManual: "border-primary/30 bg-primary/10 text-primary dark:text-primary-foreground/90 dark:bg-primary/20",
  machineAuto: "border-stone-200 bg-secondary text-secondary-foreground dark:border-stone-700 dark:bg-secondary/70",
  waiting: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
  transport: "border-stone-300 text-stone-600 dark:border-stone-700 dark:text-stone-400",
  inspection: "border-stone-200 bg-secondary text-secondary-foreground dark:border-stone-700 dark:bg-secondary/70",
  setupChangeover: "border-stone-300 text-stone-600 dark:border-stone-700 dark:text-stone-400",
  overlap: "border-red-300 text-red-700 dark:border-red-900 dark:text-red-400",
};

export function WorkTypeBadge({ workType }: { workType: string }) {
  const label = WORK_TYPE_LABELS_FA_UI[workType as ConfigWorkType] ?? workType;
  const style = WORK_TYPE_STYLES[workType as ConfigWorkType];
  return (
    <Badge variant="outline" className={cn("text-[11px]", style)}>
      {label}
    </Badge>
  );
}

const VA_LABELS_FA: Record<string, string> = {
  valueAdded: "ارزش‌افزا",
  nonValueAdded: "غیرارزش‌افزا",
  essentialNonVA: "غیرارزش‌افزای ضروری",
};

export function VaBadge({ va }: { va: string | null | undefined }) {
  if (!va) return <span className="text-xs text-muted-foreground">—</span>;
  const label = VA_LABELS_FA[va] ?? va;
  if (va === "valueAdded") {
    return (
      <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
        {label}
      </Badge>
    );
  }
  if (va === "essentialNonVA") {
    return (
      <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
        {label}
      </Badge>
    );
  }
  return <Badge variant="outline" className="border-red-300 text-red-700 dark:border-red-900 dark:text-red-400">{label}</Badge>;
}

// ── فهرست خطاها ─────────────────────────────────────────────

export function ErrorList({ errors, className }: { errors: Array<{ messageFa: string }>; className?: string }) {
  if (errors.length === 0) return null;
  return (
    <ul className={cn("space-y-1", className)} role="alert">
      {errors.map((e, i) => (
        <li key={i} className="flex items-start gap-1.5 text-xs text-red-700 dark:text-red-400">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>{e.messageFa}</span>
        </li>
      ))}
    </ul>
  );
}

// ── جدول گام‌های محاسبه (trace) ─────────────────────────────

export interface TraceStepShape {
  nodeId: number;
  op: string;
  detail?: string;
  value?: unknown;
  unit?: string | null;
}

export function TraceSteps({ trace }: { trace: TraceStepShape[] }) {
  const [open, setOpen] = useState(false);
  if (trace.length === 0) return null;
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-1">
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" aria-expanded={open}>
          <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} aria-hidden />
          مراحل محاسبه ({faCount(trace.length)} گام)
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 max-h-72 overflow-auto rounded-lg border">
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow>
                <TableHead className="w-14 text-center">گره</TableHead>
                <TableHead>عمل</TableHead>
                <TableHead>جزئیات</TableHead>
                <TableHead className="text-left">مقدار</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trace.map((step, i) => (
                <TableRow key={`${step.nodeId}-${i}`}>
                  <TableCell className="text-center font-mono text-xs text-muted-foreground" dir="ltr">
                    {step.nodeId}
                  </TableCell>
                  <TableCell className="font-mono text-xs" dir="ltr">
                    {step.op}
                  </TableCell>
                  <TableCell className="max-w-48 truncate font-mono text-[11px] text-muted-foreground" dir="ltr" title={step.detail}>
                    {step.detail ?? "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs" dir="ltr">
                    {formatParamValueFa(step.value as never, step.unit ?? undefined)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
