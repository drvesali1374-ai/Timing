/**
 * شاخص‌های بالانس (بند ۶ فاز ۶) — هسته خالص با فرمول/مخرج مستند.
 *
 * مدل بار (بند ۷ — نیروی کار جدا از بار ماشین):
 *  - کار اپراتور: operatorManual | inspection | transport | setupChangeover
 *  - بار ماشین: machineAuto (هرگز به کار اپراتور جمع نمی‌شود)
 *  - انتظار: waiting (اشغال ایستگاه بدون کار اپراتور/ماشین)
 *  - هم‌پوشان: overlap — به بار سریال جمع نمی‌شود (فرض هم‌زمانی؛ گزارش جدا)
 *
 * فرمول‌ها (همه مستند در FORMULA_CATALOG §BAL):
 *  - بار سریال ایستگاه: Serial_s = Σ(دستی + ماشینی + انتظار) فعالیت‌های غیر هم‌پوشان
 *  - بیکاری: Idle_s = Takt − Serial_s
 *  - گلوگاه: C = max_s Serial_s
 *  - راندمان بالانس: E = ΣT_serial ÷ (m × C)  (مخرج: m × بیشینه بار)
 *  - تأخیر بالانس: d = ۱ − E
 *  - حداقل نظری: mMin = ceil(ΣT_serial ÷ Takt) — فرض: بدون تجزیه، فعالیت ≤ تاکت، بدون قیود منطقی
 *  - نیروی نظری هر شیفت: ceil(ΣT_operator ÷ Takt) — «ایستگاه» و «نیروی شیفت» جدا گزارش می‌شوند
 *  - تابع هدف وزنی: w₁·(m÷mMin) + w₂·(σ_serial÷Takt) + w₃·(جابه‌جایی÷N) — کمتر بهتر
 */

import type {
  BalanceActivity,
  BalanceMetrics,
  BalanceProblem,
  ConstraintViolation,
  ObjectiveWeights,
  StationLoad,
} from "./types";

export function isOperatorWork(workType: string): boolean {
  return workType === "operatorManual" || workType === "inspection" || workType === "transport" || workType === "setupChangeover";
}

export function isSerialWork(workType: string): boolean {
  return workType !== "overlap";
}

/** تجمیع بار یک ایستگاه از فعالیت‌های تخصیص‌یافته. */
export function stationLoad(
  station: number,
  activityIds: readonly string[],
  byId: ReadonlyMap<string, BalanceActivity>,
  taktMs: number,
): StationLoad {
  let operatorMs = 0;
  let machineMs = 0;
  let waitMs = 0;
  let overlapMs = 0;
  const resolved: string[] = [];
  for (const id of activityIds) {
    const a = byId.get(id);
    if (!a) continue;
    resolved.push(id);
    if (a.workType === "overlap") {
      overlapMs += a.timeMs;
    } else {
      if (isOperatorWork(a.workType)) operatorMs += a.timeMs;
      else if (a.workType === "machineAuto") machineMs += a.timeMs;
      else if (a.workType === "waiting") waitMs += a.timeMs;
      else operatorMs += a.timeMs; // پیش‌فرط محافظه‌کارانه برای انواع آینده
    }
  }
  const serialMs = operatorMs + machineMs + waitMs;
  return {
    station,
    activityIds: resolved,
    operatorMs,
    machineMs,
    waitMs,
    serialMs,
    overlapMs,
    idleMs: taktMs - serialMs,
    loadPctOfTakt: taktMs > 0 ? (serialMs / taktMs) * 100 : 0,
    operatorLoadPct: taktMs > 0 ? (operatorMs / taktMs) * 100 : 0,
  };
}

/** ساخت ایستگاه‌ها از روی نگاشت تخصیص (فشرده: بدون ایستگاه خالی میانی). */
export function buildStations(
  assignments: Readonly<Record<string, number>>,
  problem: BalanceProblem,
): StationLoad[] {
  const byId = new Map(problem.activities.map((a) => [a.id, a]));
  const groups = new Map<number, string[]>();
  for (const [activityId, station] of Object.entries(assignments)) {
    if (!groups.has(station)) groups.set(station, []);
    groups.get(station)!.push(activityId);
  }
  const stations = [...groups.keys()]
    .sort((a, b) => a - b)
    .map((station, idx) => stationLoad(idx + 1, groups.get(station) ?? [], byId, problem.taktMs));
  return stations;
}

/** شاخص‌های کامل از روی ایستگاه‌ها + مسئله. */
export function computeMetrics(
  stations: readonly StationLoad[],
  problem: BalanceProblem,
  assignments: Readonly<Record<string, number>>,
): BalanceMetrics {
  const m = stations.length;
  const totalSerialMs = stations.reduce((s, st) => s + st.serialMs, 0);
  const totalOperatorMs = stations.reduce((s, st) => s + st.operatorMs, 0);
  const totalMachineMs = stations.reduce((s, st) => s + st.machineMs, 0);
  const totalWaitMs = stations.reduce((s, st) => s + st.waitMs, 0);
  const totalOverlapMs = stations.reduce((s, st) => s + st.overlapMs, 0);
  const bottleneckMs = stations.length > 0 ? Math.max(...stations.map((st) => st.serialMs)) : 0;
  const takt = problem.taktMs;

  const efficiencyPct = m > 0 && bottleneckMs > 0 ? (totalSerialMs / (m * bottleneckMs)) * 100 : null;
  const delayPct = efficiencyPct !== null ? 100 - efficiencyPct : null;
  const minStationsTheoretical = takt > 0 ? Math.ceil(totalSerialMs / takt) : null;
  const totalIdleMs = stations.reduce((s, st) => s + st.idleMs, 0);
  const theoreticalOperators = takt > 0 ? Math.ceil(totalOperatorMs / takt) : null;
  const operationalOperators = m; // فرض: ۱ اپراتور در هر ایستگاه — جدا از «نیروی نظری»
  const operatorUtilizationPct = m > 0 && takt > 0 ? (totalOperatorMs / (m * takt)) * 100 : null;

  // تغییر نسبت به مرجع
  let changesVsReference: number | null = null;
  if (problem.referenceAssignment) {
    let changed = 0;
    for (const [activityId, station] of Object.entries(assignments)) {
      const ref = problem.referenceAssignment[activityId];
      if (ref !== undefined && ref !== station) changed += 1;
    }
    changesVsReference = changed;
  }

  const objectiveValue = computeObjective(stations, problem, assignments, {
    totalSerialMs,
    minStationsTheoretical,
    changesVsReference,
  });

  return {
    stationCount: m,
    totalSerialMs,
    totalOperatorMs,
    totalMachineMs,
    totalWaitMs,
    totalOverlapMs,
    bottleneckMs,
    efficiencyPct,
    delayPct,
    minStationsTheoretical,
    totalIdleMs,
    idlePerStationMs: stations.map((st) => st.idleMs),
    theoreticalOperators,
    operationalOperators,
    operatorUtilizationPct,
    changesVsReference,
    objectiveValue,
  };
}

/**
 * تابع هدف وزنی — کمتر بهتر. نرمال‌سازی‌ها (مستند):
 *  - ایستگاه: m ÷ max(mMin, ۱) — نسبت به کران پایین نظری
 *  - یکنواختی: انحراف معیار بار سریال ÷ تاکت (بی‌بعد)
 *  - تغییر: تعداد جابه‌جایی ÷ تعداد فعالیت‌های دارای مرجع (بی‌بعد)
 * بدون مرجع → سهم minChanges صفر و وزن آن بازتوزیع نمی‌شود (شفافیت ساده).
 */
export function computeObjective(
  stations: readonly StationLoad[],
  problem: BalanceProblem,
  assignments: Readonly<Record<string, number>>,
  pre: { totalSerialMs: number; minStationsTheoretical: number | null; changesVsReference: number | null },
): number | null {
  const w: ObjectiveWeights = problem.objectives;
  const sumW = w.minimizeStations + w.smoothLoad + w.minChanges;
  if (sumW <= 0) return null;
  const m = stations.length;
  const mMin = pre.minStationsTheoretical ?? 1;
  const stationsTerm = m / Math.max(mMin, 1);

  const serials = stations.map((st) => st.serialMs);
  let sigma = 0;
  if (serials.length > 1) {
    const mean = serials.reduce((s, x) => s + x, 0) / serials.length;
    const variance = serials.reduce((s, x) => s + (x - mean) ** 2, 0) / (serials.length - 1);
    sigma = Math.sqrt(variance);
  }
  const smoothTerm = problem.taktMs > 0 ? sigma / problem.taktMs : 0;

  let changesTerm = 0;
  if (problem.referenceAssignment && pre.changesVsReference !== null) {
    const withRef = Object.keys(assignments).filter((id) => problem.referenceAssignment![id] !== undefined).length;
    changesTerm = withRef > 0 ? pre.changesVsReference / withRef : 0;
  }

  return (w.minimizeStations * stationsTerm + w.smoothLoad * smoothTerm + w.minChanges * changesTerm) / sumW;
}

// ─────────────────────── اعتبارسنجی قیود (بند ۹/۱۰) ───────────────────────

/**
 * اعتبارسنجی کامل یک تخصیص (خروجی الگوریتم یا دستی).
 * قید سخت (precedence/unknown/duplicate/missing) و قید نرم (capacity/station-count)
 * هر دو گزارش می‌شوند؛ قید نرم = پرچم صادقانه (نه رد بی‌صدا).
 */
export function validateAssignment(
  problem: BalanceProblem,
  assignments: Readonly<Record<string, number>>,
): { violations: ConstraintViolation[]; respectedCount: number } {
  const byId = new Map(problem.activities.filter((a) => a.timeStatus === "valid").map((a) => [a.id, a]));
  const violations: ConstraintViolation[] = [];
  let respectedCount = 0;

  // فعالیت ناموجود در مسئله
  for (const id of Object.keys(assignments)) {
    if (!byId.has(id)) {
      violations.push({
        code: "unknown-activity",
        activityId: id,
        messageFa: `فعالیت «${id}» در مسئله بالانس (فعال/دارای زمان معتبر) موجود نیست.`,
      });
    }
  }

  // فعالیت معتبر بدون تخصیص
  for (const a of byId.values()) {
    if (assignments[a.id] === undefined) {
      violations.push({
        code: "missing-activity",
        activityId: a.id,
        messageFa: `فعالیت «${a.id}» (${a.name}) تخصیص ندارد.`,
      });
    }
  }

  // ایستگاه غیرصحیح
  for (const [id, station] of Object.entries(assignments)) {
    if (!Number.isInteger(station) || station < 1) {
      violations.push({
        code: "unknown-activity",
        activityId: id,
        station,
        messageFa: `ایستگاه تخصیصی برای «${id}» باید عدد صحیح ≥ ۱ باشد.`,
      });
    }
  }

  // تقدم: ایستگاه پیش‌نیاز ≤ ایستگاه جانشین (SALB کلاسیک)
  for (const a of byId.values()) {
    const st = assignments[a.id];
    if (st === undefined) continue;
    for (const p of a.predecessors) {
      const pred = byId.get(p);
      if (!pred) continue; // ارجاع نامعتبر در گراف — جداگانه گزارش شده
      const predSt = assignments[p];
      if (predSt !== undefined) {
        if (predSt > st) {
          violations.push({
            code: "precedence",
            activityId: a.id,
            station: st,
            messageFa: `نقض تقدم: «${p}» (ایستگاه ${predSt}) باید در ایستگاه ${st} یا قبل‌تر از «${a.id}» باشد.`,
          });
        } else {
          respectedCount += 1;
        }
      }
    }
  }

  // ناسازگاری + ظرفیت
  const stations = buildStations(
    Object.fromEntries(Object.entries(assignments).filter(([id]) => byId.has(id))),
    problem,
  );
  const stationById = new Map(stations.map((st) => [st.station, st]));
  for (const a of byId.values()) {
    const st = assignments[a.id];
    if (st === undefined) continue;
    for (const other of a.incompatibleWith) {
      if (byId.has(other) && assignments[other] === st) {
        violations.push({
          code: "incompatible",
          activityId: a.id,
          station: st,
          messageFa: `ناسازگاری وظایف: «${a.id}» و «${other}» هر دو در ایستگاه ${st} هستند.`,
        });
      } else {
        respectedCount += 1;
      }
    }
  }
  for (const st of stations) {
    if (st.serialMs > problem.taktMs) {
      violations.push({
        code: "capacity",
        station: st.station,
        messageFa: `اضافه‌بار ایستگاه ${st.station}: بار سریال ${Math.round(st.serialMs)}ms از تاکت ${Math.round(problem.taktMs)}ms بیشتر است.`,
      });
    } else {
      respectedCount += 1;
    }
  }

  // فعالیت تکی بزرگ‌تر از تاکت
  for (const a of byId.values()) {
    if (isSerialWork(a.workType) && a.timeMs > problem.taktMs) {
      violations.push({
        code: "task-exceeds-takt",
        activityId: a.id,
        messageFa: `زمان فعالیت «${a.id}» (${Math.round(a.timeMs)}ms) از تاکت (${Math.round(problem.taktMs)}ms) بیشتر است — تقسیم/بازنگری فعالیت لازم است.`,
      });
    }
  }

  // سقف ایستگاه
  if (problem.maxStations !== null && stations.length > problem.maxStations) {
    violations.push({
      code: "station-count",
      messageFa: `تعداد ایستگاه ${stations.length} از سقف ${problem.maxStations} بیشتر است.`,
    });
  } else if (problem.maxStations !== null) {
    respectedCount += 1;
  }

  return { violations, respectedCount };
}
