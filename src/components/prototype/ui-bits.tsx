"use client";

/**
 * اجزای مشترک کوچک وایرفریم فاز صفر — فقط ابزار نمایش (بدون منطق دامنه).
 */

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { DEMO_TAG, phaseBadge } from "./data";

export function WireframeTag({ className }: { className?: string }) {
  return (
    <Badge variant="outline" className={cn("gap-1 border-dashed text-[11px] font-normal", className)}>
      <span aria-hidden>▦</span> وایرفریم — {DEMO_TAG}
    </Badge>
  );
}

export function PhaseNote() {
  return (
    <p className="text-xs leading-6 text-muted-foreground">
      <span className="font-semibold text-foreground">{phaseBadge.title}: </span>
      {phaseBadge.note}
    </p>
  );
}

export function SectionTitle({
  title,
  sub,
  tag,
  action,
}: {
  title: string;
  sub?: string;
  tag?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-bold sm:text-lg">{title}</h2>
          {tag ? <WireframeTag /> : null}
        </div>
        {sub ? <p className="mt-1 text-xs text-muted-foreground sm:text-[13px]">{sub}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function KpiCard({
  k,
  v,
  note,
  tone = "default",
}: {
  k: string;
  v: string;
  note?: string;
  tone?: "default" | "positive" | "warning" | "muted";
}) {
  const toneClass = {
    default: "text-foreground",
    positive: "text-primary",
    warning: "text-amber-600 dark:text-amber-400",
    muted: "text-muted-foreground",
  }[tone];
  return (
    <div className="rounded-lg border bg-card p-3 sm:p-4">
      <div className="text-[11px] text-muted-foreground sm:text-xs">{k}</div>
      <div className={cn("mt-1 text-lg font-bold sm:text-xl", toneClass)} dir="auto">
        {v}
      </div>
      {note ? <div className="mt-1 text-[10px] leading-4 text-muted-foreground sm:text-[11px]">{note}</div> : null}
    </div>
  );
}

export function PanelCard({
  title,
  children,
  className,
  contentClassName,
  titleExtra,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  titleExtra?: React.ReactNode;
}) {
  return (
    <Card className={cn("gap-3 py-4", className)}>
      {title ? (
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-sm font-bold sm:text-base">
            <span>{title}</span>
            {titleExtra}
          </CardTitle>
        </CardHeader>
      ) : null}
      <CardContent className={cn("px-4 sm:px-6", contentClassName)}>{children}</CardContent>
    </Card>
  );
}

export function PlaceholderBox({
  label,
  height = "h-28",
  className,
}: {
  label: string;
  height?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-lg border border-dashed bg-muted/40 px-4 text-center text-xs text-muted-foreground",
        height,
        className,
      )}
      role="img"
      aria-label={label}
    >
      {label}
    </div>
  );
}

export function SourceBadge({ label }: { label: string }) {
  return (
    <Badge variant="secondary" className="text-[10px] font-normal sm:text-[11px]">
      {label}
    </Badge>
  );
}
