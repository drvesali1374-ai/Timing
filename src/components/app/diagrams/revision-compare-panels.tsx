"use client";

/**
 * تاریخچه نسخه‌های نمودار (append-only) + بازیابی نسخه قبلی (revision جدید) + مقایسه variant.
 */

import { useState } from "react";
import { History, Layers, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { FaDate, Spinner } from "@/components/app/ui-bits";
import { useDiagramRevisions, useRestoreRevision, useVariantCompare } from "@/hooks/use-diagrams";
import { DIAGRAM_VARIANT_LABELS_FA } from "@/shared/contracts/diagrams";
import { formatSeconds } from "@/shared/diagrams/svg";
import { symbolLabelFa, type DiagramSymbol, type DiagramKind } from "@/shared/diagrams/types";

export function RevisionHistoryPanel({ projectId, diagramId, currentRev }: { projectId: string; diagramId: string; currentRev: number }) {
  const revisionsQuery = useDiagramRevisions(projectId, diagramId);
  const restore = useRestoreRevision(projectId);
  const [confirmRev, setConfirmRev] = useState<number | null>(null);

  if (revisionsQuery.isLoading) {
    return (
      <div className="space-y-2 p-4">
        <Spinner />
      </div>
    );
  }
  const revisions = revisionsQuery.data ?? [];

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <History className="size-4" aria-hidden />
        <span>
          {revisions.length} نسخه append-only — نسخه‌ها هرگز حذف/ویرایش نمی‌شوند؛ بازیابی = نسخه جدید با محتوای قدیم.
        </span>
      </div>
      <ScrollArea className="max-h-[440px]">
        <div className="space-y-1.5">
          {revisions.map((r) => (
            <div
              key={r.id}
              className={`rounded-lg border p-2.5 ${r.revNo === currentRev ? "border-primary/40 bg-primary/5" : ""}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5">
                  <Badge variant={r.revNo === currentRev ? "default" : "outline"} className="font-mono text-[10px]">
                    r{r.revNo}
                  </Badge>
                  {r.revNo === currentRev ? <Badge variant="secondary" className="text-[10px]">جاری</Badge> : null}
                  {r.origin === "offline-synced" ? <Badge variant="outline" className="text-[10px]">همگام‌شده از آفلاین</Badge> : null}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span>{r.createdByName ?? "—"}</span>
                  <FaDate iso={r.createdAt} withTime />
                </div>
              </div>
              {r.reason ? <p className="mt-1 text-[11px] text-muted-foreground">{r.reason}</p> : null}
              {r.appliedSuggestions.length > 0 ? (
                <p className="mt-1 text-[10px] text-teal-700 dark:text-teal-300">
                  پیشنهادهای اعمال‌شده: {r.appliedSuggestions.map((s) => s.id).join("، ")}
                </p>
              ) : null}
              {r.revNo !== currentRev ? (
                <div className="mt-1.5 flex items-center gap-2">
                  {confirmRev === r.revNo ? (
                    <>
                      <Button
                        size="sm"
                        className="h-7 text-[11px]"
                        disabled={restore.isPending}
                        onClick={() => {
                          restore.mutate({ diagramId, revNo: r.revNo }, { onSuccess: () => setConfirmRev(null) });
                        }}
                      >
                        {restore.isPending ? <Spinner /> : null} تأیید بازیابی
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => setConfirmRev(null)}>
                        انصراف
                      </Button>
                    </>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px]" onClick={() => setConfirmRev(r.revNo)}>
                          <RotateCcw className="size-3" aria-hidden /> بازیابی این نسخه
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>محتوای نسخه {r.revNo} به‌صورت نسخه جدید ثبت می‌شود</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// ─────────────────────── مقایسه variant ───────────────────────

export function VariantComparePanel({ projectId, diagramId, kind }: { projectId: string; diagramId: string; kind: DiagramKind }) {
  const compareQuery = useVariantCompare(projectId, diagramId, true);

  if (compareQuery.isLoading) {
    return (
      <div className="space-y-2 p-4">
        <Spinner />
      </div>
    );
  }
  if (compareQuery.isError) {
    return (
      <p className="p-4 text-sm text-muted-foreground">{(compareQuery.error as Error)?.message ?? "مقایسه در دسترس نیست."}</p>
    );
  }
  const data = compareQuery.data;
  if (!data) return null;

  const fmtDelta = (n: number, unit: string) => {
    const sign = n > 0 ? "+" : n < 0 ? "−" : "";
    return `${sign}${Math.abs(Math.round(n * 100) / 100)} ${unit}`;
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-2 text-xs font-semibold">
        <Layers className="size-4 text-primary" aria-hidden />
        مقایسه {DIAGRAM_VARIANT_LABELS_FA.current} ↔ {DIAGRAM_VARIANT_LABELS_FA.proposed}
      </div>

      <div className="grid gap-2 text-xs">
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="mb-1.5 font-semibold">{data.current.title} (روش موجود)</p>
          <p className="text-[11px] text-muted-foreground">
            گام: {data.diff.current.nodeCount} · مجموع زمان: {formatSeconds(data.diff.current.totalTimeSec)}
            {kind === "fpc" ? ` · مسافت: ${data.diff.current.totalDistanceM}m` : ""}
          </p>
        </div>
        <div className="rounded-lg border border-primary/40 bg-primary/5 p-3">
          <p className="mb-1.5 font-semibold">{data.proposed.title} (روش پیشنهادی)</p>
          <p className="text-[11px] text-muted-foreground">
            گام: {data.diff.proposed.nodeCount} · مجموع زمان: {formatSeconds(data.diff.proposed.totalTimeSec)}
            {kind === "fpc" ? ` · مسافت: ${data.diff.proposed.totalDistanceM}m` : ""}
          </p>
        </div>
      </div>

      <div className="space-y-2 rounded-lg border p-3 text-xs">
        <p className="font-semibold">دلتاها (پیشنهادی نسبت به فعلی):</p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          {Object.entries(data.diff.countDelta).map(([symbol, delta]) => (
            <div key={symbol} className="flex items-center justify-between">
              <span className="text-muted-foreground">{symbolLabelFa(kind, symbol as DiagramSymbol)}</span>
              <span className={`font-mono font-semibold ${delta > 0 ? "text-amber-700 dark:text-amber-300" : delta < 0 ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground"}`}>
                {fmtDelta(delta, "")}
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between border-t border-dashed pt-1">
            <span className="text-muted-foreground">مجموع زمان</span>
            <span className={`font-mono font-semibold ${data.diff.totalTimeDeltaSec < 0 ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}`}>
              {fmtDelta(data.diff.totalTimeDeltaSec, "s")}
            </span>
          </div>
          {kind === "fpc" ? (
            <div className="flex items-center justify-between border-t border-dashed pt-1">
              <span className="text-muted-foreground">مجموع مسافت</span>
              <span className={`font-mono font-semibold ${data.diff.totalDistanceDeltaM < 0 ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}`}>
                {fmtDelta(data.diff.totalDistanceDeltaM, "m")}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {(data.diff.removedSteps.length > 0 || data.diff.addedSteps.length > 0 || data.diff.changedSteps.length > 0) ? (
        <div className="space-y-2 text-[11px]">
          {data.diff.removedSteps.length > 0 ? (
            <div>
              <p className="mb-1 font-semibold text-red-700 dark:text-red-300">حذف‌شده ({data.diff.removedSteps.length}):</p>
              <ul className="space-y-0.5">
                {data.diff.removedSteps.map((s, i) => (
                  <li key={i} className="text-muted-foreground">
                    − {s.title} ({s.symbolFa})
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {data.diff.addedSteps.length > 0 ? (
            <div>
              <p className="mb-1 font-semibold text-emerald-700 dark:text-emerald-300">افزوده ({data.diff.addedSteps.length}):</p>
              <ul className="space-y-0.5">
                {data.diff.addedSteps.map((s, i) => (
                  <li key={i} className="text-muted-foreground">
                    + {s.title} ({s.symbolFa})
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {data.diff.changedSteps.length > 0 ? (
            <div>
              <p className="mb-1 font-semibold text-amber-700 dark:text-amber-300">تغییر زمان/مسافت:</p>
              <ul className="space-y-0.5">
                {data.diff.changedSteps.map((s, i) => (
                  <li key={i} className="text-muted-foreground">
                    {s.title}: {s.timeBefore ?? "—"}s → {s.timeAfter ?? "—"}s{s.distanceBefore !== null || s.distanceAfter !== null ? ` · مسافت: ${s.distanceBefore ?? "—"}m → ${s.distanceAfter ?? "—"}m` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <p className="text-[10px] leading-relaxed text-muted-foreground">
        این مقایسه تحلیلی است؛ بهبود واقعی فقط با مشاهده/اندازه‌گیری در شرایط واقعی قابل تأیید است (منشور A2).
      </p>
    </div>
  );
}

export function NoCompareHint({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="space-y-3 p-4">
      <p className="text-sm leading-relaxed text-muted-foreground">
        این نمودار «روش موجود» است. برای مقایسه، یک نسخه «پیشنهادی» از آن بسازید — نسخه پیشنهادی جدا از نسخه اصلی ذخیره می‌شود و
        تفاوت خلاصه‌ها (نمادها/زمان/مسافت) قابل گزارش است.
      </p>
      <Button onClick={onCreate} variant="outline" className="gap-2">
        <Layers className="size-4" aria-hidden /> ایجاد نسخه پیشنهادی
      </Button>
    </div>
  );
}

export function toastNotImplemented(msgFa: string) {
  toast.info(msgFa);
}
