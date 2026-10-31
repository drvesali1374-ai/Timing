/**
 * آزمون‌های واحد هسته خالص زمان‌سنجی (فاز ۴) — بدون مرورگر، با ManualClock قطعی.
 * پوشش: موتور (ماشین حالت/monotonic/مکث/ادامه/اصلاح/بازیابی/idempotency)
 *       + مشتق‌سازی (TS-003/004/005 + snapback/laps + وقفه + پرچم‌ها)
 *       + ساعت (خواب/بازگشت دید) + قالب‌بندی.
 */

import { describe, expect, test } from "bun:test";
import { ManualClock, detectSleep, visibilityReturnFlag } from "./clock";
import { ChronoEngine } from "./engine";
import { deriveSession, dedupeAndSort, correctableEvents } from "./derive";
import { formatDurationMs, formatShortMs, type ChronoEvent, type TimingElementRef } from "./types";

// ─────────────────────── ابزار مشترک ───────────────────────

let idCounter = 0;
function seqIdGen(): string {
  idCounter += 1;
  return `e${String(idCounter).padStart(4, "0")}`;
}

const ELEMENTS: TimingElementRef[] = [
  { key: "a1", name: "قرار دادن قطعه", activityStableKey: "act-1", order: 1 },
  { key: "a2", name: "پرس", activityStableKey: "act-2", order: 2 },
  { key: "a3", name: "بازرسی", activityStableKey: "act-3", order: 3 },
];

function makeEngine(method: "continuous" | "snapback" | "laps" = "continuous", elements = ELEMENTS) {
  const clock = new ManualClock(0, 1_700_000_000_000);
  const engine = new ChronoEngine({ clock, sessionId: "s1", method, elements, idGen: seqIdGen });
  return { clock, engine };
}

// ─────────────────────── موتور: پایه ───────────────────────

describe("ChronoEngine — پایه", () => {
  test("شروع → قرائت‌ها → توقف؛ مقادیر monotonic درست", () => {
    const { clock, engine } = makeEngine();
    engine.start();
    clock.advance(1_000);
    engine.cycleStart();
    clock.advance(2_500);
    const r1 = engine.recordReading("a1");
    expect(r1.elapsedActiveMs).toBe(3_500);
    expect(r1.splitMs).toBe(2_500);
    clock.advance(1_500);
    const r2 = engine.recordReading("a2");
    expect(r2.elapsedActiveMs).toBe(5_000);
    expect(r2.splitMs).toBe(1_500);
    clock.advance(1_000);
    const stop = engine.stop();
    expect(stop.elapsedActiveMs).toBe(6_000);
    expect(engine.state().phase).toBe("stopped");
  });

  test("مکث/ادامه — زمان مکث جزو زمان فعال نیست", () => {
    const { clock, engine } = makeEngine();
    engine.start();
    clock.advance(1_000);
    engine.pause("خرابی فیکسچر");
    clock.advance(60_000); // یک دقیقه مکث
    expect(engine.elapsedActiveMs()).toBe(1_000); // کرنومتر ایستاده
    engine.resume();
    clock.advance(2_000);
    expect(engine.elapsedActiveMs()).toBe(3_000);
    const ev = engine.recordReading("a1");
    expect(ev.elapsedActiveMs).toBe(3_000);
  });

  test("قرائت r۰ چرخه splitMs=۰ دارد (مبنای تفکیک)", () => {
    const { clock, engine } = makeEngine();
    engine.start();
    clock.advance(500);
    const c = engine.cycleStart();
    expect(c.splitMs).toBe(0);
    expect(c.cycleNo).toBe(1);
  });

  test("عملیات در فاز نادرست رد می‌شود", () => {
    const { engine } = makeEngine();
    expect(() => engine.recordReading()).toThrow();
    engine.start();
    expect(() => engine.start()).toThrow();
    expect(() => engine.resume()).toThrow();
    engine.pause();
    expect(() => engine.pause()).toThrow();
    engine.resume();
    engine.stop();
    expect(() => engine.stop()).toThrow();
    expect(() => engine.recordReading()).toThrow();
  });

  test("شناسه‌ها یکتا و seq اکیداً صعودی", () => {
    const { clock, engine } = makeEngine();
    engine.start();
    engine.cycleStart();
    clock.advance(100);
    engine.recordReading("a1");
    clock.advance(100);
    engine.recordReading("a2");
    const events = engine.events();
    const ids = new Set(events.map((e) => e.clientEventId));
    expect(ids.size).toBe(events.length);
    for (let i = 1; i < events.length; i += 1) {
      expect(events[i].seq).toBeGreaterThan(events[i - 1].seq);
    }
  });

  test("wallClock از ساعت دیواری ثبت می‌شود (ممیزی — جدا از perf)", () => {
    const { clock, engine } = makeEngine();
    engine.start();
    clock.advance(100);
    const ev = engine.recordReading("a1");
    expect(ev.wallClock).toBe(new Date(1_700_000_000_100).toISOString());
    expect(ev.elapsedActiveMs).toBe(100);
  });
});

// ─────────────────────── موتور: اشاره‌گر عنصر (پیش‌روی خودکار) ───────────────────────

describe("ChronoEngine — اشاره‌گر عنصر", () => {
  test("ثبت بدون عنصر صریح از اشاره‌گر استفاده و پیش می‌رود", () => {
    const { engine } = makeEngine();
    engine.start();
    engine.cycleStart();
    expect(engine.state().currentElementKey).toBe("a1");
    engine.recordReading();
    expect(engine.state().currentElementKey).toBe("a2");
    engine.recordReading();
    expect(engine.state().currentElementKey).toBe("a3");
    engine.recordReading();
    expect(engine.state().currentElementKey).toBe("a3"); // مهار در آخرین عنصر
  });

  test("شروع چرخه اشاره‌گر را صفر می‌کند", () => {
    const { engine } = makeEngine();
    engine.start();
    engine.cycleStart();
    engine.recordReading();
    engine.recordReading();
    expect(engine.state().currentElementKey).toBe("a3");
    engine.cycleStart();
    expect(engine.state().currentElementKey).toBe("a1");
    expect(engine.state().cycleNo).toBe(2);
  });

  test("عنصر صریح ناموجود نادیده گرفته می‌شود (بدون خطا)", () => {
    const { engine } = makeEngine();
    engine.start();
    engine.cycleStart();
    const ev = engine.recordReading("نا موجود");
    expect(ev.elementId).toBeUndefined();
  });
});

// ─────────────────────── موتور: snapback و laps ───────────────────────

describe("ChronoEngine — snapback / laps", () => {
  test("snapback: splitMs هر عنصر = مدت مستقیم از مرز قبلی", () => {
    const { clock, engine } = makeEngine("snapback");
    engine.start();
    engine.cycleStart();
    clock.advance(1_200);
    const e1 = engine.recordElement("a1");
    expect(e1.splitMs).toBe(1_200);
    clock.advance(800);
    const e2 = engine.recordElement("a2");
    expect(e2.splitMs).toBe(800);
    expect(e2.elapsedActiveMs).toBe(2_000);
  });

  test("laps: ثبت حلقه بدون پیش‌روی عنصر", () => {
    const { clock, engine } = makeEngine("laps");
    engine.start();
    engine.cycleStart();
    clock.advance(1_000);
    const l1 = engine.lap();
    expect(l1.splitMs).toBe(1_000);
    expect(l1.elementId).toBeUndefined();
    clock.advance(500);
    const l2 = engine.lap();
    expect(l2.splitMs).toBe(500);
    expect(engine.state().currentElementKey).toBe("a1");
  });
});

// ─────────────────────── موتور: یادداشت و وقفه ───────────────────────

describe("ChronoEngine — یادداشت/وقفه/اصلاح", () => {
  test("یادداشت سریع ثبت می‌شود بدون تغییر زمان", () => {
    const { clock, engine } = makeEngine();
    engine.start();
    clock.advance(1_000);
    const n = engine.note("اپراتور ۲ جایگزین شد");
    expect(n.type).toBe("note");
    expect(n.note).toBe("اپراتور ۲ جایگزین شد");
    expect(n.elapsedActiveMs).toBe(1_000);
    expect(() => engine.note("   ")).toThrow();
  });

  test("مکث با علت وقفه ثبت می‌شود", () => {
    const { engine } = makeEngine();
    engine.start();
    const p = engine.pause("کمبود قطعه");
    expect(p.type).toBe("pause");
    expect(p.interruptionReason).toBe("کمبود قطعه");
  });

  test("اصلاح = رویداد جدید با ارجاع؛ رویداد اصلی حذف نمی‌شود", () => {
    const { clock, engine } = makeEngine();
    engine.start();
    engine.cycleStart();
    clock.advance(2_000);
    const r = engine.recordReading("a1");
    const before = engine.events().length;
    const c = engine.correct(r.clientEventId, 2_150, "قرائت دیرهنگام — اصلاح ناظر");
    expect(c.type).toBe("correction");
    expect(c.correctionOf).toBe(r.clientEventId);
    expect(c.correctedValueMs).toBe(2_150);
    expect(c.correctionReason).toContain("ناظر");
    expect(engine.events().length).toBe(before + 1);
    expect(engine.events().some((e) => e.clientEventId === r.clientEventId)).toBe(true);
  });

  test("اصلاح بدون دلیل یا مقدار منفی رد می‌شود", () => {
    const { clock, engine } = makeEngine();
    engine.start();
    engine.cycleStart();
    const r = engine.recordReading("a1");
    expect(() => engine.correct(r.clientEventId, 100, "  ")).toThrow();
    expect(() => engine.correct(r.clientEventId, -5, "دلیل")).toThrow();
    expect(() => engine.correct("غایب", 100, "دلیل")).toThrow();
  });

  test("اصلاح رویداد غیرقابل‌اصلاح (pause) رد می‌شود", () => {
    const { engine } = makeEngine();
    engine.start();
    const p = engine.pause();
    expect(() => engine.correct(p.clientEventId, 100, "دلیل")).toThrow();
  });
});

// ─────────────────────── موتور: بازیابی (reload) ───────────────────────

describe("ChronoEngine — بازیابی پس از reload", () => {
  test("بازسازی رویدادها حالت را برمی‌گرداند؛ running نیازمند recover", () => {
    const { clock, engine } = makeEngine();
    engine.start();
    engine.cycleStart();
    clock.advance(3_000);
    engine.recordReading("a1");
    const events = engine.events() as ChronoEvent[];

    const clock2 = new ManualClock(50_000, Date.now()); // مبدأ perf جدید پس از reload
    const rebuilt = ChronoEngine.reconstruct(events, {
      clock: clock2,
      sessionId: "s1",
      method: "continuous",
      elements: ELEMENTS,
      idGen: seqIdGen,
    });
    expect(rebuilt.state().phase).toBe("running");
    expect(rebuilt.state().needsRecovery).toBe(true);
    // زمان زنده جعل نمی‌شود — آخرین قرائت معتبر برمی‌گردد
    expect(rebuilt.elapsedActiveMs()).toBe(3_000);
    clock2.advance(999_999);
    expect(rebuilt.elapsedActiveMs()).toBe(3_000); // همچنان بدون recover
  });

  test("recover() مکث بازیابی‌شده با پرچم clockRecovery صادر می‌کند", () => {
    const { clock, engine } = makeEngine();
    engine.start();
    engine.cycleStart();
    clock.advance(3_000);
    const events = engine.events() as ChronoEvent[];

    const rebuilt = ChronoEngine.reconstruct(events, {
      clock: new ManualClock(0, Date.now()),
      sessionId: "s1",
      method: "continuous",
      elements: ELEMENTS,
      idGen: seqIdGen,
    });
    const ev = rebuilt.recover();
    expect(ev).not.toBeNull();
    expect(ev!.type).toBe("pause");
    expect(ev!.integrity).toContain("clockRecovery");
    expect(rebuilt.state().phase).toBe("paused");
    expect(rebuilt.state().recovered).toBe(true);
    expect(rebuilt.state().needsRecovery).toBe(false);
    // ادامه پس از بازیابی مجاز است — از همین لحظه
    rebuilt.resume();
    expect(rebuilt.state().phase).toBe("running");
  });

  test("بازسازی جلسه مکث‌شده نیازی به recover ندارد", () => {
    const { clock, engine } = makeEngine();
    engine.start();
    clock.advance(2_000);
    engine.pause("استراحت");
    const events = engine.events() as ChronoEvent[];
    const rebuilt = ChronoEngine.reconstruct(events, {
      clock: new ManualClock(0, Date.now()),
      sessionId: "s1",
      method: "continuous",
      elements: ELEMENTS,
      idGen: seqIdGen,
    });
    expect(rebuilt.state().phase).toBe("paused");
    expect(rebuilt.state().needsRecovery).toBe(false);
    expect(rebuilt.recover()).toBeNull();
    expect(rebuilt.elapsedActiveMs()).toBe(2_000);
  });

  test("loadEvents تکراری شناسه را رد می‌کند (idempotency)", () => {
    const { clock, engine } = makeEngine();
    engine.start();
    engine.cycleStart();
    clock.advance(100);
    engine.recordReading("a1");
    const events = [...(engine.events() as ChronoEvent[])];
    const withDup = [...events, { ...events[events.length - 1] }]; // همان شناسه
    const rebuilt = new ChronoEngine({
      clock: new ManualClock(0, Date.now()),
      sessionId: "s1",
      method: "continuous",
      elements: ELEMENTS,
      idGen: seqIdGen,
    });
    rebuilt.loadEvents(withDup);
    expect(rebuilt.events().length).toBe(events.length);
  });

  test("بازسازی seq خارج ترتیب را رد صامت دفاعی می‌کند", () => {
    const { clock, engine } = makeEngine();
    engine.start();
    engine.cycleStart();
    clock.advance(100);
    engine.recordReading("a1");
    clock.advance(100);
    engine.recordReading("a2");
    const events = [...(engine.events() as ChronoEvent[])];
    const shuffled = [events[2], events[0], events[1], events[3]]; // ترتیب خراب
    const rebuilt = new ChronoEngine({
      clock: new ManualClock(0, Date.now()),
      sessionId: "s1",
      method: "continuous",
      elements: ELEMENTS,
      idGen: seqIdGen,
    });
    rebuilt.loadEvents(shuffled);
    // پس از مرتب‌سازی seq، ترتیب درست بازمی‌گردد
    expect(rebuilt.events().map((e) => e.seq)).toEqual([1, 2, 3, 4]);
  });
});

// ─────────────────────── مشتق‌سازی: پیوسته ───────────────────────

describe("deriveSession — پیوسته (TS-003/004/005)", () => {
  function scenario() {
    const { clock, engine } = makeEngine();
    engine.start();
    // چرخه ۱
    engine.cycleStart();
    clock.advance(2_000);
    engine.recordReading("a1");
    clock.advance(1_500);
    engine.recordReading("a2");
    clock.advance(1_000);
    engine.recordReading("a3");
    // چرخه ۲
    engine.cycleStart();
    clock.advance(2_200);
    engine.recordReading("a1");
    clock.advance(1_400);
    engine.recordReading("a2");
    clock.advance(1_100);
    engine.recordReading("a3");
    engine.stop();
    return engine.events() as ChronoEvent[];
  }

  test("تفکیک عناصر از تفاضل قرائت‌ها (TS-003)", () => {
    const s = deriveSession(scenario(), ELEMENTS, { method: "continuous" });
    expect(s.cycles.length).toBe(2);
    const c1 = s.cycles[0];
    expect(c1.elements.map((e) => e.durationMs)).toEqual([2_000, 1_500, 1_000]);
    expect(c1.elementsSumMs).toBe(4_500);
    expect(c1.elements[0].elementName).toBe("قرار دادن قطعه");
  });

  test("زمان چرخه از مرزها (TS-004) + تلورانس سازگار → valid (TS-005)", () => {
    const s = deriveSession(scenario(), ELEMENTS, { method: "continuous" });
    const c1 = s.cycles[0];
    expect(c1.cycleTimeMs).toBe(4_500);
    expect(c1.status).toBe("valid");
    expect(c1.deviationPct).toBe(0);
    const c2 = s.cycles[1];
    expect(c2.cycleTimeMs).toBe(4_700);
    expect(c2.status).toBe("valid");
    expect(s.completedCycles).toBe(2);
  });

  test("قرائت جاافتاده → عنصر با مدت بزرگ؛ ترتیب ناقص گزارش می‌شود", () => {
    const { clock, engine } = makeEngine();
    engine.start();
    engine.cycleStart();
    clock.advance(2_000);
    engine.recordReading("a1");
    clock.advance(6_000); // عنصر a2 قرائت جاافتاده — تفاضل بزرگ به a3
    engine.recordReading("a3");
    engine.cycleStart();
    const s = deriveSession(engine.events() as ChronoEvent[], ELEMENTS, { method: "continuous", tolerancePct: 5 });
    // عناصر: a1=2000، a3=6000 → Σ=8000؛ C=8000 → جمع سازگار اما عنصر جاافتاده در تعداد دیده می‌شود
    const c1 = s.cycles[0];
    expect(c1.elements.length).toBe(2);
    expect(c1.elements[1].durationMs).toBe(6_000);
    expect(c1.status).toBe("valid"); // جمع با چرخه سازگار است
  });

  test("اصلاح مرز چرخه بعدی → ناسازگاری جمع/چرخه → suspect با درصد انحراف", () => {
    const { clock, engine } = makeEngine();
    engine.start();
    engine.cycleStart();
    clock.advance(2_000);
    engine.recordReading("a1");
    clock.advance(1_000);
    engine.recordReading("a2");
    clock.advance(1_000);
    engine.recordReading("a3");
    const c2 = engine.cycleStart(); // مرز پایان چرخه ۱ / شروع چرخه ۲
    clock.advance(3_000);
    engine.recordReading("a1");
    clock.advance(1_000);
    engine.recordReading("a2");
    clock.advance(1_000);
    engine.recordReading("a3");
    engine.stop();
    // اصلاح r0 چرخه ۲: ناظر می‌گوید مرز واقعی ۴۴۰۰ بوده (نه ۴۰۰۰)
    engine.correct(c2.clientEventId, 4_400, "r0 چرخه ۲ دیرتر ثبت شده بود");
    const s = deriveSession(engine.events() as ChronoEvent[], ELEMENTS, { method: "continuous", tolerancePct: 5 });
    const cyc1 = s.cycles[0];
    // Σ عناصر چرخه ۱ = ۴۰۰۰؛ C = ۴۴۰۰−۰ = ۴۴۰۰ → انحراف ~۹٪ > ۵٪ → suspect
    expect(cyc1.cycleTimeMs).toBe(4_400);
    expect(cyc1.elementsSumMs).toBe(4_000);
    expect(cyc1.deviationPct).toBeGreaterThan(9);
    expect(cyc1.deviationPct).toBeLessThan(10);
    expect(cyc1.status).toBe("suspect");
    // چرخه ۲ همچنان سازگار (۴۴۰۰→۷۴۰۰)
    expect(s.cycles[1].status).toBe("valid");
  });

  test("مکث درون چرخه: C بدون مکث و Σ هم بدون مکث → سازگار؛ وقفه گزارش می‌شود", () => {
    const { clock, engine } = makeEngine();
    engine.start();
    engine.cycleStart();
    clock.advance(2_000);
    engine.recordReading("a1");
    engine.pause("خرابی فیکسچر");
    clock.advance(30_000);
    engine.resume();
    clock.advance(1_500);
    engine.recordReading("a2");
    clock.advance(1_000);
    engine.recordReading("a3");
    engine.cycleStart();
    const s = deriveSession(engine.events() as ChronoEvent[], ELEMENTS, { method: "continuous" });
    const c1 = s.cycles[0];
    expect(c1.cycleTimeMs).toBe(4_500); // بدون مکث
    expect(c1.status).toBe("valid");
    expect(c1.interruptions.length).toBe(1);
    expect(c1.interruptions[0].reason).toBe("خرابی فیکسچر");
    expect(c1.interruptions[0].durationMs).toBe(30_000);
    expect(s.pausedMs).toBe(30_000);
    expect(s.activeMs).toBe(4_500);
  });

  test("چرخه باز در پایان جلسه → incomplete", () => {
    const { clock, engine } = makeEngine();
    engine.start();
    engine.cycleStart();
    clock.advance(2_000);
    engine.recordReading("a1");
    const s = deriveSession(engine.events() as ChronoEvent[], ELEMENTS, { method: "continuous" });
    expect(s.cycles.length).toBe(1);
    expect(s.cycles[0].status).toBe("incomplete");
    expect(s.cycles[0].cycleTimeMs).toBeNull();
    expect(s.completedCycles).toBe(0);
  });

  test("توقف وسط چرخه با عناصر ناقص → incomplete", () => {
    const { clock, engine } = makeEngine();
    engine.start();
    engine.cycleStart();
    clock.advance(2_000);
    engine.recordReading("a1");
    clock.advance(1_000);
    engine.recordReading("a2");
    engine.stop();
    const s = deriveSession(engine.events() as ChronoEvent[], ELEMENTS, { method: "continuous" });
    expect(s.cycles[0].status).toBe("incomplete");
    expect(s.phase).toBe("stopped");
  });

  test("چرخه بسته‌شده با توقف بعد از همه عناصر → valid", () => {
    const { clock, engine } = makeEngine();
    engine.start();
    engine.cycleStart();
    clock.advance(2_000);
    engine.recordReading("a1");
    clock.advance(1_000);
    engine.recordReading("a2");
    clock.advance(1_000);
    engine.recordReading("a3");
    engine.stop();
    const s = deriveSession(engine.events() as ChronoEvent[], ELEMENTS, { method: "continuous" });
    expect(s.cycles[0].status).toBe("valid");
    expect(s.cycles[0].endedAtEventId).not.toBeNull();
  });

  test("قطعیت: ورودی یکسان → خروجی یکسان", () => {
    const evs = scenario();
    const a = JSON.stringify(deriveSession(evs, ELEMENTS, { method: "continuous" }));
    const b = JSON.stringify(deriveSession([...evs], ELEMENTS, { method: "continuous" }));
    expect(a).toBe(b);
  });
});

// ─────────────────────── مشتق‌سازی: اصلاح‌ها ───────────────────────

describe("deriveSession — اصلاح‌ها", () => {
  test("آخرین اصلاح برنده؛ ردپای کامل حفظ می‌شود", () => {
    const { clock, engine } = makeEngine();
    engine.start();
    engine.cycleStart();
    clock.advance(2_000);
    const r1 = engine.recordReading("a1");
    clock.advance(1_000);
    const r2 = engine.recordReading("a2");
    engine.correct(r2.clientEventId, 3_200, "قرائت دیر");
    engine.correct(r2.clientEventId, 3_100, "اصلاح نهایی ناظر");
    const s = deriveSession(engine.events() as ChronoEvent[], ELEMENTS, { method: "continuous" });
    const c1 = s.cycles[0];
    expect(c1.elements[0].durationMs).toBe(2_000);
    expect(c1.elements[1].durationMs).toBe(1_100); // آخرین اصلاح: ۳۱۰۰−۲۰۰۰
    expect(c1.elements[1].corrected).toBe(true);
    expect(c1.elements[0].corrected).toBe(false);
    expect(r2.elapsedActiveMs).toBe(3_000); // رویداد اصلی دست‌نخورده — ردپا
  });

  test("اصلاح شروع چرخه (r₀) زمان چرخه را جابه‌جا می‌کند", () => {
    const { clock, engine } = makeEngine();
    engine.start();
    const c1ev = engine.cycleStart();
    clock.advance(2_000);
    engine.recordReading("a1");
    clock.advance(1_000);
    engine.recordReading("a2");
    engine.cycleStart();
    engine.correct(c1ev.clientEventId, 500, "r0 واقعی دیرتر ثبت شده بود");
    const s = deriveSession(engine.events() as ChronoEvent[], ELEMENTS, { method: "continuous" });
    const cyc = s.cycles[0];
    expect(cyc.startedElapsedMs).toBe(500);
    expect(cyc.elements[0].durationMs).toBe(1_500); // 2000-500
    expect(cyc.cycleTimeMs).toBe(2_500);
  });

  test("اصلاح snapback: مقدار جدید = مدت مستقیم عنصر", () => {
    const { clock, engine } = makeEngine("snapback");
    engine.start();
    engine.cycleStart();
    clock.advance(1_200);
    const e1 = engine.recordElement("a1");
    clock.advance(800);
    const e2 = engine.recordElement("a2");
    engine.correct(e1.clientEventId, 1_250, "بازبینی ناظر");
    const s = deriveSession(engine.events() as ChronoEvent[], ELEMENTS, { method: "snapback" });
    const cyc = s.cycles[0];
    expect(cyc.elements[0].durationMs).toBe(1_250);
    expect(cyc.elements[1].durationMs).toBe(800);
    expect(cyc.elements[0].readingMode).toBe("snapback");
  });

  test("فهرست قابل‌اصلاح‌ها فقط قرائت/عنصر/حلقه/شروع چرخه", () => {
    const { clock, engine } = makeEngine();
    engine.start();
    engine.cycleStart();
    clock.advance(100);
    engine.recordReading("a1");
    engine.pause("x");
    engine.resume();
    engine.note("یادداشت");
    const list = correctableEvents(engine.events() as ChronoEvent[]);
    expect(list.map((e) => e.type).sort() as string[]).toEqual(["cycleStart", "reading"].sort());
  });
});

// ─────────────────────── مشتق‌سازی: snapback / laps ───────────────────────

describe("deriveSession — snapback / laps", () => {
  test("snapback: مدت‌های مستقیم + بدون کنترل تلورانس جمع", () => {
    const { clock, engine } = makeEngine("snapback");
    engine.start();
    engine.cycleStart();
    clock.advance(1_200);
    engine.recordElement("a1");
    clock.advance(800);
    engine.recordElement("a2");
    clock.advance(1_000);
    engine.recordElement("a3");
    engine.cycleStart();
    const s = deriveSession(engine.events() as ChronoEvent[], ELEMENTS, { method: "snapback" });
    const c1 = s.cycles[0];
    expect(c1.elements.map((e) => e.durationMs)).toEqual([1_200, 800, 1_000]);
    expect(c1.deviationPct).toBeNull(); // TS-005 فقط پیوسته
    expect(c1.status).toBe("valid");
  });

  test("laps: بازه‌ها از تفاضل نقاط؛ cycleTime از مرزها", () => {
    const { clock, engine } = makeEngine("laps");
    engine.start();
    engine.cycleStart();
    clock.advance(1_000);
    engine.lap();
    clock.advance(1_500);
    engine.lap();
    clock.advance(2_500);
    engine.lap();
    engine.cycleStart();
    const s = deriveSession(engine.events() as ChronoEvent[], ELEMENTS, { method: "laps" });
    const c1 = s.cycles[0];
    expect(c1.elements.map((e) => e.durationMs)).toEqual([1_000, 1_500, 2_500]);
    expect(c1.cycleTimeMs).toBe(5_000);
    expect(c1.status).toBe("valid");
  });
});

// ─────────────────────── مشتق‌سازی: وقفه/پرچم/بازیابی ───────────────────────

describe("deriveSession — وقفه و پرچم‌های یکپارچگی", () => {
  test("وقفه باز (مکث بدون ادامه) → مدت نامشخص", () => {
    const { clock, engine } = makeEngine();
    engine.start();
    engine.cycleStart();
    clock.advance(1_000);
    engine.recordReading("a1");
    engine.pause("کمبود قطعه");
    const s = deriveSession(engine.events() as ChronoEvent[], ELEMENTS, { method: "continuous" });
    const it = s.interruptions[0];
    expect(it.resumeEventId).toBeNull();
    expect(it.durationMs).toBeNull();
    expect(s.pausedMs).toBeNull(); // حداقل یک جزء نامشخص
  });

  test("وقفه بازیابی‌شده (پرچم clockRecovery) → durationUnknown", () => {
    const { clock, engine } = makeEngine();
    engine.start();
    engine.cycleStart();
    clock.advance(1_000);
    engine.recordReading("a1");
    engine.pause("وقفه عادی");
    clock.advance(5_000);
    engine.resume();
    const events = [...(engine.events() as ChronoEvent[])];
    // شبیه‌سازی recovery: مکث بازیابی با پرچم
    const rebuilt = ChronoEngine.reconstruct(events, {
      clock: new ManualClock(0, Date.now()),
      sessionId: "s1",
      method: "continuous",
      elements: ELEMENTS,
      idGen: seqIdGen,
    });
    const rec = rebuilt.recover();
    expect(rec).not.toBeNull();
    rebuilt.resume();
    const r2 = rebuilt.recordReading("a2");
    rebuilt.cycleStart(); // بستن چرخه ۱ با مرز چرخه ۲
    const s = deriveSession([...(rebuilt.events() as ChronoEvent[])], ELEMENTS, { method: "continuous" });
    const last = s.interruptions[s.interruptions.length - 1];
    expect(last.durationUnknown).toBe(true);
    expect(last.flags).toContain("clockRecovery");
    // چرخه بازیابی‌شده علامت می‌خورد (بسته شده — نه incomplete)
    expect(s.cycles[0].flags).toContain("clockRecovery");
    expect(s.cycles[0].status).toBe("recovered");
    expect(s.flags).toContain("clockRecovery");
    expect(s.pausedMs).toBeNull(); // حداقل یک جزء نامشخص
    expect(r2.elapsedActiveMs).toBe(1_000); // زمان جعل نشد — ادامه از آخرین قرائت
  });

  test("پرچم visibilityLoss به چرخه و جلسه سرریز می‌کند", () => {
    const { clock, engine } = makeEngine();
    engine.start();
    engine.cycleStart();
    clock.advance(1_000);
    engine.recordReading("a1", ["visibilityLoss"]);
    clock.advance(1_000);
    engine.recordReading("a2");
    engine.cycleStart();
    const s = deriveSession(engine.events() as ChronoEvent[], ELEMENTS, { method: "continuous" });
    expect(s.cycles[0].flags).toContain("visibilityLoss");
    expect(s.flags).toContain("visibilityLoss");
    expect(s.cycles[0].elements[0].flags).toContain("visibilityLoss");
  });

  test("startedAtWall/endedAtWall ثبت می‌شوند", () => {
    const { clock, engine } = makeEngine();
    engine.start();
    clock.advance(1_000);
    engine.stop();
    const s = deriveSession(engine.events() as ChronoEvent[], ELEMENTS, { method: "continuous" });
    expect(s.startedAtWall).toBe(new Date(1_700_000_000_000).toISOString());
    expect(s.endedAtWall).toBe(new Date(1_700_000_001_000).toISOString());
  });
});

// ─────────────────────── ساعت: خواب/دید ───────────────────────

describe("Clock — تشخیص خواب/بازگشت دید", () => {
  test("detectSleep: انحراف بزرگ دیواری/یکنواخت → true", () => {
    expect(detectSleep(0, 0, 60_000, 1_000)).toBe(true); // دیواری ۶۰s vs perf ۱s
    expect(detectSleep(0, 0, 1_500, 1_000)).toBe(false); // نوسان جزئی
    expect(detectSleep(0, 0, 5_000, 5_000)).toBe(false); // هم‌قدم
  });

  test("detectSleep: داده منفی بدون اتهام", () => {
    expect(detectSleep(5_000, 5_000, 1_000, 1_000)).toBe(false);
  });

  test("visibilityReturnFlag: آستانه ۲s", () => {
    expect(visibilityReturnFlag(1_500)).toBeNull();
    expect(visibilityReturnFlag(3_000)).toBe("visibilityLoss");
  });

  test("ManualClock.advanceSplit شبیه‌سازی خواب مستقل", () => {
    const c = new ManualClock(0, 1_700_000_000_000);
    c.advanceSplit(1_000, 120_000); // perf فقط ۱s؛ دیواری ۱۲۰s → خواب
    const n = c.now();
    expect(detectSleep(1_700_000_000_000, 0, n.wall.getTime(), n.perfMs)).toBe(true);
  });
});

// ─────────────────────── قالب‌بندی ───────────────────────

describe("قالب‌بندی زمان", () => {
  test("formatDurationMs", () => {
    expect(formatDurationMs(0)).toBe("00:00.00");
    expect(formatDurationMs(1_230)).toBe("00:01.23");
    expect(formatDurationMs(65_400)).toBe("01:05.40");
    expect(formatDurationMs(3_600_000 + 2_000)).toBe("1:00:02.00");
    expect(formatDurationMs(-5)).toBe("00:00.00");
    expect(formatDurationMs(Number.NaN)).toBe("00:00.00");
  });

  test("formatShortMs", () => {
    expect(formatShortMs(2_400)).toBe("2.40s");
    expect(formatShortMs(90_000)).toBe("01:30.00");
  });
});

// ─────────────────────── چند چرخه + دفتر بزرگ ───────────────────────

describe("deriveSession — چند چرخه و ادغام دفتر", () => {
  test("۵ چرخه متوالی؛ شمارش/زمان‌ها درست؛ دفور تکراری حذف", () => {
    const { clock, engine } = makeEngine();
    engine.start();
    for (let i = 0; i < 5; i += 1) {
      engine.cycleStart();
      clock.advance(1_000);
      engine.recordReading("a1");
      clock.advance(1_000);
      engine.recordReading("a2");
      clock.advance(1_000);
      engine.recordReading("a3");
    }
    engine.stop();
    const raw = engine.events() as ChronoEvent[];
    const dupJournal = [...raw, ...raw.map((e) => ({ ...e }))]; // تکرار کامل — retry شبکه
    const merged = dedupeAndSort(dupJournal);
    expect(merged.length).toBe(raw.length);
    const s = deriveSession(merged, ELEMENTS, { method: "continuous" });
    expect(s.cycles.length).toBe(5);
    expect(s.completedCycles).toBe(5);
    for (const c of s.cycles) {
      expect(c.cycleTimeMs).toBe(3_000);
      expect(c.status).toBe("valid");
    }
    expect(s.activeMs).toBe(15_000);
    expect(s.eventCount).toBe(raw.length);
  });
});
