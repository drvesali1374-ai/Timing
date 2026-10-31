/**
 * مقایسه روش فعلی و پیشنهادی (variant: current/proposed — بند ۶ دستور فاز ۳ / B6).
 * خالص: فقط تفاوت خلاصه‌ها + تفاات گام‌ها را برمی‌گرداند؛ بدون ادعای بهبود قطعی.
 */

import { symbolLabelFa, type DiagramDoc, type DiagramSymbol } from "./types";
import { summarizeDiagram, type DiagramSummary } from "./validation";

export interface VariantDiff {
  current: DiagramSummary;
  proposed: DiagramSummary;
  /** تغییر شمارش هر نماد: مثبت = افزودن، منفی = حذف */
  countDelta: Record<string, number>;
  totalTimeDeltaSec: number;
  totalDistanceDeltaM: number;
  addedSteps: Array<{ title: string; symbol: DiagramSymbol; symbolFa: string }>;
  removedSteps: Array<{ title: string; symbol: DiagramSymbol; symbolFa: string }>;
  changedSteps: Array<{ title: string; timeBefore: number | null; timeAfter: number | null; distanceBefore: number | null; distanceAfter: number | null }>;
}

/** تطبیق گام‌ها بر اساس عنوان+نماد — کلید انسانی پایدار بین دو نسخه */
function stepKey(doc: DiagramDoc, title: string, symbol: DiagramSymbol): string {
  void doc;
  return `${symbol}::${title.trim()}`;
}

export function diffVariants(currentDoc: DiagramDoc, proposedDoc: DiagramDoc): VariantDiff {
  const current = summarizeDiagram(currentDoc);
  const proposed = summarizeDiagram(proposedDoc);

  const countDelta: Record<string, number> = {};
  const symbols = new Set([...Object.keys(current.counts), ...Object.keys(proposed.counts)]);
  for (const s of symbols) {
    countDelta[s] = (proposed.counts[s] ?? 0) - (current.counts[s] ?? 0);
  }

  const curMap = new Map<string, typeof currentDoc.nodes[number]>();
  for (const n of currentDoc.nodes) curMap.set(stepKey(currentDoc, n.title, n.symbol), n);
  const proMap = new Map<string, typeof proposedDoc.nodes[number]>();
  for (const n of proposedDoc.nodes) proMap.set(stepKey(proposedDoc, n.title, n.symbol), n);

  const addedSteps: VariantDiff["addedSteps"] = [];
  const removedSteps: VariantDiff["removedSteps"] = [];
  const changedSteps: VariantDiff["changedSteps"] = [];

  for (const [key, n] of proMap) {
    if (!curMap.has(key)) {
      addedSteps.push({ title: n.title, symbol: n.symbol, symbolFa: symbolLabelFa(proposedDoc.kind, n.symbol) });
    } else {
      const before = curMap.get(key)!;
      const timeChanged =
        (before.timeSec ?? null) !== (n.timeSec ?? null) || (before.distanceM ?? null) !== (n.distanceM ?? null);
      if (timeChanged) {
        changedSteps.push({
          title: n.title,
          timeBefore: before.timeSec ?? null,
          timeAfter: n.timeSec ?? null,
          distanceBefore: before.distanceM ?? null,
          distanceAfter: n.distanceM ?? null,
        });
      }
    }
  }
  for (const [key, n] of curMap) {
    if (!proMap.has(key)) {
      removedSteps.push({ title: n.title, symbol: n.symbol, symbolFa: symbolLabelFa(currentDoc.kind, n.symbol) });
    }
  }

  return {
    current,
    proposed,
    countDelta,
    totalTimeDeltaSec: proposed.totalTimeSec - current.totalTimeSec,
    totalDistanceDeltaM: proposed.totalDistanceM - current.totalDistanceM,
    addedSteps,
    removedSteps,
    changedSteps,
  };
}
