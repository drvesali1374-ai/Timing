/**
 * دامنه ماژول ایستگاه‌های کاری (ADR-017).
 * ایستگاه = واحد ترتیبی خط تولید؛ فعالیت‌ها به آن متصل می‌شوند.
 * قواعد نام‌گذاری ساده و فارسی‌پذیر؛ نام در پروژه یکتاست.
 */

import { ApiError } from "@/shared/errors";

export const STATION_NAME_MAX = 80;

export function assertStationName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (!trimmed) throw ApiError.badRequest("نام ایستگاه الزامی است.");
  if (trimmed.length > STATION_NAME_MAX) {
    throw ApiError.badRequest(`نام ایستگاه نباید بیش از ${STATION_NAME_MAX} نویسه باشد.`);
  }
  return trimmed;
}

/** نام‌گذاری خودکار ایستگاه بعدی — «ایستگاه N» (بعد از آخرین ترتیب موجود) */
export function nextAutoStationName(existingCount: number): string {
  return `ایستگاه ${existingCount + 1}`;
}

/**
 * تجزیه ورودی گروهی نام ایستگاه‌ها — هر سطر یک نام؛ سطرهای خالی نادیده.
 * خروجی: نام‌های پاک‌شده به‌ترتیب ورود (بدون حذف تکرار درون‌ورودی — سرویس تصمیم می‌گیرد).
 */
export function parseStationBulkText(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/\s+/g, " "))
    .filter((line) => line.length > 0 && line.length <= STATION_NAME_MAX);
}
