/**
 * کتابخانه الگوریتم‌های بالانس خط (بند ۳/۴ فاز ۶ — ADR-008).
 *
 * پیاده‌سازی: سه الگوریتم قطعی و قابل‌توضیح + حالت دستی:
 *  - LCR (Largest Candidate Rule): مرتب‌سازی زمان نزولی + جای‌گذاری حریصانه در
 *    اولین ایستگاه ممکن (تقدم + ظرفیت + ناسازگاری).
 *  - RPW (Ranked Positional Weight — Helgeson–Birnie): وزن موقعیتی = زمان فعالیت +
 *    زمان همه جانشینان (انتقالی)؛ مرتب‌سازی نزولی + همان جای‌گذاری حریصانه.
 *  - Kilbridge–Wester: مرتب‌سازی ستون‌های پیش‌نیازی (ستون = طولانی‌ترین مسیر از ریشه)،
 *    داخل ستون زمان نزولی؛ جای‌گذاری حریصانه در اولین ایستگاه ممکن.
 *    ساده‌سازی مستند: KW کلاسیک «پر کردن پیوسته ستون‌ها» را با مرتب‌سازی ستون-محور +
 *    جای‌گذاری حریصانه بازنمایی می‌کند (ثبت در KNOWN_LIMITATIONS).
 *  - Manual: تخصیص کاربر — فقط اعتبارسنجی + محاسبه شاخص‌ها.
 *
 * صداقت (ADR-008): خروجی ابتکاری = «بهترین راهکار یافت‌شده» نه «بهینه قطعی».
 * MILP/CP-SAT در پایه نیست — رابط افزونه BalanceAlgorithm برای حل‌گرهای آینده.
 *
 * منابع روش (STANDARDS_CATALOG ردیف ۷-۸ + Helgeson–Birnie 1961، Kilbridge–Wester 1961):
 * جزئیات در docs/STANDARDS_CATALOG.md و FORMULA_CATALOG §BAL.
 */

import { checkPrecedenceGraph } from "./graph";
import { buildStations, computeMetrics, isSerialWork, validateAssignment } from "./metrics";
import type {
  BalanceActivity,
  BalanceAlgorithmId,
  BalanceProblem,
  BalanceSolution,
  BalanceStatus,
  PrecedenceGraphCheck,
  SolveOptions,
} from "./types";

export interface BalanceAlgorithm {
  id: BalanceAlgorithmId;
  labelFa: string;
  version: string;
  descriptionFa: string;
  solve(problem: BalanceProblem, options?: { assignment?: Record<string, number>; timeBudgetMs?: number }): BalanceSolution;
}

// ─────────────────────── چارچوب جای‌گذاری حریصانه ───────────────────────

interface GreedyState {
  problem: BalanceProblem;
  /** زمان سریال انباشته هر ایستگاه (اندیس ۰ = ایستگاه ۱) */
  stationTimes: number[];
  stationMembers: string[][];
  assigned: Map<string, number>;
  byId: Map<string, BalanceActivity>;
}

function serialTime(a: BalanceActivity): number {
  return isSerialWork(a.workType) ? a.timeMs : 0;
}

/** آیا فعالیت t در ایستگاه s (۱-مبنا) قابل قرارگیری است؟ (تقدم + ظرفیت + ناسازگاری) */
function canPlace(state: GreedyState, act: BalanceActivity, station: number): boolean {
  // تقدم: همه پیش‌نیازهای معتبر باید در ایستگاه ≤ s باشند
  for (const p of act.predecessors) {
    const predSt = state.assigned.get(p);
    if (predSt !== undefined && predSt > station) return false;
  }
  // ناسازگاری — متقارن: فهرست هر دو طرف بررسی می‌شود
  const members = state.stationMembers[station - 1] ?? [];
  for (const member of members) {
    if (act.incompatibleWith.includes(member)) return false;
    const other = state.byId.get(member);
    if (other && other.incompatibleWith.includes(act.id)) return false;
  }
  // ظرفیت
  const current = state.stationTimes[station - 1] ?? 0;
  return current + serialTime(act) <= state.problem.taktMs;
}

function place(state: GreedyState, act: BalanceActivity): number {
  const maxStations = state.problem.maxStations;
  for (let s = 1; s <= state.stationTimes.length; s += 1) {
    if (canPlace(state, act, s)) return commit(state, act, s);
  }
  // ایستگاه تازه — احترام به سقف (اگر سقف پر است: آخرین ایستگاه با پرچم)
  const next = state.stationTimes.length + 1;
  if (maxStations === null || next <= maxStations || state.stationTimes.length === 0) {
    return commit(state, act, next);
  }
  return commit(state, act, maxStations);
}

function commit(state: GreedyState, act: BalanceActivity, station: number): number {
  while (state.stationTimes.length < station) {
    state.stationTimes.push(0);
    state.stationMembers.push([]);
  }
  state.stationTimes[station - 1] += serialTime(act);
  state.stationMembers[station - 1].push(act.id);
  state.assigned.set(act.id, station);
  return station;
}

/** حل حریصانه با ترتیب داده‌شده — تا همه فعالیت‌های زمان‌دار تخصیص یابند. */
function greedyByOrder(problem: BalanceProblem, orderedIds: readonly string[]): Record<string, number> {
  const byId = new Map(problem.activities.map((a) => [a.id, a]));
  const state: GreedyState = { problem, stationTimes: [], stationMembers: [], assigned: new Map(), byId };
  const pending = orderedIds.filter((id) => {
    const a = byId.get(id);
    return a !== undefined && a.timeStatus === "valid";
  });
  const remaining = new Set(pending);
  let guard = 0;
  while (remaining.size > 0 && guard <= pending.length + 1) {
    guard += 1;
    let progress = false;
    for (const id of pending) {
      if (!remaining.has(id)) continue;
      const act = byId.get(id)!;
      // پیش‌نیازهای معتبر باید تخصیص شده باشند (اگر خودشان زمان‌دارند)
      const blocked = act.predecessors.some((p) => {
        const pred = byId.get(p);
        return pred !== undefined && pred.timeStatus === "valid" && !state.assigned.has(p);
      });
      if (blocked) continue;
      place(state, act);
      remaining.delete(id);
      progress = true;
    }
    if (!progress) {
      // بن‌بست (مثلاً پیش‌نیاز بدون زمان معتبر با چرخه معنایی) — باقی‌مانده صادقانه رها می‌شود
      break;
    }
  }
  return Object.fromEntries(state.assigned);
}

// ─────────────────────── ترتیب‌های الگوریتمی ───────────────────────

/** LCR: زمان نزولی (تساوی: stableKey صعودی — قطعیت). */
function orderLCR(activities: readonly BalanceActivity[]): string[] {
  return [...activities].sort((a, b) => b.timeMs - a.timeMs || (a.id < b.id ? -1 : 1)).map((a) => a.id);
}

/** RPW: وزن موقعیتی = زمان فعالیت + زمان همه جانشینان انتقالی (تساوی: stableKey). */
export function rankedPositionalWeights(activities: readonly BalanceActivity[]): Map<string, number> {
  const byId = new Map(activities.map((a) => [a.id, a]));
  const successors = new Map<string, string[]>();
  for (const a of activities) successors.set(a.id, []);
  for (const a of activities) {
    for (const p of a.predecessors) {
      if (successors.has(p)) successors.get(p)!.push(a.id);
    }
  }
  // RPW بازگشتی با حافظه (گراف DAG سالم — چرخه در solve رد می‌شود)
  const memo = new Map<string, number>();
  function rpw(id: string): number {
    const cached = memo.get(id);
    if (cached !== undefined) return cached;
    memo.set(id, byId.get(id)?.timeMs ?? 0); // محافظ بن‌بست چرخه
    let total = byId.get(id)?.timeMs ?? 0;
    for (const succ of successors.get(id) ?? []) {
      total += rpw(succ);
    }
    memo.set(id, total);
    return total;
  }
  for (const a of activities) rpw(a.id);
  return memo;
}

function orderRPW(activities: readonly BalanceActivity[]): string[] {
  const rpw = rankedPositionalWeights(activities);
  return [...activities]
    .sort((a, b) => (rpw.get(b.id) ?? 0) - (rpw.get(a.id) ?? 0) || (a.id < b.id ? -1 : 1))
    .map((a) => a.id);
}

/** Kilbridge–Wester: ستون توپولوژیک صعودی، داخل ستون زمان نزولی (تساوی: stableKey). */
function orderKilbridgeWester(activities: readonly BalanceActivity[], graph: PrecedenceGraphCheck): string[] {
  const byId = new Map(activities.map((a) => [a.id, a]));
  return [...activities]
    .sort((a, b) => {
      const ca = graph.columns[a.id] ?? 0;
      const cb = graph.columns[b.id] ?? 0;
      if (ca !== cb) return ca - cb;
      return b.timeMs - a.timeMs || (a.id < b.id ? -1 : 1);
    })
    .map((a) => a.id);
}

// ─────────────────────── ساخت راهکار مشترک ───────────────────────

function assemble(
  problem: BalanceProblem,
  algorithm: BalanceAlgorithmId,
  labelFa: string,
  version: string,
  assignments: Record<string, number>,
  notesFa: string[],
  runMs: number,
): BalanceSolution {
  const stations = buildStations(assignments, problem);
  const metrics = computeMetrics(stations, problem, assignments);
  const { violations, respectedCount } = validateAssignment(problem, assignments);
  const hasHard = violations.some((v) => v.code === "precedence" || v.code === "unknown-activity" || v.code === "incompatible" || v.code === "missing-activity" || v.code === "duplicate-assignment");
  const hasSoft = violations.length > 0;
  const status: BalanceStatus = hasHard ? "infeasible-flagged" : hasSoft ? "solved-with-flags" : "solved";
  return {
    algorithm,
    algorithmLabelFa: labelFa,
    algorithmVersion: version,
    assignments,
    stations,
    metrics,
    violations,
    respectedConstraintsCount: respectedCount,
    runMs,
    status,
    notesFa,
  };
}

// ─────────────────────── الگوریتم‌ها ───────────────────────

const LCR_NOTES = [
  "الگوریتم حریصانه قطعی (Largest Candidate Rule) — «بهترین راهکار یافت‌شده»، نه بهینه اثبات‌شده.",
  "ترتیب: زمان نزولی (تساوی: کلید فنی صعودی)؛ جای‌گذاری: اولین ایستگاه ممکن با رعایت تقدم/ظرفیت/ناسازگاری.",
];

const RPW_NOTES = [
  "وزن موقعیتی رتبه‌بندی‌شده (Helgeson–Birnie، ۱۹۶۱) — «بهترین راهکار یافت‌شده»، نه بهینه اثبات‌شده.",
  "RPW(t) = زمان t + Σ زمان همه جانشینان انتقالی؛ ترتیب نزولی RPW + جای‌گذاری حریصانه.",
];

const KW_NOTES = [
  "Kilbridge–Wester (۱۹۶۱) — ستون‌های پیش‌نیازی؛ «بهترین راهکار یافت‌شده»، نه بهینه اثبات‌شده.",
  "ساده‌سازی مستند: مرتب‌سازی (ستون توپولوژیک، سپس زمان نزولی) + جای‌گذاری حریصانه در اولین ایستگاه ممکن — نسخه کلاسیک «پرکردن پیوسته ستون‌ها» نیست.",
];

const MANUAL_NOTES = [
  "تخصیص دستی کاربر — اعتبارسنجی کامل قیود + محاسبه فوری شاخص‌ها (کنترل انسانی B10).",
];

const lcr: BalanceAlgorithm = {
  id: "lcr",
  labelFa: "LCR — قاعده نامزد بزرگ",
  version: "1.0.0",
  descriptionFa: "فعالیت‌ها به ترتیب زمان نزولی در اولین ایستگاه ممکن قرار می‌گیرند.",
  solve(problem) {
    const t0 = Date.now();
    const activities = problem.activities.filter((a) => a.timeStatus === "valid");
    const assignments = greedyByOrder(problem, orderLCR(activities));
    return assemble(problem, "lcr", lcr.labelFa, lcr.version, assignments, LCR_NOTES, Date.now() - t0);
  },
};

const rpw: BalanceAlgorithm = {
  id: "rpw",
  labelFa: "RPW — وزن موقعیتی رتبه‌بندی‌شده",
  version: "1.0.0",
  descriptionFa: "وزن هر فعالیت = زمان خودش + زمان همه جانشینان؛ ترتیب نزولی وزن.",
  solve(problem) {
    const t0 = Date.now();
    const activities = problem.activities.filter((a) => a.timeStatus === "valid");
    const assignments = greedyByOrder(problem, orderRPW(activities));
    return assemble(problem, "rpw", rpw.labelFa, rpw.version, assignments, RPW_NOTES, Date.now() - t0);
  },
};

const kilbridgeWester: BalanceAlgorithm = {
  id: "kilbridge-wester",
  labelFa: "KW — کیلبریج–وستر",
  version: "1.0.0",
  descriptionFa: "مرتب‌سازی بر اساس ستون‌های پیش‌نیازی (رتبه توپولوژیک) و زمان نزولی درون ستون.",
  solve(problem) {
    const t0 = Date.now();
    const activities = problem.activities.filter((a) => a.timeStatus === "valid");
    const graph = checkPrecedenceGraph(activities);
    const assignments = graph.ok
      ? greedyByOrder(problem, orderKilbridgeWester(activities, graph))
      : {};
    const notes = [...KW_NOTES];
    if (!graph.ok) notes.push("گراف تقدم ناسالم است — راهکاری تولید نشد (فقط قیود نقض‌شده گزارش می‌شود).");
    return assemble(problem, "kilbridge-wester", kilbridgeWester.labelFa, kilbridgeWester.version, assignments, notes, Date.now() - t0);
  },
};

const manual: BalanceAlgorithm = {
  id: "manual",
  labelFa: "دستی — تخصیص کاربر",
  version: "1.0.0",
  descriptionFa: "تخصیص کاربر با اعتبارسنجی فوری قیود و محاسبه شاخص‌ها.",
  solve(problem, options = {}) {
    const t0 = Date.now();
    const assignments: Record<string, number> = { ...(options.assignment ?? {}) };
    return assemble(problem, "manual", manual.labelFa, manual.version, assignments, MANUAL_NOTES, Date.now() - t0);
  },
};

/** رجیستری الگوریتم‌ها — رابط افزونه (ADR-008): افزودن COMSOAL/MILP آینده بدون تغییر مصرف‌کننده. */
export const BALANCE_ALGORITHMS: Record<BalanceAlgorithmId, BalanceAlgorithm> = {
  lcr,
  rpw,
  "kilbridge-wester": kilbridgeWester,
  manual,
};

export function isBalanceAlgorithmId(v: unknown): v is BalanceAlgorithmId {
  return typeof v === "string" && v in BALANCE_ALGORITHMS;
}

/** نقطه ورود موتور — بند ۴: بدون حل‌گر دقیق؛ قابل توسعه. */
export function solveBalance(problem: BalanceProblem, options: SolveOptions): BalanceSolution {
  const algo = BALANCE_ALGORITHMS[options.algorithm];
  if (!algo) {
    throw new Error(`الگوریتم بالانس نامعتبر: ${String(options.algorithm)}`);
  }
  const solution = algo.solve(problem, { assignment: options.assignment, timeBudgetMs: options.timeBudgetMs });
  // بند ۱۰: گزارش صریح فعالیت‌های بدون زمان معتبر (عدد جعلی ممنوع)
  const missing = problem.activities.filter((a) => a.timeStatus === "missing");
  if (missing.length > 0) {
    solution.notesFa.push(
      `فعالیت بدون زمان معتبر (از تخصیص کنار گذاشته شد): ${missing.map((a) => a.id).join("، ")} — مبنای زمان را تغییر دهید یا بازتنظیم دستی بدهید.`,
    );
  }
  return solution;
}
