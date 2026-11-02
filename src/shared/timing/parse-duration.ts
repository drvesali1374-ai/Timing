/**
 * تجزیه مقدار زمان واردشده توسط کاربر — خالص و مشترک کلاینت/سرور (ADR-017).
 * ----------------------------------------------------------------
 * قالب‌های پشتیبانی‌شده:
 *  - عدد اعشاری ثانیه: «12.5» / «12,5» / «۱۲٫۵» → 12500ms
 *  - دقیقه:ثانیه: «00:12.5» یا «12:30» → mm:ss(.sss)
 *  - ساعت:دقیقه:ثانیه: «1:02:03.5»
 *  - ارقام فارسی (۰-۹)، عربی (٠-٩) و لاتین؛ جداکننده نقطه/ویرگول/«٫»
 *
 * واحد استاندارد نگهداری: میلی‌ثانیه صحیح (بدون ابهام).
 * خطاها همیشه با پیام فارسی دقیق برمی‌گردند (بدون پرتاب استثنا در Safe variant).
 */

import { ApiError } from "@/shared/errors";

/** ارقام فارسی/عربی → لاتین + جداکننده اعشاری عربی/ویرگول → نقطه */
export function normalizeDurationInput(raw: string): string {
  let s = raw.trim();
  // ارقام فارسی (U+06F0..06F9) و عربی (U+0660..0669)
  s = s.replace(/[\u06F0-\u06F9\u0660-\u0669]/g, (ch) => {
    const code = ch.codePointAt(0)!;
    const base = code >= 0x06f0 ? 0x06f0 : 0x0660;
    return String(code - base);
  });
  // جداکننده اعشاری عربی «٫» (U+066B) و ویرگول فارسی «،» و ویرگول لاتین → نقطه
  s = s.replace(/[\u066B\u060C,]/g, ".");
  // حذف فاصله‌های نیمه/کامل داخل عدد
  s = s.replace(/[\s\u200C\u200F\u200E]/g, "");
  return s;
}

export const MAX_DURATION_MS = 24 * 60 * 60 * 1000; // ۲۴ ساعت — سقف منطقی یک عنصر

/** نتیجه تجزیه: موفق با ms یا خطا با پیام فارسی */
export type DurationParse =
  | { ok: true; ms: number }
  | { ok: false; messageFa: string };

/**
 * تجزیه مقدار زمان به میلی‌ثانیه — بدون پرتاب.
 * @example parseDurationMs("12.5") → {ok:true, ms:12500}
 * @example parseDurationMs("۱۲٫۵") → {ok:true, ms:12500}
 * @example parseDurationMs("00:12.5") → {ok:true, ms:12500}
 * @example parseDurationMs("1:02:03.5") → {ok:true, ms:3723500}
 */
export function parseDurationMs(raw: string): DurationParse {
  const s = normalizeDurationInput(String(raw ?? ""));
  if (s === "") return { ok: false, messageFa: "مقدار زمان خالی است — عددی مثل 12.5 یا قالب 00:12.5 وارد کنید." };

  if (s.includes(":")) {
    // قالب ساعتی: [h:]mm:ss(.ddd)
    const parts = s.split(":");
    if (parts.length < 2 || parts.length > 3) {
      return { ok: false, messageFa: "قالب زمان معتبر نیست — نمونه درست: 00:12.5 یا 1:02:03.5" };
    }
    const numeric = /^(\d+)(\.\d+)?$/;
    const nums: number[] = [];
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (!numeric.test(p) || p === "") {
        return { ok: false, messageFa: `بخش «${p}» از زمان عددی نیست.` };
      }
      nums.push(parseFloat(p));
    }
    const sec = nums[nums.length - 1];
    const min = nums[nums.length - 2];
    const hr = nums.length === 3 ? nums[0] : 0;
    if (sec >= 60) return { ok: false, messageFa: "ثانیه باید کمتر از ۶۰ باشد — مثلاً 12:30 یعنی ۱۲ دقیقه و ۳۰ ثانیه." };
    if (min >= 60 && parts.length === 3) {
      return { ok: false, messageFa: "دقیقه باید کمتر از ۶۰ باشد — برای مدت بلندتر از ساعت از قالب 1:02:03 استفاده کنید." };
    }
    const totalSec = hr * 3600 + min * 60 + sec;
    const ms = Math.round(totalSec * 1000);
    if (ms <= 0) return { ok: false, messageFa: "مدت زمان باید بزرگ‌تر از صفر باشد." };
    if (ms > MAX_DURATION_MS) return { ok: false, messageFa: "مدت واردشده بیش از ۲۴ ساعت است — مقدار را بررسی کنید." };
    return { ok: true, ms };
  }

  // عدد ساده (ثانیه)
  if (!/^\d+(\.\d+)?$/.test(s)) {
    return { ok: false, messageFa: `مقدار «${raw}» عدد معتبری نیست — مثلاً 12.5 یا 4.2 وارد کنید.` };
  }
  const value = parseFloat(s);
  if (!Number.isFinite(value)) return { ok: false, messageFa: "مقدار زمان نامعتبر است." };
  if (value <= 0) return { ok: false, messageFa: "مدت زمان باید بزرگ‌تر از صفر باشد." };
  const ms = Math.round(value * 1000);
  if (ms > MAX_DURATION_MS) return { ok: false, messageFa: "مدت واردشده بیش از ۲۴ ساعت است — مقدار را بررسی کنید." };
  return { ok: true, ms };
}

/** نسخه پرتاب‌کننده — برای مسیر سرور/دامنه (خطای ۴۰۰ با پیام فارسی) */
export function parseDurationOrThrow(raw: string): number {
  const r = parseDurationMs(raw);
  if (!r.ok) throw ApiError.badRequest(r.messageFa);
  return r.ms;
}

/** نمایش ثانیه‌ای خوانا برای مقدار ذخیره‌شده — «12.5» */
export function formatSecondsInput(ms: number): string {
  const sec = ms / 1000;
  return Number.isInteger(sec) ? String(sec) : String(Math.round(sec * 1000) / 1000);
}

/** نمایش خوانا با واحد — «12.5 ثانیه» یا «1:02:03.5» برای مقادیر بلند */
export function formatDurationFa(ms: number): string {
  if (ms < 60000) return `${formatSecondsInput(ms)} ثانیه`;
  const totalSec = ms / 1000;
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.round((totalSec % 60) * 1000) / 1000;
  const mm = String(m).padStart(2, "0");
  const ss = Number.isInteger(s) ? String(s).padStart(2, "0") : s.toFixed(3).padStart(6, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
