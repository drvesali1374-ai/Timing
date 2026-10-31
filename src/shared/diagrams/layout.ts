/**
 * چیدمان اولیه خودکار — خالص و قطعی (بند ۳ دستور فاز ۳).
 * جریان عمودی (بالا→پایین) مطابق سنت نمودارهای فرایندی؛ جهت معنایی مستقل از RTL.
 * خروجی DiagramLayout است که ویرایشگر می‌تواند آزادانه بازنویسی کند.
 */

import type { DiagramDoc, DiagramLayout, Point } from "./types";
import { topologicalOrder } from "./validation";

export interface LayoutOptions {
  /** فاصله ردیف‌ها (پیکسل منطقی SVG) */
  rowHeight?: number;
  /** فاصله ستون‌ها */
  columnWidth?: number;
  /** حاشیه آغاز مختصات */
  margin?: number;
}

const DEFAULTS: Required<LayoutOptions> = {
  rowHeight: 150,
  columnWidth: 230,
  margin: 60,
};

/**
 * چیدمان لایه‌ای قطعی:
 *  ۱. سطح هر گره = طولانی‌ترین مسیر از ریشه‌ها (توالی جریان = محور عمودی).
 *  ۲. گره‌های هم‌سطح افقی پخش می‌شوند؛ ترتیب درون سطح = ترتیب ظهور در سند (پایدار).
 *  ۳. در وجود چرخه (نامعتبر)، گره‌های حلقه‌دار با ترتیب ظهور چیده می‌شوند تا خروجی همیشه کامل باشد.
 */
export function autoLayout(doc: DiagramDoc, opts: LayoutOptions = {}): DiagramLayout {
  const { rowHeight, columnWidth, margin } = { ...DEFAULTS, ...opts };
  const positions: Record<string, Point> = {};

  if (doc.nodes.length === 0) return { positions };

  // سطح هر گره = طولانی‌ترین مسیر از ریشه
  const level = new Map<string, number>();
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();
  for (const n of doc.nodes) {
    incoming.set(n.id, []);
    outgoing.set(n.id, []);
  }
  for (const e of doc.edges) {
    if (!incoming.has(e.to) || !outgoing.has(e.from)) continue;
    incoming.get(e.to)!.push(e.from);
    outgoing.get(e.from)!.push(e.to);
  }
  const order = topologicalOrder(doc);
  if (order) {
    for (const id of order) {
      const preds = incoming.get(id) ?? [];
      const lvl = preds.length === 0 ? 0 : Math.max(...preds.map((p) => (level.get(p) ?? 0) + 1));
      level.set(id, lvl);
    }
  } else {
    // چرخه — سطح‌بندی با شمار یال ورودی (تقریبی پایدار)
    for (const n of doc.nodes) level.set(n.id, (incoming.get(n.id) ?? []).length);
  }

  // گروه‌بندی هم‌سطح با ترتیب ظهور پایدار
  const byLevel = new Map<number, string[]>();
  for (const n of doc.nodes) {
    const lvl = level.get(n.id) ?? 0;
    if (!byLevel.has(lvl)) byLevel.set(lvl, []);
    byLevel.get(lvl)!.push(n.id);
  }

  const maxLevel = Math.max(...byLevel.keys());
  for (let lvl = 0; lvl <= maxLevel; lvl += 1) {
    const ids = byLevel.get(lvl) ?? [];
    ids.forEach((id, i) => {
      positions[id] = {
        x: margin + i * columnWidth,
        y: margin + lvl * rowHeight,
      };
    });
  }

  return { positions };
}

/** ابعاد محدوده چیدمان — برای بوم رندر */
export function layoutBounds(layout: DiagramLayout): { width: number; height: number; minX: number; minY: number } {
  const pts = Object.values(layout.positions);
  if (pts.length === 0) return { width: 600, height: 400, minX: 0, minY: 0 };
  const minX = Math.min(...pts.map((p) => p.x));
  const minY = Math.min(...pts.map((p) => p.y));
  const maxX = Math.max(...pts.map((p) => p.x));
  const maxY = Math.max(...pts.map((p) => p.y));
  return { width: maxX - minX + 300, height: maxY - minY + 220, minX, minY };
}
