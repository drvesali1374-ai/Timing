import { describe, expect, test } from "bun:test";
import {
  normalizeDurationInput,
  parseDurationMs,
  parseDurationOrThrow,
  formatSecondsInput,
  formatDurationFa,
  MAX_DURATION_MS,
} from "./parse-duration";

describe("normalizeDurationInput", () => {
  test("ارقام فارسی → لاتین", () => {
    expect(normalizeDurationInput("۱۲٫۵")).toBe("12.5");
  });
  test("ارقام عربی → لاتین", () => {
    expect(normalizeDurationInput("١٢٫٥")).toBe("12.5");
  });
  test("جداکننده ویرگول/عربی → نقطه", () => {
    expect(normalizeDurationInput("12,5")).toBe("12.5");
    expect(normalizeDurationInput("12٫5")).toBe("12.5");
  });
  test("حذف فاصله‌ها", () => {
    expect(normalizeDurationInput(" 12 . 5 ")).toBe("12.5");
  });
});

describe("parseDurationMs", () => {
  test("عدد اعشاری ثانیه", () => {
    expect(parseDurationMs("12.5")).toEqual({ ok: true, ms: 12500 });
  });
  test("عدد صحیح ثانیه", () => {
    expect(parseDurationMs("45")).toEqual({ ok: true, ms: 45000 });
  });
  test("عدد فارسی با ممیز", () => {
    expect(parseDurationMs("۱۲٫۵")).toEqual({ ok: true, ms: 12500 });
  });
  test("ویرگول اعشار", () => {
    expect(parseDurationMs("4,2")).toEqual({ ok: true, ms: 4200 });
  });
  test("دقیقه:ثانیه", () => {
    expect(parseDurationMs("00:12.5")).toEqual({ ok: true, ms: 12500 });
  });
  test("mm:ss بدون اعشار", () => {
    expect(parseDurationMs("12:30")).toEqual({ ok: true, ms: 750000 });
  });
  test("ساعت:دقیقه:ثانیه", () => {
    expect(parseDurationMs("1:02:03.5")).toEqual({ ok: true, ms: 3723500 });
  });
  test("زمان فارسی", () => {
    expect(parseDurationMs("۰۰:۱۲٫۵")).toEqual({ ok: true, ms: 12500 });
  });
  test("گرد شدن به میلی‌ثانیه", () => {
    expect(parseDurationMs("0.1234")).toEqual({ ok: true, ms: 123 });
    expect(parseDurationMs("0.1235")).toEqual({ ok: true, ms: 124 });
  });

  // خطاها — پیام فارسی الزامی است
  test("خالی → خطا", () => {
    const r = parseDurationMs("");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.messageFa.length).toBeGreaterThan(5);
  });
  test("منفی → خطا", () => {
    expect(parseDurationMs("-5").ok).toBe(false);
  });
  test("متن غیرعددی → خطا", () => {
    expect(parseDurationMs("abc").ok).toBe(false);
  });
  test("صفر → خطا (بزرگ‌تر از صفر لازم)", () => {
    expect(parseDurationMs("0").ok).toBe(false);
    expect(parseDurationMs("0:00").ok).toBe(false);
  });
  test("ثانیه ≥ ۶۰ → خطا", () => {
    expect(parseDurationMs("12:75").ok).toBe(false);
  });
  test("قالب چهاربخشی → خطا", () => {
    expect(parseDurationMs("1:2:3:4").ok).toBe(false);
  });
  test("بیش از ۲۴ ساعت → خطا", () => {
    expect(parseDurationMs("25:00:00").ok).toBe(false);
    expect(parseDurationMs(String(MAX_DURATION_MS / 1000 + 1)).ok).toBe(false);
  });
});

describe("parseDurationOrThrow", () => {
  test("موفق → ms", () => {
    expect(parseDurationOrThrow("12.5")).toBe(12500);
  });
  test("خطا → پرتاب با پیام فارسی", () => {
    let msg = "";
    try {
      parseDurationOrThrow("xx");
    } catch (e) {
      msg = (e as Error).message;
    }
    expect(msg).toContain("عدد");
  });
});

describe("formatSecondsInput", () => {
  test("گرد", () => {
    expect(formatSecondsInput(12500)).toBe("12.5");
  });
  test("صحیح", () => {
    expect(formatSecondsInput(4000)).toBe("4");
  });
  test("میلی‌ثانیه", () => {
    expect(formatSecondsInput(1234)).toBe("1.234");
  });
});

describe("formatDurationFa", () => {
  test("زیر دقیقه → ثانیه", () => {
    expect(formatDurationFa(12500)).toBe("12.5 ثانیه");
  });
  test("دقیقه:ثانیه", () => {
    expect(formatDurationFa(750000)).toBe("12:30");
  });
  test("ساعت:دقیقه:ثانیه", () => {
    expect(formatDurationFa(3723500)).toBe("1:02:03.500");
  });
});
