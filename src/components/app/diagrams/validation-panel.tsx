"use client";

/**
 * پنل اعتبارسنجی زنده — همان موتور خالص مشترک (validateDiagram) سمت کاربر؛
 * سنجش مستقل سرور هنگام ذخیره در revision ثبت می‌شود (شواهد قابل بازتولید).
 */

import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, ListChecks, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEditorStore } from "./editor-store";
import { validateDiagram } from "@/shared/diagrams/validation";
import { symbolLabelFa, type DiagramSymbol } from "@/shared/diagrams/types";
import { formatSeconds } from "@/shared/diagrams/svg";

export interface ValidationPanelProps {
  knownActivityKeys: string[];
  onSelectNode: (nodeId: string) => void;
}

export function ValidationPanel({ knownActivityKeys, onSelectNode }: ValidationPanelProps) {
  const doc = useEditorStore((s) => s.doc);

  const report = useMemo(
    () => (doc ? validateDiagram(doc, { knownActivityKeys }) : null),
    [doc, knownActivityKeys],
  );

  if (!doc || !report) {
    return <p className="p-4 text-sm text-muted-foreground">نموداری برای بررسی نیست.</p>;
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        {report.valid ? (
          <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600">
            <CheckCircle2 className="size-3" aria-hidden /> بدون خطا
          </Badge>
        ) : (
          <Badge className="gap-1 bg-red-600 hover:bg-red-600">
            <XCircle className="size-3" aria-hidden /> {report.errors.length} خطا
          </Badge>
        )}
        {report.warnings.length > 0 ? (
          <Badge variant="outline" className="gap-1 border-amber-400 text-amber-700 dark:text-amber-300">
            <AlertTriangle className="size-3" aria-hidden /> {report.warnings.length} هشدار
          </Badge>
        ) : null}
      </div>

      {/* خلاصه */}
      <div className="rounded-lg border">
        <div className="flex items-center gap-1.5 border-b bg-muted/40 px-3 py-2 text-xs font-medium">
          <ListChecks className="size-3.5" aria-hidden /> خلاصه جریان
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 p-3 text-xs">
          {Object.entries(report.summary.counts).map(([symbol, count]) => (
            <div key={symbol} className="flex items-center justify-between">
              <span className="text-muted-foreground">{symbolLabelFa(doc.kind, symbol as DiagramSymbol)}</span>
              <span className="font-mono font-semibold">{count}</span>
            </div>
          ))}
          <div className="col-span-2 my-1 border-t border-dashed" />
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">مجموع زمان</span>
            <span className="font-mono font-semibold text-teal-700 dark:text-teal-300">{formatSeconds(report.summary.totalTimeSec)}</span>
          </div>
          {doc.kind === "fpc" ? (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">مجموع مسافت</span>
              <span className="font-mono font-semibold text-orange-800 dark:text-orange-300">
                {report.summary.totalDistanceM} {doc.distanceUnit ?? "m"}
              </span>
            </div>
          ) : null}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">گره/اتصال</span>
            <span className="font-mono font-semibold">
              {report.summary.nodeCount}/{report.summary.edgeCount}
            </span>
          </div>
        </div>
      </div>

      {/* خطاها */}
      {report.errors.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-red-700 dark:text-red-300">خطاها (ذخیره با خطا ممکن است اما تأیید نه):</p>
          <ScrollArea className="max-h-40">
            <ul className="space-y-1">
              {report.errors.map((e, i) => (
                <li key={`${e.code}-${i}`}>
                  <button
                    className="w-full rounded-md border border-red-200 bg-red-50 p-2 text-right text-[11px] leading-relaxed text-red-800 hover:border-red-400 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                    onClick={() => e.nodeId && onSelectNode(e.nodeId)}
                  >
                    {e.messageFa}
                  </button>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </div>
      ) : null}

      {/* هشدارها */}
      {report.warnings.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">هشدارها:</p>
          <ScrollArea className="max-h-48">
            <ul className="space-y-1">
              {report.warnings.map((w, i) => (
                <li key={`${w.code}-${i}`}>
                  <button
                    className="w-full rounded-md border border-amber-200 bg-amber-50 p-2 text-right text-[11px] leading-relaxed text-amber-800 hover:border-amber-400 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
                    onClick={() => w.nodeId && onSelectNode(w.nodeId)}
                  >
                    {w.messageFa}
                  </button>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </div>
      ) : null}
    </div>
  );
}
