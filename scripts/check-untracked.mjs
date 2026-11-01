#!/usr/bin/env node
/**
 * گارد ضد گم‌شدن فایل (درس فاز ۵ — FILE_LOSS_PREVENTION.md)
 *
 * ریشه مشکل تاریخی: الگوهای لخت (بدون لنگر /) در .gitignore مثل `test` یا `local-*`
 * فایل‌های سورس را «بی‌صدا» ignore می‌کردند → هرگز commit نمی‌شدند → بعد از ریست محیط
 * برای همیشه گم می‌شدند (قربانی واقعی: route فاز ۲ config/formulas/test).
 *
 * این اسکریپت بررسی می‌کند:
 *  ۱) هیچ فایلی داخل مسیرهای سورس حیاتی (src/ prisma/ scripts/ mini-services/ docs/)
 *     روی دیسک وجود نداشته باشد که git آن را ignore کرده باشد (خطر گم‌شدن).
 *  ۲) فایل‌های سورس‌مانند با پسوند خطرناک (.ts/.tsx/.mjs/.prisma) در کل مخزن ignore نشده باشند.
 *  ۳) مخزن محلی با remote همگام است (پیش از اتمام کار).
 *
 * اجرا: `bun run check:untracked` (یا node scripts/check-untracked.mjs)
 * خروج: exit 0 = سالم · exit 1 = خطر/خطا — باید قبل از هر کامیت نهایی اجرا شود.
 */
import { execFileSync } from "node:child_process";

const SOURCE_DIRS = ["src", "prisma", "scripts", "mini-services", "docs"];
const DANGEROUS_EXT = /\.(ts|tsx|mjs|cjs|prisma|sql|md)$/i;

function git(args) {
  return execFileSync("git", args, { cwd: process.cwd(), encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

function main() {
  let problems = 0;

  // ۱) فایل‌های ignored داخل مسیرهای سورس حیاتی
  const ignored = git(["ls-files", "--others", "--ignored", "--exclude-standard", "-z"])
    .split("\0")
    .filter(Boolean);
  const inSourceDirs = ignored.filter((f) => SOURCE_DIRS.some((d) => f === d || f.startsWith(d + "/")));
  if (inSourceDirs.length > 0) {
    problems += inSourceDirs.length;
    console.error("✗ خطر: فایل‌های سورس ignore شده‌اند (هرگز commit نمی‌شوند و در ریست بعدی گم می‌شوند):");
    for (const f of inSourceDirs) console.error(`    - ${f}`);
    console.error("  ⟶ یا الگوی .gitignore را لنگردار کنید (پیشوند /) یا فایل را جابه‌جا/حذف کنید.");
  }

  // ۲) فایل‌های سورس‌مانند ignored در هرجای مخزن (به‌جز پوشه‌های عمدی sandbox)
  const INTENTIONAL = [/^skills\//, /^download\//, /^examples\//, /^tests\//, /^tool-results\//, /^\.zscripts\//, /^node_modules\//, /^\.next\//, /^\.agent-browser\//, /^next-env\.d\.ts$/, /^tsconfig\.tsbuildinfo$/];
  const suspicious = ignored.filter(
    (f) => DANGEROUS_EXT.test(f) && !INTENTIONAL.some((re) => re.test(f)) && !inSourceDirs.includes(f),
  );
  if (suspicious.length > 0) {
    problems += suspicious.length;
    console.error("⚠ هشدار: فایل‌های سورس‌مانند ignore شده خارج از مسیرهای سورس (بازبینی کنید):");
    for (const f of suspicious) console.error(`    - ${f}`);
  }

  // ۳) فایل‌های tracked که روی دیسک حذف شده‌اند (حذف ناخواسته)
  const deleted = git(["ls-files", "-d", "-z"]).split("\0").filter(Boolean);
  if (deleted.length > 0) {
    problems += deleted.length;
    console.error("✗ خطر: فایل‌های tracked از دیسک حذف شده‌اند (اگر عمدی نیست: git checkout -- <file>):");
    for (const f of deleted) console.error(`    - ${f}`);
  }

  // ۴) همگامی با remote (فقط گزارش — بدون fetch شبکه‌ای برای سرعت)
  try {
    const status = git(["status", "--short", "--branch"]);
    const line = status.split("\n")[0] ?? "";
    if (line.includes("ahead")) {
      console.warn(`⚠ شاخه محلی جلوتر از remote است — پس از اتمام کار push کنید.`);
    }
  } catch {
    /* بدون remote — بی‌اهمیت */
  }

  if (problems === 0) {
    console.log("✓ گارد فایل: هیچ فایل سورسی ignore/حذف‌شده‌ای یافت نشد — امن است.");
    process.exit(0);
  }
  console.error(`\nجمع مشکلات: ${problems} — قبل از ادامه این موارد را رفع کنید.`);
  process.exit(1);
}

try {
  main();
} catch (err) {
  console.error("خطای اجرای گارد:", err instanceof Error ? err.message : String(err));
  process.exit(1);
}
