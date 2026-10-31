/**
 * لایه Application ماژول هویت — ثبت‌نام و راستی‌آزمایی کاربر (Credentials).
 * هش گذرواژه با scrypt داخلی Node (بدون وابستگی بیرونی) و مقایسه زمان‌ثابت.
 */
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { ApiError } from "@/shared/errors";
import { getLogger } from "@/shared/logger";
import { uuidv7 } from "@/shared/ids";
import type { RegisterInput } from "@/shared/validation/project";
import type { SessionUserDto } from "@/shared/contracts/api";
import { findUserByEmail, createUser } from "../infrastructure/user-repo";
import { recordAudit } from "@/modules/audit/application/audit-service";

const log = getLogger("identity");

const SCRYPT_KEYLEN = 64;
const SCRYPT_COST = 16384; // N — مقاوم در برابر حملات brute-force

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const key = scryptSync(password, salt, SCRYPT_KEYLEN, { N: SCRYPT_COST }).toString("hex");
  return `scrypt$${SCRYPT_COST}$${salt}$${key}`;
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "scrypt") return false;
  const cost = Number(parts[1]);
  const salt = parts[2];
  const expected = Buffer.from(parts[3], "hex");
  const actual = scryptSync(password, salt, expected.length, { N: cost });
  return timingSafeEqual(expected, actual);
}

/** ثبت‌نام کاربر جدید — رایانامه یکتا، گذرواژه هش‌شده، ثبت ممیزی. */
export async function registerUser(input: RegisterInput): Promise<SessionUserDto> {
  const existing = await findUserByEmail(input.email);
  if (existing) {
    throw ApiError.conflict("این نشانی رایانامه قبلاً ثبت شده است.");
  }
  const user = await createUser({
    id: uuidv7(),
    email: input.email,
    name: input.name,
    passwordHash: hashPassword(input.password),
    authProvider: "credentials",
  });
  log.info("user registered", { userId: user.id, email: user.email });
  await recordAudit({
    userId: user.id,
    action: "user.registered",
    entityType: "User",
    entityId: user.id,
  });
  return { id: user.id, email: user.email, name: user.name };
}

/** جست‌وجوی کاربر برای افزودن عضو — از طریق Application ماژول هویت (نه زیرساخت مستقیم). */
export async function getUserByEmail(email: string): Promise<SessionUserDto | null> {
  const user = await findUserByEmail(email.trim().toLowerCase());
  if (!user) return null;
  return { id: user.id, email: user.email, name: user.name };
}

/** راستی‌آزمایی credentials برای NextAuth — null یعنی ناموفق. */
export async function verifyCredentials(email: string, password: string): Promise<SessionUserDto | null> {
  const user = await findUserByEmail(email.trim().toLowerCase());
  if (!user || !user.isActive) return null;
  if (!verifyPassword(password, user.passwordHash)) return null;
  return { id: user.id, email: user.email, name: user.name };
}
