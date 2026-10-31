/**
 * موتور اعتبارسنجی نمودار OPC/FPC — خالص و قطعی (ENGINE_CONTRACTS §۲).
 *
 * خطاها (نمودار قابل ذخیره نیست مگر با پرچم صریح):
 *   invalid-connection — یال به گره ناموجود / خودحلقه
 *   duplicate-id       — شناسه گره تکراری
 *   duplicate-edge     — یال تکراری (هم جهت)
 *   unknown-activity   — مرجع فعالیت ناموجود در پروژه
 *   bad-symbol         — نماد خارج از فهرست بسته نوع نمودار
 *   bad-value          — زمان منفی / مسافت منفی
 *   missing-subject    — FPC بدون موضوع مطالعه
 *   limit              — فراتر از سقف گره/یال
 *
 * هشدارها (نمودار قابل ذخیره است اما باید دیده شود):
 *   unconnected        — گام بدون اتصال
 *   order-inconsistent — ترتیب ناسازگار (چرخه یا شماره گام ناهماهنگ با توالی)
 *   no-time            — نماد بدون زمان
 *   no-distance        — حمل بدون مسافت
 *   component-no-source — ورود جزء بدون نام منبع
 */

import {
  DIAGRAM_LIMITS,
  isDiagramSymbolFor,
  type DiagramDoc,
} from "./types";

export type DiagramIssueCode =
  | "invalid-connection"
  | "duplicate-id"
  | "duplicate-edge"
  | "unknown-activity"
  | "bad-symbol"
  | "bad-value"
  | "missing-subject"
  | "limit"
  | "unconnected"
  | "order-inconsistent"
  | "no-time"
  | "no-distance"
  | "component-no-source";

export interface DiagramIssue {
  code: DiagramIssueCode;
  severity: "error" | "warning";
  nodeId?: string;
  edgeId?: string;
  messageFa: string;
}

export interface DiagramSummary {
  counts: Record<string, number>;
  totalTimeSec: number;
  totalDistanceM: number;
  nodeCount: number;
  edgeCount: number;
}

export interface DiagramValidationReport {
  valid: boolean; // بدون خطا (هشدار مجاز است)
  errors: DiagramIssue[];
  warnings: DiagramIssue[];
  summary: DiagramSummary;
}

/** ارزیاب خارجی — کلیدهای فعالیت‌های موجود پروژه (برای unknown-activity) */
export interface DiagramValidationContext {
  knownActivityKeys?: readonly string[];
}

export function validateDiagram(doc: DiagramDoc, ctx: DiagramValidationContext = {}): DiagramValidationReport {
  const errors: DiagramIssue[] = [];
  const warnings: DiagramIssue[] = [];

  // ── سقف‌ها ──
  if (doc.nodes.length > DIAGRAM_LIMITS.maxNodes) {
    errors.push({ code: "limit", severity: "error", messageFa: `تعداد گره‌ها بیش از سقف ${DIAGRAM_LIMITS.maxNodes} است.` });
  }
  if (doc.edges.length > DIAGRAM_LIMITS.maxEdges) {
    errors.push({ code: "limit", severity: "error", messageFa: `تعداد اتصال‌ها بیش از سقف ${DIAGRAM_LIMITS.maxEdges} است.` });
  }

  // ── موضوع مطالعه FPC ──
  if (doc.kind === "fpc" && !doc.subject) {
    errors.push({ code: "missing-subject", severity: "error", messageFa: "نمودار FPC بدون موضوع مطالعه (ماده/فرد/تجهیزات) معتبر نیست." });
  }

  // ── شناسه تکراری + نماد + مقادیر ──
  const byId = new Map<string, typeof doc.nodes[number]>();
  for (const node of doc.nodes) {
    if (byId.has(node.id)) {
      errors.push({ code: "duplicate-id", severity: "error", nodeId: node.id, messageFa: `شناسه گره «${node.id}» تکراری است.` });
    } else {
      byId.set(node.id, node);
    }
    if (!isDiagramSymbolFor(doc.kind, node.symbol)) {
      errors.push({
        code: "bad-symbol",
        severity: "error",
        nodeId: node.id,
        messageFa: `نماد «${node.symbol}» در فهرست بسته نمادهای ${doc.kind === "opc" ? "OPC" : "FPC"} نیست.`,
      });
    }
    if (node.timeSec !== undefined && node.timeSec !== null && (Number.isNaN(node.timeSec) || node.timeSec < 0)) {
      errors.push({ code: "bad-value", severity: "error", nodeId: node.id, messageFa: `زمان گام «${node.title}» نامعتبر است (منفی/نامعین).` });
    }
    if (node.distanceM !== undefined && node.distanceM !== null && (Number.isNaN(node.distanceM) || node.distanceM < 0)) {
      errors.push({ code: "bad-value", severity: "error", nodeId: node.id, messageFa: `مسافت گام «${node.title}» نامعتبر است (منفی/نامعین).` });
    }
  }

  // ── یال‌ها ──
  const edgeSeen = new Set<string>();
  for (const edge of doc.edges) {
    if (!byId.has(edge.from) || !byId.has(edge.to)) {
      errors.push({
        code: "invalid-connection",
        severity: "error",
        edgeId: edge.id,
        messageFa: `اتصال نامعتبر: گره «${!byId.has(edge.from) ? edge.from : edge.to}» وجود ندارد.`,
      });
      continue;
    }
    if (edge.from === edge.to) {
      errors.push({ code: "invalid-connection", severity: "error", edgeId: edge.id, messageFa: "اتصال خودحلقه (گره به خودش) مجاز نیست." });
      continue;
    }
    const key = `${edge.from}→${edge.to}`;
    if (edgeSeen.has(key)) {
      errors.push({ code: "duplicate-edge", severity: "error", edgeId: edge.id, messageFa: `اتصال تکراری «${edge.from}→${edge.to}».` });
      continue;
    }
    edgeSeen.add(key);
  }

  // ── مرجع فعالیت ──
  const known = ctx.knownActivityKeys;
  if (known) {
    const knownSet = new Set(known);
    for (const node of doc.nodes) {
      if (node.activityStableKey && !knownSet.has(node.activityStableKey)) {
        errors.push({
          code: "unknown-activity",
          severity: "error",
          nodeId: node.id,
          messageFa: `مرجع فعالیت «${node.activityStableKey}» در فعالیت‌های پروژه موجود نیست.`,
        });
      }
    }
  }

  // ── گره بدون اتصال ── (اگر بیش از یک گره هست)
  if (doc.nodes.length > 1) {
    const connected = new Set<string>();
    for (const edge of doc.edges) {
      connected.add(edge.from);
      connected.add(edge.to);
    }
    for (const node of doc.nodes) {
      if (!connected.has(node.id)) {
        warnings.push({ code: "unconnected", severity: "warning", nodeId: node.id, messageFa: `گام «${node.title}» به هیچ گام دیگری متصل نیست.` });
      }
    }
  }

  // ── چرخه / ترتیب ناسازگار ──
  const cycle = findCycle(doc);
  if (cycle) {
    warnings.push({
      code: "order-inconsistent",
      severity: "warning",
      messageFa: `توالی جریان چرخه دارد (${cycle.join(" ← ")}) — ترتیب گام‌ها ناسازگار است.`,
    });
  } else if (doc.nodes.length > 1) {
    // شماره گام باید با ترتیب توپولوژیک هماهنگ باشد (اگر شماره‌دار است)
    const order = topologicalOrder(doc);
    const posInOrder = new Map((order ?? doc.nodes.map((n) => n.id)).map((id, i) => [id, i] as const));
    const numbered = doc.nodes.filter((n) => n.stepNo !== null && n.stepNo !== undefined);
    for (let i = 1; i < numbered.length; i += 1) {
      const prev = numbered[i - 1];
      const curr = numbered[i];
      const pPrev = posInOrder.get(prev.id) ?? 0;
      const pCurr = posInOrder.get(curr.id) ?? 0;
      if ((prev.stepNo ?? 0) > (curr.stepNo ?? 0)) {
        warnings.push({
          code: "order-inconsistent",
          severity: "warning",
          nodeId: curr.id,
          messageFa: `شماره گام «${curr.title}» (${curr.stepNo}) کوچک‌تر از گام قبلی (${prev.stepNo}) است.`,
        });
      } else if (pPrev > pCurr && (prev.stepNo ?? 0) < (curr.stepNo ?? 0)) {
        warnings.push({
          code: "order-inconsistent",
          severity: "warning",
          nodeId: curr.id,
          messageFa: `شماره گام «${curr.title}» با جهت جریان هماهنگ نیست.`,
        });
      }
    }
  }

  // ── نماد بدون زمان / مسافت / منبع ──
  for (const node of doc.nodes) {
    if (node.symbol === "storage") continue; // انبارش معمولاً بدون زمان گام است
    if (node.timeSec === undefined || node.timeSec === null) {
      warnings.push({ code: "no-time", severity: "warning", nodeId: node.id, messageFa: `گام «${node.title}» زمان ثبت‌شده ندارد.` });
    }
    if (doc.kind === "fpc" && node.symbol === "transport" && (node.distanceM === undefined || node.distanceM === null)) {
      warnings.push({ code: "no-distance", severity: "warning", nodeId: node.id, messageFa: `گام حمل «${node.title}» مسافت ثبت‌شده ندارد.` });
    }
    if (doc.kind === "opc" && node.symbol === "componentEntry" && !node.sourceRef?.trim()) {
      warnings.push({ code: "component-no-source", severity: "warning", nodeId: node.id, messageFa: `ورود جزء «${node.title}» نام جزء/منبع ندارد.` });
    }
  }

  return { valid: errors.length === 0, errors, warnings, summary: summarizeDiagram(doc) };
}

// ─────────────────────── خلاصه ───────────────────────

export function summarizeDiagram(doc: DiagramDoc): DiagramSummary {
  const counts: Record<string, number> = {};
  let totalTimeSec = 0;
  let totalDistanceM = 0;
  for (const node of doc.nodes) {
    counts[node.symbol] = (counts[node.symbol] ?? 0) + 1;
    if (typeof node.timeSec === "number" && !Number.isNaN(node.timeSec)) totalTimeSec += node.timeSec;
    if (typeof node.distanceM === "number" && !Number.isNaN(node.distanceM)) totalDistanceM += node.distanceM;
  }
  return { counts, totalTimeSec, totalDistanceM, nodeCount: doc.nodes.length, edgeCount: doc.edges.length };
}

// ─────────────────────── گراف ───────────────────────

/** مرتب‌سازی توپولوژیک پایدار (Kahn با صف FIFO) — null یعنی چرخه */
export function topologicalOrder(doc: DiagramDoc): string[] | null {
  const indeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const n of doc.nodes) {
    indeg.set(n.id, 0);
    adj.set(n.id, []);
  }
  for (const e of doc.edges) {
    if (!adj.has(e.from) || !indeg.has(e.to)) continue;
    adj.get(e.from)!.push(e.to);
    indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);
  }
  const queue: string[] = [];
  for (const n of doc.nodes) {
    if ((indeg.get(n.id) ?? 0) === 0) queue.push(n.id);
  }
  const order: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    for (const next of adj.get(id) ?? []) {
      const d = (indeg.get(next) ?? 0) - 1;
      indeg.set(next, d);
      if (d === 0) queue.push(next);
    }
  }
  return order.length === doc.nodes.length ? order : null;
}

/** مسیر چرخه (DFS رنگی) — null یعنی بدون چرخه */
export function findCycle(doc: DiagramDoc): string[] | null {
  const adj = new Map<string, string[]>();
  for (const e of doc.edges) {
    if (!adj.has(e.from)) adj.set(e.from, []);
    adj.get(e.from)!.push(e.to);
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
  for (const node of adj.keys()) {
    if ((color.get(node) ?? WHITE) === WHITE) {
      const cyc = dfs(node);
      if (cyc) return cyc;
    }
  }
  return null;
}
