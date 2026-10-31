import { randomBytes } from "node:crypto";

/**
 * تولید UUID نسخه ۷ (RFC 9562) — شناسه پایدار مرتب‌شده با زمان.
 * همه موجودیت‌های دامنه از این شناسه‌ها استفاده می‌کنند (DATA_DICTIONARY §۲).
 * تاریخ مرجع: RFC 9562 (می ۲۰۲۴) — جایگزین پیش‌نویس RFC 4122.
 */
export function uuidv7(): string {
  const ts = Date.now();
  const tsBuf = Buffer.alloc(6);
  tsBuf.writeUIntBE(ts, 0, 6);
  const rand = randomBytes(10);
  // بایت ۶: نسخه ۷ در نیشل بالا | بایت ۸: واریانت RFC 4122
  rand[0] = (rand[0] & 0x0f) | 0x70;
  rand[2] = (rand[2] & 0x3f) | 0x80;
  const hex = Buffer.concat([tsBuf, rand]).toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

/** تاریخ ایجاد را از شناسه UUIDv7 استخراج می‌کند (برای ردیابی). */
export function uuidv7Timestamp(id: string): Date | null {
  const hex = id.replace(/-/g, "");
  if (hex.length !== 32) return null;
  try {
    const ts = parseInt(hex.slice(0, 12), 16);
    return new Date(ts);
  } catch {
    return null;
  }
}
