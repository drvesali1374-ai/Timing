"use client";

/**
 * تشخیص قابلیت اجرای لایه مدل زبانی محلی (ADR-002 بند ۴ · ADR-012 بخش ب).
 *
 * این ماژول فقط «تشخیص قابلیت» است — نه بارگذاری مدل. لایه مدل زبانی محلی
 * اختیاری است (B7) و در نبود آن، دستیار با «قواعد آفلاین + کتابخانه دانش»
 * نسخه‌دار کار می‌کند. هیچ ادعایی درباره اجرای مدل بدون شاهد بیان نمی‌شود.
 *
 * نکته تاریخچه: این فایل در کامیت فاز ۳ به‌سبب الگوی «local-*» در .gitignore
 * جا افتاد (بررسی شد با git check-ignore) و در فاز ۵ بازسازی شد — ریشه
 * همان ADR-012 باقی مانده است؛ فقط الگوی نادقت gitignore اصلاح شد.
 */

export interface LocalModelStatus {
  /** آیا مرورگر قابلیت سخت‌افزاری/گرافیکی لازم برای مدل محلی را دارد؟ */
  available: boolean;
  /** وقتی available=true: نام آداپتور/زیرساخت شناسایی‌شده */
  adapterFa?: string;
  /** وقتی available=true: یادداشت صادقانه درباره وضعیت لایه مدل */
  noteFa?: string;
  /** وقتی available=false: علت فارسی (بدون ادعای غلط) */
  reasonFa?: string;
}

/**
 * تشخیص قابلیت WebGPU — استاندارد WebGPU API (W3C).
 * فقط حضور adapter معرفی می‌کند؛ اجرای واقعی مدل زبانی محلی در این نسخه
 * فعال نیست و پاسخ‌های دستیار از قواعد/دانش آفلاین می‌آیند (صادقانه).
 */
export function detectLocalModelCapability(): LocalModelStatus {
  if (typeof navigator === "undefined") {
    // فراخوانی سمت سرور — تشخیص فقط در مرورگر معنا دارد
    return { available: false, reasonFa: "بررسی قابلیت فقط در مرورگر انجام می‌شود." };
  }
  const nav = navigator as Navigator & { gpu?: unknown };
  if (nav.gpu) {
    return {
      available: true,
      adapterFa: "WebGPU",
      noteFa:
        "مرورگر WebGPU را معرفی می‌کند (پیش‌نیاز اختیاری مدل محلی)؛ در این نسخه مدل زبانی محلی بارگذاری نمی‌شود و پاسخ‌ها از قواعد و دانش آفلاین می‌آیند.",
    };
  }
  return {
    available: false,
    reasonFa: "این مرورگر WebGPU را معرفی نمی‌کند.",
  };
}
