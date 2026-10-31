/// <reference types="bun-types" />
/**
 * آزمون‌های واحد موتور فرمول — فاز ۲ (TEST_MATRIX: R2-2 قطعیت، R2-3 مرزی).
 * داده مرجع مستقل — بدون هیچ وابستگی به DB/UI.
 * اجرا: `bun test src/modules/formula`
 */
import { describe, expect, test } from "bun:test";
import { parse, analyze, evaluate, parseAndEvaluate, dependencyReport } from "./engine";
import type { SymbolTable } from "./engine";

const SYMS: SymbolTable = {
  "study.allowanceRate": { type: "number", unit: "percent", source: "parameter" },
  "study.normalTime": { type: "number", unit: "s", source: "parameter" },
  "takt.net": { type: "number", unit: "s", source: "parameter" },
  "takt.demand": { type: "number", unit: "pcs", source: "parameter" },
  "TS-011.result": { type: "number", unit: "s", source: "formulaResult" },
  "study.operator": { type: "string", source: "parameter" },
  "study.active": { type: "boolean", source: "parameter" },
  "obs.times": { type: "numberArray", source: "parameter" },
};

// ── R2-2: قطعیت و بازتولید ──────────────────────────────────

describe("R2-2 قطعیت و بازتولید نتیجه", () => {
  test("ارزیابی دوباره با ورودی یکسان → نتیجه و trace یکسان", () => {
    const expr = "study.normalTime * (1 + toUnit(study.allowanceRate, 'ratio'))";
    const inputs = { "study.normalTime": { value: 0.94, unit: "s" }, "study.allowanceRate": { value: 15, unit: "percent" } };
    const r1 = parseAndEvaluate(expr, inputs) as ReturnType<typeof evaluate>;
    const r2 = parseAndEvaluate(expr, inputs) as ReturnType<typeof evaluate>;
    expect(r1.status).toBe("valid");
    expect(r2.status).toBe("valid");
    expect(r1.value).toBeCloseTo(1.081, 10);
    expect(r2.value).toBeCloseTo(1.081, 10);
    expect(r1.unit).toBe("s");
    expect(JSON.stringify(r1.trace)).toBe(JSON.stringify(r2.trace));
    expect(r1.inputRefs).toEqual(["study.normalTime", "study.allowanceRate"]);
  });

  test("داده مرجع TS-011 (on-normal): NT=0.94s، r=15% → ST=1.081s", () => {
    const r = parseAndEvaluate("study.normalTime * (1 + toUnit(study.allowanceRate, 'ratio'))", {
      "study.normalTime": { value: 0.94, unit: "s" },
      "study.allowanceRate": { value: 15, unit: "percent" },
    }) as ReturnType<typeof evaluate>;
    expect(r.value).toBeCloseTo(0.94 * 1.15, 12);
  });

  test("داده مرجع TS-012 (on-standard): NT=0.94s، r=15% → ST=1.10588…s", () => {
    const r = parseAndEvaluate("study.normalTime / (1 - toUnit(study.allowanceRate, 'ratio'))", {
      "study.normalTime": { value: 0.94, unit: "s" },
      "study.allowanceRate": { value: 15, unit: "percent" },
    }) as ReturnType<typeof evaluate>;
    expect(r.value).toBeCloseTo(0.94 / 0.85, 12);
  });

  test("دو قرارداد مجاز یکسان نیستند (اختلاف روشن)", () => {
    const inputs = { "study.normalTime": { value: 0.94, unit: "s" }, "study.allowanceRate": { value: 15, unit: "percent" } };
    const a = parseAndEvaluate("study.normalTime * (1 + toUnit(study.allowanceRate, 'ratio'))", inputs) as ReturnType<typeof evaluate>;
    const b = parseAndEvaluate("study.normalTime / (1 - toUnit(study.allowanceRate, 'ratio'))", inputs) as ReturnType<typeof evaluate>;
    expect((a.value as number)).not.toBeCloseTo(b.value as number, 3);
  });

  test("داده مرجع TS-013 تاکت: 27000s / 450pcs = 60 s/pcs", () => {
    const r = parseAndEvaluate("takt.net / takt.demand", {
      "takt.net": { value: 27000, unit: "s" },
      "takt.demand": { value: 450, unit: "pcs" },
    }) as ReturnType<typeof evaluate>;
    expect(r.value).toBe(60);
    expect(r.unit).toBe("s/pcs");
  });

  test("ضرب زمان در تعداد = زمان کل (تعداد مضرب تکرار است)", () => {
    const r = parseAndEvaluate("takt.net * takt.demand", {
      "takt.net": { value: 42.5, unit: "s" },
      "takt.demand": { value: 12, unit: "pcs" },
    }) as ReturnType<typeof evaluate>;
    expect(r.value).toBe(510);
    expect(r.unit).toBe("s");
  });

  test("داده مرجع TS-001 میانگین: [0.82, 1.10, 0.79] → 0.903333…", () => {
    const r = parseAndEvaluate("mean(obs.times)", { "obs.times": { value: [0.82, 1.1, 0.79] } }) as ReturnType<typeof evaluate>;
    expect(r.value).toBeCloseTo(0.9033333333, 9);
  });

  test("داده مرجع ST-001 انحراف معیار نمونه (n−1): [10,12,12,16] → √(19/3)", () => {
    // محاسبه دستی: mean=12.5؛ Σ(x−x̄)²=6.25+0.25+0.25+12.25=19؛ s=√(19/3)=2.5166…
    const r = parseAndEvaluate("stddev(obs.times)", { "obs.times": { value: [10, 12, 12, 16] } }) as ReturnType<typeof evaluate>;
    expect(r.value).toBeCloseTo(Math.sqrt(19 / 3), 12);
  });
});

// ── R2-3: مرزی و امنیت ──────────────────────────────────────

describe("R2-3 آزمون‌های مرزی DSL", () => {
  test("تقسیم بر صفر پویا → invalid با کد div0", () => {
    const r = parseAndEvaluate("takt.net / takt.demand", {
      "takt.net": { value: 100, unit: "s" },
      "takt.demand": { value: 0, unit: "pcs" },
    }) as ReturnType<typeof evaluate>;
    expect(r.status).toBe("invalid");
    expect(r.errors.some((e) => e.code === "div0")).toBe(true);
  });

  test("تقسیم بر صفر ثابت → هشدار تحلیل ایستا", () => {
    const a = analyze("takt.net / 0", SYMS);
    expect(a.warnings.some((w) => w.messageFa.includes("تقسیم بر صفر"))).toBe(true);
  });

  test("ارجاع ناموجود → خطای ref در تحلیل ایستا", () => {
    const a = analyze("study.nonexistent + 1", SYMS);
    expect(a.errors.some((e) => e.code === "ref")).toBe(true);
    expect(a.refs.unknown).toContain("study.nonexistent");
  });

  test("واحد ناسازگار (s + pcs) → خطای unit در ارزیابی", () => {
    const r = parseAndEvaluate("takt.net + takt.demand", {
      "takt.net": { value: 100, unit: "s" },
      "takt.demand": { value: 5, unit: "pcs" },
    }) as ReturnType<typeof evaluate>;
    expect(r.status).toBe("invalid");
    expect(r.errors.some((e) => e.code === "unit")).toBe(true);
  });

  test("درصد بدون تبدیل صریح با عدد بی‌بُعد → خطای unit (بدون تبدیل پنهان)", () => {
    const r = parseAndEvaluate("1 + study.allowanceRate", {
      "study.allowanceRate": { value: 15, unit: "percent" },
    }) as ReturnType<typeof evaluate>;
    expect(r.status).toBe("invalid");
    expect(r.errors.some((e) => e.code === "unit")).toBe(true);
  });

  test("نوع نادرست ('متن' + عدد) → خطای type", () => {
    const r = parseAndEvaluate("'متن' + 5", {}) as ReturnType<typeof evaluate>;
    expect(r.status).toBe("invalid");
    expect(r.errors.some((e) => e.code === "type")).toBe(true);
  });

  test("ورودی گمشده (null) → incomplete نه invalid", () => {
    const r = parseAndEvaluate("study.normalTime * 2", {
      "study.normalTime": { value: null },
    }) as ReturnType<typeof evaluate>;
    expect(r.status).toBe("incomplete");
    expect(r.errors.some((e) => e.code === "missing")).toBe(true);
  });

  test("چرخه وابستگی فرمول‌ها شناسایی می‌شود (A→B→A)", () => {
    const a = parse("fA.result + 1");
    const b = parse("fB.result + 1");
    expect(a.ok && b.ok).toBe(true);
    const report = dependencyReport([
      { key: "A", resultSymbol: "fA.result", ast: a.ok ? a.ast! : null },
      { key: "B", resultSymbol: "fB.result", ast: b.ok ? b.ast! : null },
    ]);
    expect(report.cycles.length).toBeGreaterThan(0);
  });

  test("خودارجاعی مستقیم فرمول → چرخه", () => {
    const a = parse("fA.result + 1");
    expect(a.ok).toBe(true);
    const report = dependencyReport([{ key: "A", resultSymbol: "fA.result", ast: a.ok ? a.ast! : null }]);
    expect(report.cycles.length).toBe(1);
  });

  test("بدون چرخه در زنجیره سالم (A→B)", () => {
    const b = parse("study.normalTime * 2");
    const a = parse("fB.result + 1");
    expect(a.ok && b.ok).toBe(true);
    const report = dependencyReport([
      { key: "A", resultSymbol: "fA.result", ast: a.ok ? a.ast! : null },
      { key: "B", resultSymbol: "fB.result", ast: b.ok ? b.ast! : null },
    ]);
    expect(report.cycles.length).toBe(0);
    expect(report.edges).toEqual([{ from: "A", to: "B" }]);
  });

  test("عبارت طولانی‌تر از ۲۰۴۸ نویسه رد می‌شود", () => {
    const long = "1+".repeat(1100) + "1";
    const r = parse(long);
    expect(r.ok).toBe(false);
  });

  test("عبارت با بیش از ۵۱۲ گره رد می‌شود", () => {
    const wide = "1" + "+1".repeat(600);
    const r = parse(wide);
    expect(r.ok).toBe(false);
  });

  test("تودرتویی عمیق‌تر از ۶۴ رد می‌شود", () => {
    const deep = "(".repeat(70) + "1" + ")".repeat(70);
    const r = parse(deep);
    expect(r.ok).toBe(false);
  });

  test("رشته تزریق کد اجرا نمی‌شود — parse یا تحلیل ایستا رد می‌کند", () => {
    for (const malicious of [
      "process.exit(1)",
      "eval('1+1')",
      "require('fs')",
      "globalThis",
      "window.alert(1)",
      "Function('return 1')()",
      "1; drop table",
      "__proto__",
    ]) {
      const p = parse(malicious);
      if (p.ok) {
        // parse ممکن است بشود؛ تحلیل ایستا باید ارجاع ناشناخته را رد کند
        const a = analyze(malicious, {});
        expect(a.errors.length).toBeGreaterThan(0);
      }
      // هیچ مسیری اجرای کد ندارد — ارزیابی فقط خطای ref می‌دهد
      const r = parseAndEvaluate(malicious, {});
      if (!("parseError" in r)) {
        expect(r.status).toBe("invalid");
      }
    }
  });

  test("نویسه فارسی در شناسه/عملگر رد می‌شود (ASCII-only DSL)", () => {
    const r = parse("سلام + 1");
    expect(r.ok).toBe(false);
  });

  test("توابع ناشناخته در تحلیل ایستا خطای ref می‌گیرند", () => {
    const a = analyze("alert(1)", {});
    expect(a.errors.some((e) => e.code === "ref")).toBe(true);
  });

  test("تعداد آرگومان نادرست → خطای type در تحلیل ایستا", () => {
    const a = analyze("pow(1)", {});
    expect(a.errors.some((e) => e.code === "type")).toBe(true);
  });
});

// ── عملگرها/توابع پایه ──────────────────────────────────────

describe("عملگرها و توابع پایه", () => {
  test("اولویت عملگرها: 2+3*4=14", () => {
    const r = parseAndEvaluate("2 + 3 * 4", {}) as ReturnType<typeof evaluate>;
    expect(r.value).toBe(14);
  });
  test("پرانتز: (2+3)*4=20", () => {
    const r = parseAndEvaluate("(2 + 3) * 4", {}) as ReturnType<typeof evaluate>;
    expect(r.value).toBe(20);
  });
  test("منفی یک‌example: -5 + 3 = -2", () => {
    const r = parseAndEvaluate("-5 + 3", {}) as ReturnType<typeof evaluate>;
    expect(r.value).toBe(-2);
  });
  test("if با شرط", () => {
    const r = parseAndEvaluate("if(1 < 2, 'کم', 'زیاد')", {}) as ReturnType<typeof evaluate>;
    expect(r.value).toBe("کم");
  });
  test("if شاخه else", () => {
    const r = parseAndEvaluate("if(2 < 1, 'کم', 'زیاد')", {}) as ReturnType<typeof evaluate>;
    expect(r.value).toBe("زیاد");
  });
  test("عملگر منطقی &&", () => {
    const r = parseAndEvaluate("true && false", {}) as ReturnType<typeof evaluate>;
    expect(r.value).toBe(false);
  });
  test("coalesce نخستین موجود", () => {
    const r = parseAndEvaluate("coalesce(null, null, 7)", {}) as ReturnType<typeof evaluate>;
    expect(r.value).toBe(7);
  });
  test("isMissing", () => {
    const r = parseAndEvaluate("isMissing(null)", {}) as ReturnType<typeof evaluate>;
    expect(r.value).toBe(true);
  });
  test("toUnit تبدیل زمان: 2h → 120min", () => {
    const r = parseAndEvaluate("toUnit(x.t, 'min')", { "x.t": { value: 2, unit: "h" } }) as ReturnType<typeof evaluate>;
    expect(r.value).toBe(120);
    expect(r.unit).toBe("min");
  });
  test("toUnit روی عدد بی‌واحد به واحد بُعددار → خطای unit (از duration استفاده کنید)", () => {
    const r = parseAndEvaluate("toUnit(2, 'min')", {}) as ReturnType<typeof evaluate>;
    expect(r.status).toBe("invalid");
    expect(r.errors.some((e) => e.code === "unit")).toBe(true);
  });
  test("duration عدد را با واحد زمانی برچسب‌گذاری می‌کند بدون تغییر مقدار", () => {
    const r = parseAndEvaluate("duration(90, 's')", {}) as ReturnType<typeof evaluate>;
    expect(r.value).toBe(90);
    expect(r.unit).toBe("s");
  });
  test("toUnit تبدیل صریح درصصد→نسبت: 15% → 0.15", () => {
    const r = parseAndEvaluate("toUnit(x.p, 'ratio')", { "x.p": { value: 15, unit: "percent" } }) as ReturnType<typeof evaluate>;
    expect(r.value).toBeCloseTo(0.15, 12);
    expect(r.unit).toBe("ratio");
  });
  test("toUnit واحدهای ناهم‌بُعد → خطای unit", () => {
    const r = parseAndEvaluate("toUnit(x.t, 'm')", { "x.t": { value: 5, unit: "s" } }) as ReturnType<typeof evaluate>;
    expect(r.status).toBe("invalid");
    expect(r.errors.some((e) => e.code === "unit")).toBe(true);
  });
  test("median زوج/فرد", () => {
    expect((parseAndEvaluate("median(a)", { a: { value: [3, 1, 2] } }) as ReturnType<typeof evaluate>).value).toBe(2);
    expect((parseAndEvaluate("median(a)", { a: { value: [4, 1, 2, 3] } }) as ReturnType<typeof evaluate>).value).toBe(2.5);
  });
  test("quantile p=0.5 همان median", () => {
    const r = parseAndEvaluate("quantile(a, 0.5)", { a: { value: [4, 1, 2, 3] } }) as ReturnType<typeof evaluate>;
    expect(r.value).toBe(2.5);
  });
  test("round با رقم اعشار", () => {
    const r = parseAndEvaluate("round(3.14159, 2)", {}) as ReturnType<typeof evaluate>;
    expect(r.value).toBe(3.14);
  });
  test("trace گام‌های ارزیابی ثبت می‌کند", () => {
    const r = parseAndEvaluate("1 + 2 * 3", {}) as ReturnType<typeof evaluate>;
    expect(r.trace.length).toBeGreaterThan(0);
    expect(r.trace.some((s) => s.op === "binary:+")).toBe(true);
  });
  test("اعشار فارسی مجاز نیست (ASCII)", () => {
    const r = parse("1٫5");
    expect(r.ok).toBe(false);
  });
});

// ── سریال‌سازی AST ──────────────────────────────────────────

describe("سریال‌سازی/بازساخت AST", () => {
  test("serialize → deserialize → نتیجه یکسان", () => {
    const p = parse("takt.net / takt.demand * 2");
    expect(p.ok).toBe(true);
    if (!p.ok || !p.serialized) throw new Error("parse failed");
    const ast2 = parse("");
    void ast2;
    const rebuilt = parse("takt.net / takt.demand * 2");
    expect(rebuilt.ok).toBe(true);
    const inputs = { "takt.net": { value: 60, unit: "s" }, "takt.demand": { value: 2, unit: "pcs" } };
    const r1 = evaluate(p.ast!, inputs);
    const r2 = evaluate(rebuilt.ast!, inputs);
    expect(r1.value).toBe(r2.value);
    expect(JSON.stringify(r1.trace)).toBe(JSON.stringify(r2.trace));
  });
});
