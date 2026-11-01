/**
 * آزمون‌های واحد هسته بالانس (فاز ۶) — مثال‌های مرجع با «محاسبه مستقل» (R6-1/2).
 *
 * مقادیر مورد انتظار جدا از پیاده‌سازی و با محاسبه دستی hard-code شده‌اند
 * (معیار پذیرش: «شاخص‌ها با محاسبه مستقل تطبیق داشته باشند»).
 *
 * مثال مرجع ۱ (تاکت ۶۰ث، ۵ فعالیت — هر سه الگوریتم همگرا):
 *   a=20, b=15, c=25(p:a), d=35(p:b), e=30(p:c,d)
 *   ردیابی دستی LCR (مرتب‌سازی زمان نزولی d,e,c,a,b + جای‌گذاری حریصانه):
 *     پاس ۱: d✗(p:b) e✗(p:c,d) c✗(p:a) a→S1(20) b→S1(35)
 *     پاس ۲: d→S1? 35+35=70>60 → S2(35) · e✗(c هنوز نیست) · c→S1? 35+25=60≤60 ✓ → S1(60)
 *     پاس ۳: e→S2? 35+30=65>60 → S3(30)
 *   نتیجه: S1={a,b,c}=60 · S2={d}=35 · S3={e}=30 · m=3 · C=60 · E=125/(3×60)=69.444٪
 *   d=30.556٪ · mMin=ceil(125/60)=3 · بیکاری=0+25+30=55ث · نیروی نظری=ceil(125/60)=3
 *
 * مثال مرجع ۲ (تاکت ۵۰ث — LCR ≠ RPW، اثبات تمایز پیاده‌سازی‌ها):
 *   a=10, b=40(p:a), c=30, d=20(p:c)
 *   LCR دستی: S1={c,d}=50 · S2={a,b}=50 · m=2 · E=100/(2×50)=100٪
 *   RPW دستی: RPW(a)=50, RPW(c)=50, RPW(b)=40, RPW(d)=20 → S1={a,c}=40 · S2={b}=40 · S3={d}=20 · m=3 · E=83.333٪
 */

import { describe, expect, test } from "bun:test";
import { checkPrecedenceGraph } from "./graph";
import { solveBalance, rankedPositionalWeights } from "./algorithms";
import { buildStations, computeMetrics, stationLoad, validateAssignment } from "./metrics";
import type { BalanceActivity, BalanceProblem } from "./types";

const S = (sec: number) => sec * 1000;

function act(
  id: string,
  timeSec: number,
  preds: string[] = [],
  workType: BalanceActivity["workType"] = "operatorManual",
): BalanceActivity {
  return {
    id,
    name: id,
    timeMs: S(timeSec),
    workType,
    predecessors: preds,
    stationHint: null,
    incompatibleWith: [],
    timeSource: "override",
    timeStatus: "valid",
    timeSourceFa: "تست",
  };
}

function problem(activities: BalanceActivity[], taktSec: number, extra: Partial<BalanceProblem> = {}): BalanceProblem {
  return {
    activities,
    taktMs: S(taktSec),
    taktSourceFa: "تست",
    maxStations: null,
    objectives: { minimizeStations: 0.4, smoothLoad: 0.4, minChanges: 0.2 },
    referenceAssignment: null,
    ...extra,
  };
}

const EPS = 1e-9;

// ─────────────────────── مثال مرجع ۱ — همگرایی سه الگوریتم ───────────────────────

const EX1 = [
  act("a", 20),
  act("b", 15),
  act("c", 25, ["a"]),
  act("d", 35, ["b"]),
  act("e", 30, ["c", "d"]),
];
const P1 = problem(EX1, 60);

describe("مثال مرجع ۱ — LCR (تاکت ۶۰ث)", () => {
  const sol = solveBalance(P1, { algorithm: "lcr" });

  test("تخصیص: S1={a,b,c} · S2={d} · S3={e} (ردیابی دستی)", () => {
    expect(sol.assignments).toEqual({ a: 1, b: 1, c: 1, d: 2, e: 3 });
  });
  test("بار ایستگاه‌ها: 60/35/30 ثانیه", () => {
    expect(sol.stations.map((st) => st.serialMs)).toEqual([S(60), S(35), S(30)]);
  });
  test("بدون نقض قید — وضعیت solved", () => {
    expect(sol.violations).toEqual([]);
    expect(sol.status).toBe("solved");
  });
  test("m=3 · گلوگاه=60ث · E=69.444٪ · d=30.556٪", () => {
    expect(sol.metrics.stationCount).toBe(3);
    expect(sol.metrics.bottleneckMs).toBe(S(60));
    expect(sol.metrics.efficiencyPct!).toBeCloseTo((125 / 180) * 100, 6);
    expect(sol.metrics.delayPct!).toBeCloseTo(100 - (125 / 180) * 100, 6);
  });
  test("mMin=3 · بیکاری کل=55ث · نیروی نظری=3 · عملیاتی=3", () => {
    expect(sol.metrics.minStationsTheoretical).toBe(3);
    expect(sol.metrics.totalIdleMs).toBe(S(55));
    expect(sol.metrics.theoreticalOperators).toBe(3);
    expect(sol.metrics.operationalOperators).toBe(3);
  });
  test("بیکاری هر ایستگاه: 0/25/30 ثانیه", () => {
    expect(sol.metrics.idlePerStationMs).toEqual([S(0), S(25), S(30)]);
  });
});

describe("مثال مرجع ۱ — RPW", () => {
  test("وزن‌های موقعیتی مستقل: a=75, b=80, c=55, d=65, e=30", () => {
    const rpw = rankedPositionalWeights(EX1);
    expect(rpw.get("a")).toBe(S(75));
    expect(rpw.get("b")).toBe(S(80));
    expect(rpw.get("c")).toBe(S(55));
    expect(rpw.get("d")).toBe(S(65));
    expect(rpw.get("e")).toBe(S(30));
  });
  test("تخصیص RPW = همان S1={a,b,c} · S2={d} · S3={e}", () => {
    const sol = solveBalance(P1, { algorithm: "rpw" });
    expect(sol.assignments).toEqual({ b: 1, a: 1, c: 1, d: 2, e: 3 });
    expect(sol.metrics.stationCount).toBe(3);
    expect(sol.metrics.efficiencyPct!).toBeCloseTo((125 / 180) * 100, 6);
  });
});

describe("مثال مرجع ۱ — Kilbridge–Wester", () => {
  test("ستون‌ها: col0={a,b} · col1={c,d} · col2={e}", () => {
    const g = checkPrecedenceGraph(EX1);
    expect(g.ok).toBe(true);
    expect(g.columns).toEqual({ a: 0, b: 0, c: 1, d: 1, e: 2 });
  });
  test("تخصیص KW = همان ترکیب سه ایستگاه", () => {
    const sol = solveBalance(P1, { algorithm: "kilbridge-wester" });
    expect(sol.assignments).toEqual({ a: 1, b: 1, c: 1, d: 2, e: 3 });
    expect(sol.metrics.stationCount).toBe(3);
  });
});

// ─────────────────────── مثال مرجع ۲ — تمایز الگوریتم‌ها ───────────────────────

const EX2 = [act("a", 10), act("b", 40, ["a"]), act("c", 30), act("d", 20, ["c"])];
const P2 = problem(EX2, 50);

describe("مثال مرجع ۲ — LCR مقدم بر RPW (تاکت ۵۰ث)", () => {
  test("LCR: S1={c,d}=50 · S2={a,b}=50 · E=100٪ (بالانس کامل)", () => {
    const sol = solveBalance(P2, { algorithm: "lcr" });
    expect(sol.assignments).toEqual({ c: 1, d: 1, a: 2, b: 2 });
    expect(sol.metrics.stationCount).toBe(2);
    expect(sol.metrics.efficiencyPct!).toBeCloseTo(100, 6);
    expect(sol.metrics.delayPct!).toBeCloseTo(0, 6);
    expect(sol.metrics.minStationsTheoretical).toBe(2);
  });
  test("RPW: S1={a,c}=40 · S2={b}=40 · S3={d}=20 · m=3 · E=83.333٪", () => {
    const sol = solveBalance(P2, { algorithm: "rpw" });
    expect(sol.assignments).toEqual({ a: 1, c: 1, b: 2, d: 3 });
    expect(sol.metrics.stationCount).toBe(3);
    expect(sol.metrics.bottleneckMs).toBe(S(40));
    expect(sol.metrics.efficiencyPct!).toBeCloseTo((100 / 120) * 100, 6);
  });
  test("KW: S1={a,c} · S2={b} · S3={d} — m=3", () => {
    const sol = solveBalance(P2, { algorithm: "kilbridge-wester" });
    expect(sol.assignments).toEqual({ c: 1, a: 1, b: 2, d: 3 });
    expect(sol.metrics.stationCount).toBe(3);
  });
});

// ─────────────────────── بند ۷ — تفکیک کار ماشین/اپراتور/هم‌پوشان ───────────────────────

describe("تفکیک نیروی کار و بار ماشین (بند ۷)", () => {
  test("زمان machineAuto به کار اپراتور جمع نمی‌شود", () => {
    const acts = [act("m1", 30, [], "machineAuto"), act("op1", 20, [], "operatorManual")];
    const st = stationLoad(1, ["m1", "op1"], new Map(acts.map((a) => [a.id, a])), S(25));
    expect(st.machineMs).toBe(S(30));
    expect(st.operatorMs).toBe(S(20));
    expect(st.serialMs).toBe(S(50)); // اشغال ایستگاه = ۵۰ (سریال) — جدا از کار اپراتور
  });
  test("نیروی نظری از زمان اپراتور محاسبه می‌شود نه سریال کل", () => {
    // ΣT_operator=20ث · ΣT_serial=50ث · تاکت=25ث → نظری=ceil(20/25)=1 (نه 2)
    const acts = [act("m1", 30, [], "machineAuto"), act("op1", 20, [], "operatorManual")];
    const m = computeMetrics(
      [stationLoad(1, ["m1", "op1"], new Map(acts.map((a) => [a.id, a])), S(25))],
      problem(acts, 25),
      { m1: 1, op1: 1 },
    );
    expect(m.theoreticalOperators).toBe(1);
    expect(m.minStationsTheoretical).toBe(2); // کران ایستگاه از سریال کل
  });
  test("فعالیت هم‌پوشان به بار سریال جمع نمی‌شود — گزارش جدا", () => {
    const acts = [act("ov1", 25, [], "overlap"), act("op1", 20, [], "operatorManual")];
    const st = stationLoad(1, ["ov1", "op1"], new Map(acts.map((a) => [a.id, a])), S(60));
    expect(st.serialMs).toBe(S(20));
    expect(st.overlapMs).toBe(S(25));
    expect(st.operatorMs).toBe(S(20));
    expect(st.idleMs).toBe(S(40)); // 60 − 20 (بدون هم‌پوشان)
  });
  test("اشتغال اپراتور = ΣT اپراتور ÷ (m × تاکت)", () => {
    const acts = [act("op1", 20, [], "operatorManual"), act("op2", 30, [], "operatorManual")];
    const m = computeMetrics(
      [stationLoad(1, ["op1"], new Map(acts.map((a) => [a.id, a])), S(30)), stationLoad(2, ["op2"], new Map(acts.map((a) => [a.id, a])), S(30))],
      problem(acts, 30),
      { op1: 1, op2: 2 },
    );
    expect(m.operatorUtilizationPct!).toBeCloseTo((50 / 60) * 100, 6);
  });
});

// ─────────────────────── گراف تقدم (بند ۲) ───────────────────────

describe("گراف تقدم — چرخه/تناقض/اتصال نامعتبر/غیرقابل دستیابی", () => {
  test("گراف سالم: ستون‌ها و ترتیب توپولوژیک", () => {
    const g = checkPrecedenceGraph(EX1);
    expect(g.ok).toBe(true);
    expect(g.topologicalOrder).toEqual(["a", "b", "c", "d", "e"]);
  });
  test("چرخه a→b→c→a شناسایی و مسیر گزارش می‌شود", () => {
    const cyc = [act("a", 10, ["c"]), act("b", 10, ["a"]), act("c", 10, ["b"])];
    const g = checkPrecedenceGraph(cyc);
    expect(g.ok).toBe(false);
    expect(g.cycles.length).toBe(1);
    const c = g.cycles[0]!;
    expect(c[0]).toBe(c[c.length - 1]); // بسته
    expect(new Set(c.slice(0, -1))).toEqual(new Set(["a", "b", "c"]));
  });
  test("فعالیت وابسته به چرخه = غیرقابل دستیابی", () => {
    const cyc = [act("a", 10, ["c"]), act("b", 10, ["a"]), act("c", 10, ["b"]), act("x", 10, ["a"])];
    const g = checkPrecedenceGraph(cyc);
    expect(g.unschedulable).toContain("x");
    expect(g.unschedulable).toContain("a");
    expect(g.unschedulable).toContain("b");
    expect(g.unschedulable).toContain("c");
  });
  test("اتصال نامعتبر: ارجاع به فعالیت ناموجود", () => {
    const g = checkPrecedenceGraph([act("a", 10, ["ghost"])]);
    expect(g.ok).toBe(false);
    expect(g.unknownRefs).toEqual([{ from: "a", ref: "ghost" }]);
  });
  test("خودارجاعی و تکرار پیش‌نیاز (تناقض)", () => {
    const g1 = checkPrecedenceGraph([act("a", 10, ["a"])]);
    expect(g1.selfRefs).toEqual(["a"]);
    const g2 = checkPrecedenceGraph([act("a", 10, ["b", "b"]), act("b", 5)]);
    expect(g2.duplicateRefs).toEqual([{ from: "a", ref: "b" }]);
  });
  test("الگوریتم روی گراف ناسالم راهکار خالی + پیام صادقانه", () => {
    const cyc = [act("a", 10, ["c"]), act("b", 10, ["a"]), act("c", 10, ["b"])];
    const sol = solveBalance(problem(cyc, 30), { algorithm: "lcr" });
    expect(Object.keys(sol.assignments)).toHaveLength(0);
    expect(sol.status).toBe("infeasible-flagged");
  });
});

// ─────────────────────── اعتبارسنجی تخصیص دستی (بند ۹/۱۰) ───────────────────────

describe("اعتبارسنجی تخصیص — قیود سخت/نرم", () => {
  test("نقض تقدم = قید سخت با دلیل فارسی (c در ایستگاه ۱ ولی پیش‌نیاز a در ایستگاه ۲)", () => {
    const { violations } = validateAssignment(P1, { a: 2, b: 1, c: 1, d: 2, e: 3 });
    const prec = violations.filter((v) => v.code === "precedence");
    expect(prec.length).toBeGreaterThan(0);
    expect(prec[0]!.messageFa).toContain("نقض تقدم");
  });
  test("اضافه‌بار ظرفیت = قید نرم (solved-with-flags نه infeasible)", () => {
    const sol = solveBalance(P1, { algorithm: "manual", assignment: { a: 1, b: 1, c: 1, d: 1, e: 1 } });
    expect(sol.violations.some((v) => v.code === "capacity")).toBe(true);
    expect(sol.status).toBe("solved-with-flags");
  });
  test("فعالیت بدون تخصیص = missing-activity", () => {
    const { violations } = validateAssignment(P1, { a: 1, b: 1, c: 2, d: 2 });
    expect(violations.some((v) => v.code === "missing-activity" && v.activityId === "e")).toBe(true);
  });
  test("فعالیت ناموجود در مسئله = unknown-activity", () => {
    const { violations } = validateAssignment(P1, { a: 1, b: 1, c: 2, d: 2, e: 3, ghost: 1 });
    expect(violations.some((v) => v.code === "unknown-activity" && v.activityId === "ghost")).toBe(true);
  });
  test("ناسازگاری دو فعالیت در یک ایستگاه = قید سخت", () => {
    const acts = [act("x", 10, [], "operatorManual"), act("y", 10, [], "operatorManual")];
    acts[0].incompatibleWith = ["y"];
    const p = problem(acts, 60);
    const sol = solveBalance(p, { algorithm: "manual", assignment: { x: 1, y: 1 } });
    expect(sol.violations.some((v) => v.code === "incompatible")).toBe(true);
    expect(sol.status).toBe("infeasible-flagged");
    // خود الگوریتم‌ها ناسازگاری را رعایت می‌کنند (R6-1)
    const auto = solveBalance(p, { algorithm: "lcr" });
    expect(auto.assignments.x).not.toBe(auto.assignments.y);
    expect(auto.violations.filter((v) => v.code === "incompatible")).toHaveLength(0);
  });
  test("فعالیت تکی بزرگ‌تر از تاکت = پرچم task-exceeds-takt", () => {
    const p = problem([act("big", 90), act("small", 10)], 60);
    const sol = solveBalance(p, { algorithm: "lcr" });
    expect(sol.violations.some((v) => v.code === "task-exceeds-takt" && v.activityId === "big")).toBe(true);
    expect(sol.violations.some((v) => v.code === "capacity")).toBe(true);
  });
});

// ─────────────────────── فعالیت بدون زمان (صداقت) ───────────────────────

describe("فعالیت بدون زمان معتبر — از تخصیص کنار گذاشته می‌شود", () => {
  test("missing هرگز عدد جعلی نمی‌گیرد و در یادداشت گزارش می‌شود", () => {
    const noTime = act("nt", 0);
    noTime.timeStatus = "missing";
    const p = problem([act("a", 20), noTime], 60);
    const sol = solveBalance(p, { algorithm: "lcr" });
    expect(sol.assignments.nt).toBeUndefined();
    expect(sol.notesFa.some((n) => n.includes("nt"))).toBe(true);
  });
});

// ─────────────────────── تابع هدف و تغییر نسبت به مرجع ───────────────────────

describe("تابع هدف وزنی و مرجع (بند ۵)", () => {
  test("changesVsReference = تعداد جابه‌جایی", () => {
    const p = problem(EX1, 60, { referenceAssignment: { a: 1, b: 1, c: 2, d: 2, e: 3 } });
    const sol = solveBalance(p, { algorithm: "manual", assignment: { a: 1, b: 2, c: 2, d: 2, e: 3 } });
    expect(sol.metrics.changesVsReference).toBe(1);
  });
  test("objectiveValue غیر-null با وزن مثبت و null با وزن صفر", () => {
    const sol = solveBalance(P1, { algorithm: "lcr" });
    expect(sol.metrics.objectiveValue).not.toBeNull();
    const p0 = problem(EX1, 60, { objectives: { minimizeStations: 0, smoothLoad: 0, minChanges: 0 } });
    const sol0 = solveBalance(p0, { algorithm: "lcr" });
    expect(sol0.metrics.objectiveValue).toBeNull();
  });
  test("راهکار LCR مثال ۲ (m=mMin=2, σ=0) هدف بهتری از RPW (m=3) دارد", () => {
    const lcr = solveBalance(P2, { algorithm: "lcr" });
    const rpw = solveBalance(P2, { algorithm: "rpw" });
    expect(lcr.metrics.objectiveValue!).toBeLessThan(rpw.metrics.objectiveValue! + EPS);
  });
});

// ─────────────────────── قطعیت و رجیستری ───────────────────────

describe("قطعیت و رجیستری الگوریتم‌ها", () => {
  test("اجرای مکرر = نتیجه یکسان (قطعی)", () => {
    const s1 = solveBalance(P1, { algorithm: "rpw" });
    const s2 = solveBalance(P1, { algorithm: "rpw" });
    expect(s2.assignments).toEqual(s1.assignments);
    expect(s2.metrics.objectiveValue).toBe(s1.metrics.objectiveValue);
  });
  test("نسخه/برچسب/یادداشت صداقت هر الگوریتم", () => {
    for (const algo of ["lcr", "rpw", "kilbridge-wester"] as const) {
      const sol = solveBalance(P1, { algorithm: algo });
      expect(sol.algorithm).toBe(algo);
      expect(sol.algorithmVersion).toBe("1.0.0");
      expect(sol.notesFa.some((n) => n.includes("بهترین راهکار یافت‌شده"))).toBe(true);
    }
  });
  test("buildStations ایستگاه خالی نمی‌سازد و شماره‌ها فشرده ۱-مبنا هستند", () => {
    const stations = buildStations({ a: 3, b: 1 }, P1);
    expect(stations.map((st) => st.station)).toEqual([1, 2]);
    expect(stations[0]!.activityIds).toEqual(["b"]);
    expect(stations[1]!.activityIds).toEqual(["a"]);
  });
});
