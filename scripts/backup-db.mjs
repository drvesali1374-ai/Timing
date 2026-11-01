/**
 * پشتیبان‌گیری از پایگاه داده SQLite — فاز ۷ (R7-4)
 * ---------------------------------------------------
 * روش: WAL checkpoint → کپی فیزیکی → صدق‌سنجی سلامت (integrity_check/quick_check)
 *       → شمار موجودیت‌های کلیدی → هش SHA-256 → فایل متادیتا کنارشی.
 * خروجی: db/backups/custom-YYYYMMDD-HHmmss.db (+ .meta.json)
 *
 * اجرا: `bun run backup:db`
 */
import { copyFileSync, mkdirSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { Database } from "bun:sqlite";

const DB_PATH = process.env.DATABASE_FILE ?? "db/custom.db";
const OUT_DIR = "db/backups";

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

if (!existsSync(DB_PATH)) fail(`فایل پایگاه داده یافت نشد: ${DB_PATH}`);

// ۱) چک‌پوینت WAL — محتوای ژورنال WAL را به فایل اصلی منتقل می‌کند تا کپی کامل باشد
try {
  const w = new Database(DB_PATH);
  w.run("PRAGMA wal_checkpoint(TRUNCATE)");
  w.close();
  console.log("✓ چک‌پوینت WAL اجرا شد (فایل اصلی کامل شد)");
} catch (err) {
  console.warn(`! چک‌پوینت WAL انجام نشد (${err.message}) — ادامه با کپی ساده`);
}

// ۲) کپی فیزیکی با مهر زمانی
const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 17);
mkdirSync(OUT_DIR, { recursive: true });
const outPath = `${OUT_DIR}/custom-${stamp}.db`;
copyFileSync(DB_PATH, outPath);
console.log(`✓ کپی شد: ${outPath}`);

// ۳) صدق‌سنجی سلامتِ پشتیبان (روی خود فایل پشتیبان)
const sha = createHash("sha256").update(readFileSync(outPath)).digest("hex");
const ro = new Database(outPath, { readonly: true });
const integrity = ro.query("PRAGMA integrity_check").get();
const quick = ro.query("PRAGMA quick_check").get();
const integrityText = String(Object.values(integrity)[0]);
const quickText = String(Object.values(quick)[0]);
if (!integrityText.includes("ok") || !quickText.includes("ok")) {
  ro.close();
  fail(`integrity_check ناموفق: ${integrityText} / ${quickText}`);
}

// ۴) شمار موجودیت‌های کلیدی برای راستی‌آزمایی بازیابی بعدی
const counts = {};
for (const t of [
  "User", "Project", "ProjectMembership", "ConfigSnapshot", "ConfigVersion",
  "Activity", "Diagram", "DiagramRevision", "TimingSession", "TimingEvent",
  "TimingCycle", "ObservationMark", "BalanceScenario", "BalanceResult",
  "CalculationResult", "AuditLog",
]) {
  try {
    counts[t] = ro.query(`SELECT COUNT(*) AS c FROM "${t}"`).get().c;
  } catch {
    counts[t] = null;
  }
}
ro.close();

// ۵) متادیتا
const meta = {
  createdAt: new Date().toISOString(),
  source: DB_PATH,
  file: outPath,
  sha256: sha,
  integrity: `${integrityText} / ${quickText}`,
  counts,
  appVersion: "1.0.0",
};
writeFileSync(`${outPath}.meta.json`, JSON.stringify(meta, null, 2), "utf8");

console.log(`✓ هش SHA-256: ${sha.slice(0, 24)}…`);
console.log(`✓ integrity_check: ${integrityText} · quick_check: ${quickText}`);
console.log(`✓ شمار موجودیت‌ها: ${JSON.stringify(counts)}`);
console.log(`\nپشتیبان کامل شد → ${outPath}`);
console.log("بازیابی: bun run restore:db -- db/backups/custom-….db");
