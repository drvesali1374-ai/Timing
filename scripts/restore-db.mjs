/**
 * بازیابی پایگاه داده SQLite از پشتیبان — فاز ۷ (R7-4)
 * ------------------------------------------------------
 * گام‌ها:
 *  ۱) راستی‌آزمایی فایل پشتیبان (وجود + integrity_check + هش SHA-256 در صورت متادیتا)
 *  ۲) پشتیبان‌گیری احتیاطی از وضعیت فعلی (قبل از بازنویسی — «نقطه بازگشت»)
 *  ۳) جایگزینی فایل اصلی + پاک‌سازی WAL/SHM قدیمی
 *  ۴) صدق‌سنجی پس از بازیابی: integrity + شمار موجودیت‌ها + گزارش مقایسه با متادیتای پشتیبان
 *
 * هشدار: سرور توسعه ممکن است فایل را باز نگه داشته باشد؛ پس از بازیابی
 * سرور باید ری‌استارت شود تا اتصال‌های Prisma به فایل تازه اشاره کنند.
 *
 * اجرا: `bun run restore:db -- db/backups/custom-YYYYMMDD-HHMMSS.db`
 */
import { copyFileSync, existsSync, readFileSync, rmSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { Database } from "bun:sqlite";

const DB_PATH = process.env.DATABASE_FILE ?? "db/custom.db";
// توجه: bun هنگام اجرای مستقیم .mjs مسیر اسکریپت را در argv نمی‌آورد؛
// آخرین آرگومانِ منتهی به .db را به‌عنوان مسیر پشتیبان برمی‌داریم.
const argv = process.argv.filter((a) => a.endsWith(".db"));
const src = argv[argv.length - 1];

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

if (!src) fail("مسیر فایل پشتیبان را بدهید: bun run restore:db -- db/backups/custom-….db");
if (!existsSync(src)) fail(`فایل پشتیبان یافت نشد: ${src}`);
if (src === DB_PATH) fail("مسیر پشتیبان همان فایل اصلی است — مسیر دیگری بدهید.");

// ۱) صدق‌سنجی پشتیبان
const ro = new Database(src, { readonly: true });
const integrity = String(Object.values(ro.query("PRAGMA integrity_check").get())[0]);
if (!integrity.includes("ok")) {
  ro.close();
  fail(`پشتیبان سالم نیست (integrity_check: ${integrity})`);
}
const srcCounts = {};
for (const t of ["User", "Project", "TimingSession", "TimingEvent", "TimingCycle", "BalanceScenario", "BalanceResult", "AuditLog"]) {
  try {
    srcCounts[t] = ro.query(`SELECT COUNT(*) AS c FROM "${t}"`).get().c;
  } catch {
    srcCounts[t] = null;
  }
}
ro.close();
const sha = createHash("sha256").update(readFileSync(src)).digest("hex");
console.log(`✓ پشتیبان سالم است (integrity: ${integrity}) — ${src}`);
console.log(`  شمار موجودیت‌ها در پشتیبان: ${JSON.stringify(srcCounts)}`);

// تطبیق هش با متادیتا (در صورت وجود)
const metaPath = `${src}.meta.json`;
if (existsSync(metaPath)) {
  const meta = JSON.parse(readFileSync(metaPath, "utf8"));
  if (meta.sha256 && meta.sha256 !== sha) fail("هش SHA-256 با متادیتای پشتیبان تطبیق ندارد — فایل تغییر کرده است.");
  console.log(`✓ هش SHA-256 با متادیتا تطبیق کرد (${sha.slice(0, 24)}…)`);
}

// ۲) نقطه بازگشت از وضعیت فعلی
if (existsSync(DB_PATH)) {
  const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 17);
  const rollback = `db/backups/pre-restore-${stamp}.db`;
  copyFileSync(DB_PATH, rollback);
  console.log(`✓ نقطه بازگشت از وضعیت فعلی ذخیره شد: ${rollback}`);
}

// ۳) جایگزینی
rmSync(`${DB_PATH}-wal`, { force: true });
rmSync(`${DB_PATH}-shm`, { force: true });
copyFileSync(src, DB_PATH);
console.log(`✓ پایگاه داده جایگزین شد: ${DB_PATH}`);

// ۴) صدق‌سنجی نهایی
const verify = new Database(DB_PATH, { readonly: true });
const integrity2 = String(Object.values(verify.query("PRAGMA integrity_check").get())[0]);
if (!integrity2.includes("ok")) {
  verify.close();
  fail(`پس از بازیابی integrity ناموفق است: ${integrity2}`);
}
const dstCounts = {};
let mismatch = 0;
for (const [t, c] of Object.entries(srcCounts)) {
  try {
    const d = verify.query(`SELECT COUNT(*) AS c FROM "${t}"`).get().c;
    dstCounts[t] = d;
    if (c !== null && d !== c) {
      mismatch += 1;
      console.error(`  ✗ ناهمخوانی شمار ${t}: پشتیبان=${c} / بازیابی‌شده=${d}`);
    }
  } catch {
    dstCounts[t] = null;
  }
}
verify.close();
if (mismatch > 0) fail(`${mismatch} ناهمخوانی شمار موجودیت — بازیابی ناقص است.`);

console.log(`✓ راستی‌آزمایی پس از بازیابی: integrity ok + شمار همه موجودیت‌ها مطابق پشتیبان`);
console.log("\n★ بازیابی موفق — سرور توسعه را ری‌استارت کنید تا Prisma فایل تازه را بگیرد.");
console.log("  (bun run dev در این محیط) — داده‌های پیش از بازیابی در نقطه بازگشت موجودند.");
