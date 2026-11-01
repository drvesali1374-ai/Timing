/**
 * گراف تقدم/تأخر (بند ۲ فاز ۶) — هسته خالص.
 *
 * بررسی‌ها: چرخه (DFS رنگی)، تناقض (خودارجاعی/تکرار)، اتصال نامعتبر (ارجاع به
 * فعالیت ناموجود)، فعالیت غیرقابل دستیابی/زمان‌بندی (گره‌های چرخه یا وابسته به چرخه).
 * همچنین: رتبه ستون توپولوژیک (ستون‌های Kilbridge–Wester) + ترتیب توپولوژیک پایدار.
 *
 * مستقل از ماژول activities (دامنه آن اعتبارسنجی «ورودی فرم» است؛ اینجا
 * تحلیل «کل گراف مسئله بالانس» است) — منطق مشابه، مصرف‌کننده متفاوت.
 */

import type { PrecedenceGraphCheck } from "./types";

export interface GraphInputActivity {
  id: string;
  predecessors: string[];
}

/** ساخت لبه‌های [پیش‌نیاز → فعالیت] از فعالیت‌ها. */
export function precedenceEdges(activities: ReadonlyArray<GraphInputActivity>): Array<readonly [string, string]> {
  const edges: Array<readonly [string, string]> = [];
  for (const a of activities) {
    for (const p of a.predecessors) {
      edges.push([p, a.id] as const);
    }
  }
  return edges;
}

/** تشخیص چرخه با DFS رنگی — مسیر چرخه را برمی‌گرداند (اولین چرخه). */
export function findCycle(
  nodes: readonly string[],
  edges: ReadonlyArray<readonly [string, string]>,
): string[] | null {
  const adj = new Map<string, string[]>();
  for (const [before, after] of edges) {
    if (!adj.has(before)) adj.set(before, []);
    adj.get(before)!.push(after);
  }
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  const stack: string[] = [];
  function dfs(node: string): string[] | null {
    color.set(node, GRAY);
    stack.push(node);
    for (const next of adj.get(node) ?? []) {
      const c = color.get(next) ?? WHITE;
      if (c === GRAY) {
        const idx = stack.indexOf(next);
        return [...stack.slice(idx), next];
      }
      if (c === WHITE) {
        const cyc = dfs(next);
        if (cyc) return cyc;
      }
    }
    stack.pop();
    color.set(node, BLACK);
    return null;
  }
  for (const node of nodes) {
    if ((color.get(node) ?? WHITE) === WHITE) {
      const cyc = dfs(node);
      if (cyc) return cyc;
    }
  }
  return null;
}

/** همه چرخه‌ها: حذف تکراری مسیر معادل (نرمال‌سازی چرخش). */
function findAllCycles(
  nodes: readonly string[],
  edges: ReadonlyArray<readonly [string, string]>,
): string[][] {
  const cycles: string[][] = [];
  const seen = new Set<string>();
  let remaining = [...nodes];
  // حداکثر |nodes| تکرار — هر چرخه یک گره از چرخه را از گراف حذف می‌کند
  for (let i = 0; i < nodes.length; i += 1) {
    const cyc = findCycle(remaining, edges);
    if (!cyc) break;
    // نرمال‌سازی: کوچک‌ترین شروع چرخشی برای کلید یکتا
    const body = cyc.slice(0, -1); // آخرین عضو تکرارِ اولی است
    let minIdx = 0;
    for (let j = 1; j < body.length; j += 1) if (body[j] < body[minIdx]) minIdx = j;
    const key = [...body.slice(minIdx), ...body.slice(0, minIdx)].join(">");
    if (!seen.has(key)) {
      seen.add(key);
      cycles.push([...body, body[0]]);
    }
    // حذف یک گره چرخه برای یافتن چرخه‌های بعدی
    remaining = remaining.filter((n) => n !== body[0]);
  }
  return cycles;
}

/**
 * بررسی کامل گراف تقدم مسئله بالانس.
 * nodes = فعالیت‌های مسئله؛ ارجاع به گره خارج از nodes = اتصال نامعتبر.
 */
export function checkPrecedenceGraph(
  activities: ReadonlyArray<GraphInputActivity>,
): PrecedenceGraphCheck {
  const nodes = activities.map((a) => a.id);
  const nodeSet = new Set(nodes);
  const messagesFa: string[] = [];

  // ۱) خودارجاعی و ارجاع ناموجود و تکراری
  const selfRefs: string[] = [];
  const unknownRefs: Array<{ from: string; ref: string }> = [];
  const duplicateRefs: Array<{ from: string; ref: string }> = [];
  for (const a of activities) {
    const seen = new Set<string>();
    for (const p of a.predecessors) {
      if (p === a.id) {
        selfRefs.push(a.id);
        continue;
      }
      if (seen.has(p)) {
        duplicateRefs.push({ from: a.id, ref: p });
        continue;
      }
      seen.add(p);
      if (!nodeSet.has(p)) {
        unknownRefs.push({ from: a.id, ref: p });
      }
    }
  }

  // ۲) لبه‌های معتبر (فقط بین گره‌های موجود، بدون خودارجاعی/تکرار)
  const edges = precedenceEdges(activities).filter(([b, a]) => nodeSet.has(b) && nodeSet.has(a) && b !== a);

  // ۳) چرخه‌ها
  const cycles = findAllCycles(nodes, edges);

  // ۴) گره‌های غیرقابل زمان‌بندی: عضو چرخه + وابسته (مستقیم/غیرمستقیم) به چرخه
  const cycleNodes = new Set<string>();
  for (const cyc of cycles) for (const n of cyc) cycleNodes.add(n);
  const unschedulable = new Set<string>(cycleNodes);
  if (cycleNodes.size > 0) {
    // انتشار رو به جلو: هر فعالیتی که (جزئی) به گره چرخه وابسته است
    const adj = new Map<string, string[]>();
    for (const [b, a] of edges) {
      if (!adj.has(b)) adj.set(b, []);
      adj.get(b)!.push(a);
    }
    const queue = [...cycleNodes];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      for (const next of adj.get(cur) ?? []) {
        if (!unschedulable.has(next)) {
          unschedulable.add(next);
          queue.push(next);
        }
      }
    }
  }

  // ۵) ستون‌های توپولوژیک (Kilbridge–Wester) + ترتیب توپولوژیک — فقط روی DAG سالم
  const columns: Record<string, number> = {};
  const topologicalOrder: string[] = [];
  const graphOk = cycles.length === 0 && unknownRefs.length === 0 && selfRefs.length === 0;
  if (graphOk) {
    const preds = new Map<string, string[]>();
    const adj = new Map<string, string[]>();
    const indeg = new Map<string, number>();
    for (const n of nodes) {
      preds.set(n, []);
      adj.set(n, []);
      indeg.set(n, 0);
    }
    for (const [b, a] of edges) {
      adj.get(b)!.push(a);
      preds.get(a)!.push(b);
      indeg.set(a, (indeg.get(a) ?? 0) + 1);
    }
    // Kahn با صف پایدار (مرتب‌سازی الفبایی برای قطعیت)
    let frontier = nodes.filter((n) => (indeg.get(n) ?? 0) === 0).sort();
    while (frontier.length > 0) {
      const next: string[] = [];
      for (const n of frontier) {
        topologicalOrder.push(n);
        // ستون = طولانی‌ترین مسیر از ریشه
        const predCols = (preds.get(n) ?? []).map((p) => columns[p] ?? 0);
        columns[n] = predCols.length > 0 ? Math.max(...predCols) + 1 : 0;
        for (const succ of adj.get(n) ?? []) {
          indeg.set(succ, (indeg.get(succ) ?? 1) - 1);
          if ((indeg.get(succ) ?? 0) === 0) next.push(succ);
        }
      }
      frontier = next.sort();
    }
  }

  // پیام‌های فارسی صادقانه
  if (selfRefs.length > 0) messagesFa.push(`خودارجاعی: ${selfRefs.join("، ")} — فعالیت پیش‌نیاز خودش است.`);
  for (const u of unknownRefs) {
    messagesFa.push(`اتصال نامعتبر: «${u.from}» به فعالیت ناموجود «${u.ref}» ارجاع داده است.`);
  }
  for (const d of duplicateRefs) {
    messagesFa.push(`تناقض (تکرار): «${d.from}» پیش‌نیاز «${d.ref}» را دوبار ثبت کرده است.`);
  }
  for (const cyc of cycles) {
    messagesFa.push(`چرخه: ${cyc.join(" ← ")} — زمان‌بندی ممکن نیست.`);
  }
  if (unschedulable.size > cycleNodes.size) {
    const blocked = [...unschedulable].filter((n) => !cycleNodes.has(n));
    messagesFa.push(`فعالیت غیرقابل دستیابی (وابسته به چرخه): ${blocked.join("، ")}.`);
  }
  if (graphOk) messagesFa.push("گراف تقدم سالم است (بدون چرخه/تناقض/اتصال نامعتبر).");

  return {
    ok: graphOk && duplicateRefs.length === 0,
    cycles,
    unknownRefs,
    selfRefs,
    duplicateRefs,
    unschedulable: [...unschedulable],
    columns,
    topologicalOrder,
    messagesFa,
  };
}
