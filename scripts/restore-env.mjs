#!/usr/bin/env node
/**
 * بازیابی خودکار محیط پس از ریست/بازسازی سرور محلی (درس فاز ۵ — FILE_LOSS_PREVENTION.md).
 *
 * ریشه مشکل: `.env` و `/db/` عمداً در git نیستند (راز + داده). بعد از ریست محیط
 * این‌ها ناپدید می‌شدند و جلسات قبلی باید دستی بازیابی می‌کردند (NEXTAUTH_SECRET
 * جدید → خطای JWEDecryptionFailed کوکی‌های قدیمی؛ دیتابیس خالی → seed دستی).
 *
 * این اسکریپت idempotent است و فقط چیزهای غایب را می‌سازد:
 *  ۱) `.env` — اگر نبود: DATABASE_URL + NEXTAUTH_SECRET تازه (openssl-grade random)
 * ۲) `db/custom.db` — اگر نبود: prisma db push + seed (پروفایل‌ها + کاربر نمونه)
 *
 * اجرا: `bun run restore:env` — پس از هر ریست محیط یا کلون تازه مخزن.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";

const ROOT = process.cwd();
const ENV_PATH = join(ROOT, ".env");
const DB_PATH = join(ROOT, "db", "custom.db");
const DB_URL = `file:${DB_PATH}`;

function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], ...opts });
}

function ensureEnv() {
  if (existsSync(ENV_PATH)) {
    const cur = readFileSync(ENV_PATH, "utf8");
    const missing = [];
    if (!/^DATABASE_URL=/m.test(cur)) missing.push("DATABASE_URL");
    if (!/^NEXTAUTH_SECRET=/m.test(cur)) missing.push("NEXTAUTH_SECRET");
    if (missing.length === 0) {
      console.log("✓ .env موجود و کامل است.");
      return;
    }
    console.log(`⚠ .env ناقص است (نبود: ${missing.join(", ")}) — موارد غایب اضافه می‌شوند.`);
    const add = [];
    if (missing.includes("DATABASE_URL")) add.push(`DATABASE_URL=${DB_URL}`);
    if (missing.includes("NEXTAUTH_SECRET")) add.push(`NEXTAUTH_SECRET=${randomBytes(32).toString("hex")}`);
    writeFileSync(ENV_PATH, cur.trimEnd() + "\n" + add.join("\n") + "\n");
    console.log("✓ .env تکمیل شد.");
    return;
  }
  writeFileSync(
    ENV_PATH,
    `DATABASE_URL=${DB_URL}\nNEXTAUTH_SECRET=${randomBytes(32).toString("hex")}\n`,
    { mode: 0o600 },
  );
  console.log("✓ .env ساخته شد (NEXTAUTH_SECRET تازه — کاربران باید دوباره وارد شوند).");
}

function ensureDb() {
  if (existsSync(DB_PATH)) {
    console.log("✓ دیتابیس موجود است (db/custom.db).");
    return;
  }
  console.log("… دیتابیس غایب است: prisma db push …");
  mkdirSync(dirname(DB_PATH), { recursive: true });
  run("bunx", ["prisma", "db", "push", "--accept-data-loss"]);
  console.log("… seed (پروفایل‌ها + کاربر نمونه) …");
  run("bun", ["run", "seed"]);
  console.log("✓ دیتابیس ساخته و seed شد.");
}

ensureEnv();
ensureDb();
console.log("\nبازیابی محیط کامل شد — `bun run dev` را اجرا کنید (اگر در حال اجرا نیست).");
