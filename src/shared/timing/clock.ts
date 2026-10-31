/**
 * ساعت تزریقی کرنومتر (ENGINE_CONTRACTS §۳ · ADR-004).
 *
 *  - perfMs: زمان یکنواخت درون-جلسه (performance.now() در مرورگر) — مبنای همه فاصله‌ها.
 *  - wall:   زمان دیواری/تقویمی — صرفاً ممیزی و گزارش؛ هرگز مبنای فاصله نیست.
 *
 * موتور خالص هرگز مستقیماً performance.now/Date نمی‌خواند؛ Clock تزریق می‌شود
 * تا آزمون بدون مرورگر با زمان کنترل‌شده ممکن باشد (Q/K/C2).
 */

import type { IntegrityFlag } from "./types";

export interface ClockNow {
  perfMs: number;
  wall: Date;
}

export interface Clock {
  now(): ClockNow;
}

/** ساعت واقعی مرورگر — production. performance.now در محیط‌های بدون DOM صفر است. */
export class BrowserClock implements Clock {
  now(): ClockNow {
    const perf =
      typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
    return { perfMs: perf, wall: new Date() };
  }
}

/** ساعت دستی آزمون — زمان کنترل‌شده قطعی. */
export class ManualClock implements Clock {
  private _perfMs: number;
  private _wallMs: number;

  constructor(startPerfMs = 0, startWallMs = Date.now()) {
    this._perfMs = startPerfMs;
    this._wallMs = startWallMs;
  }

  now(): ClockNow {
    return { perfMs: this._perfMs, wall: new Date(this._wallMs) };
  }

  /** پیش‌بردن زمان یکنواخت (ms). */
  advance(perfMs: number): void {
    this._perfMs += perfMs;
    this._wallMs += perfMs; // پیش‌فرض: ساعت دیواری هم‌قدم
  }

  /** پیش‌بردن جداگانه — شبیه‌سازی خواب دستگاه/انحراف ساعت. */
  advanceSplit(perfMs: number, wallMs: number): void {
    this._perfMs += perfMs;
    this._wallMs += wallMs;
  }
}

// ─────────────────────── تشخیص خواب/انحراف ساعت (خالص) ───────────────────────

/**
 * آستانه‌های تشخیص — فرض‌های ثبت‌شده (قابل تنظیم در فراخوانی):
 *  - sleepSuspected وقتی انحراف ساعت دیواری نسبت به زمان یکنواخت از skewTolMs بیشتر
 *    و مجموع انحراف از sleepMinMs بیشتر باشد. مقادیر پیش‌فرض محافظه‌کارانه‌اند؛
 *    «استاندارد جهانی» نیستند — تصمیم محصول برای صداقت دقت (ADR-004).
 */
export const DEFAULT_SLEEP_SKEW_TOL_MS = 5_000;
export const DEFAULT_SLEEP_MIN_MS = 5_000;

/**
 * تشخیص شک به خواب دستگاه: مقایسه رشد ساعت دیواری با رشد زمان یکنواخت.
 * خالص و بدون عارضه جانبی — مصرف‌کننده (hook مرورگر/آزمون) نتیجه را به پرچم رویداد تبدیل می‌کند.
 */
export function detectSleep(
  prevWallMs: number,
  prevPerfMs: number,
  nowWallMs: number,
  nowPerfMs: number,
  opts: { skewTolMs?: number; sleepMinMs?: number } = {},
): boolean {
  const skewTol = opts.skewTolMs ?? DEFAULT_SLEEP_SKEW_TOL_MS;
  const sleepMin = opts.sleepMinMs ?? DEFAULT_SLEEP_MIN_MS;
  const perfDelta = nowPerfMs - prevPerfMs;
  const wallDelta = nowWallMs - prevPerfMs === 0 ? 0 : nowWallMs - prevWallMs; // محض خوانایی
  if (perfDelta < 0 || wallDelta < 0) return false; // داده ناساز — بدون اتهام
  const skew = wallDelta - perfDelta;
  return skew > skewTol && skew > sleepMin;
}

/** آستانه مخفی‌بودن صفحه که پس از آن پرچم visibilityLoss می‌خورد (ms) — فرض محصول. */
export const VISIBILITY_LOSS_THRESHOLD_MS = 2_000;

/** پرچم یکپارچگی برای بازگشت صفحه پس از مخفی‌بودن طولانی. */
export function visibilityReturnFlag(hiddenMs: number, thresholdMs = VISIBILITY_LOSS_THRESHOLD_MS): IntegrityFlag | null {
  return hiddenMs > thresholdMs ? "visibilityLoss" : null;
}
