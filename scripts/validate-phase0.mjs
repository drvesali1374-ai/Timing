#!/usr/bin/env node
/**
 * اعتبارسنجی تحویل‌دادنی‌های فاز صفر — Timing
 * بررسی وجود، کامل بودن بخش‌های الزامی و محتوای کلیدی هر سند.
 * اجرا: node scripts/validate-phase0.mjs  (یا bun scripts/validate-phase0.mjs)
 * خروجی: گزارش قبول/رد برای هر مورد + کد خروج ۰ فقط اگر همه الزامی‌ها قبول شوند.
 */

import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const docs = (...p) => join(ROOT, "docs", ...p);

let pass = 0;
let fail = 0;
const failures = [];

function check(label, cond, detail = "") {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    failures.push(`${label}${detail ? ` — ${detail}` : ""}`);
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function read(p) {
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

console.log("═".repeat(72));
console.log("اعتبارسنجی تحویل‌دادنی‌های فاز صفر — پروژه Timing");
console.log("تاریخ اجرا:", new Date().toISOString());
console.log("═".repeat(72));

// ─── ۱. وجود اسناد الزامی ───────────────────────────────────────────
console.log("\n[۱] اسناد الزامی فاز صفر (خروجی‌های بخش E سند جامع):");
const requiredDocs = [
  "PROJECT_CHARTER.md",
  "ARCHITECTURE.md",
  "DATA_DICTIONARY.md",
  "STANDARDS_CATALOG.md",
  "FORMULA_CATALOG.md",
  "PROFILES.md",
  "ENGINE_CONTRACTS.md",
  "UI_PLAN.md",
  "TEST_MATRIX.md",
  "PHASE_STATUS.md",
  "KNOWN_LIMITATIONS.md",
  "RESEARCH_LOG.md",
];
for (const d of requiredDocs) {
  const p = docs(d);
  const ok = existsSync(p) && statSync(p).size > 1500;
  check(`docs/${d}`, ok, ok ? "" : "موجود نیست یا خیلی کوتاه است");
}

// ─── ۲. سوابق ADR ──────────────────────────────────────────────────
console.log("\n[۲] سوابق تصمیم معماری (ADR):");
for (let i = 1; i <= 10; i++) {
  const id = String(i).padStart(3, "0");
  const dir = docs("ADR");
  let found = false;
  try {
    found = readdirSync(dir).some((f) => f.startsWith(`ADR-${id}`));
  } catch {
    found = false;
  }
  check(`docs/ADR/ADR-${id}-*.md`, found);
}

// ─── ۳. محتوای کلیدی اسناد ─────────────────────────────────────────
console.log("\n[۳] محتوای کلیدی الزامی:");

const charter = read(docs("PROJECT_CHARTER.md"));
check("منشور: مأموریت و قلمرو", /مأموریت/.test(charter) && /قلمرو/.test(charter));
check("منشور: اصول ثابت (استقلال پروژه‌ها)", /استقلال پروژه/.test(charter));
check("منشور: اصل ضد-جعل استاندارد", /ضد-جعل|جهان‌شمولی/.test(charter));

const arch = read(docs("ARCHITECTURE.md"));
check("معماری: انتخاب Modular Monolith", /Modular Monolith/.test(arch));
check("معماری: ماتریس تصمیم فناوری", /ماتریس تصمیم/.test(arch) || /وزنی/.test(arch));
check("معماری: مرز ۱۲+ ماژول", /identity/.test(arch) && /formula/.test(arch) && /balance/.test(arch) && /chronometer/.test(arch));
check("معماری: کنترل دسترسی سمت سرور", /مجوزسنجی.*سرور|سرور.*مجوزسنجی|RBAC/.test(arch));
check("معماری: مدیریت تعارض آفلاین", /تعارض/.test(arch) && /idempotent/.test(arch));
check("معماری: تست‌پذیری/استراتژی آزمون", /تست‌پذیری|آزمون/.test(arch));

const dd = read(docs("DATA_DICTIONARY.md"));
const entities = [
  "Project",
  "ConfigVersion",
  "ParameterFamily",
  "ParameterDefinition",
  "ParameterValue",
  "Activity",
  "Diagram",
  "TimingSession",
  "TimingEvent",
  "Observation",
  "Formula",
  "CalculationResult",
  "BalanceScenario",
  "Report",
];
for (const e of entities) {
  check(`مدل داده: موجودیت ${e}`, dd.includes(e));
}
check("مدل داده: نمودار ER (mermaid)", /erDiagram/.test(dd));
check("مدل داده: جداسازی تعریف/مقدار پارامتر", /تعریف پارامتر از مقدار|جداسازی تعریف/.test(dd));

const sc = read(docs("STANDARDS_CATALOG.md"));
check("کاتالوگ: جدول منابع با ماهیت و مجوز", /ماهیت/.test(sc) && /ملاحظات مجوز/.test(sc));
check("کاتالوگ: تفکیک استاندارد رسمی از روش رایج", /استاندارد رسمی/.test(sc) && /روش رایج/.test(sc));
check("کاتالوگ: ILO و REFA و ISO ثبت شده‌اند", /ILO/.test(sc) && /REFA/.test(sc) && /ISO 6385/.test(sc) && /ISO 22400/.test(sc));

const fc = read(docs("FORMULA_CATALOG.md"));
check("کاتالوگ فرمول: TS-010 زمان نرمال", /TS-010/.test(fc));
check("کاتالوگ فرمول: دو قرارداد مجاز TS-011/TS-012", /TS-011/.test(fc) && /TS-012/.test(fc));
check("کاتالوگ فرمول: تاکت TS-013", /TS-013/.test(fc));
check("کاتالوگ فرمول: شاخص‌های بالانس LB-010/020", /LB-010/.test(fc) && /LB-020/.test(fc));
check("کاتالوگ فرمول: گرامر DSL امن", /ebnf|EBNF/.test(fc) && /eval/.test(fc));

const ec = read(docs("ENGINE_CONTRACTS.md"));
check("قراردادها: موتور فرمول I/O", /EvalRequest/.test(ec) && /EvalResult/.test(ec));
check("قراردادها: مدل نمودار + اعتبارسنجی", /DiagramDoc/.test(ec) && /DiagramValidationReport/.test(ec));
check("قراردادها: کرنومتر + Clock تزریقی", /ChronoEngine/.test(ec) && /Clock/.test(ec));
check("قراردادها: مسئله/راهکار بالانس", /BalanceProblem/.test(ec) && /BalanceSolution/.test(ec));

const pr = read(docs("PROFILES.md"));
check("پروفایل‌ها: ارزیابی ۷ پروفایل A3", /پروفایل/.test(pr) && (pr.match(/✅/g) ?? []).length >= 7);
check("پروفایل‌ها: پروفایل پیش‌فرض تفصیلی", /general-industrial-time-study/.test(pr));
check("پروفایل‌ها: برچسب عدم جعل ضرایب", /پیشنهادی ویرایش‌پذیر|پیشنهاد قابل ویرایش|جعل/.test(pr));

const ui = read(docs("UI_PLAN.md"));
for (const route of ["مدیریت پروژه", "ایجاد پروژه", "پیکربندی", "زمان‌سنجی", "نمودار", "تحلیل", "بالانس", "گزارش"]) {
  check(`طرح UI: مسیر «${route}»`, ui.includes(route));
}
check("طرح UI: وایرفریم/نمونه قابل بررسی", /وایرفریم/.test(ui) && /نمونه اولیه/.test(ui));

const tm = read(docs("TEST_MATRIX.md"));
check("ماتریس آزمون: نقشه وابستگی فازها", /نقشه وابستگی|وابستگی فاز/.test(tm));
check("ماتریس آزمون: نگاشت نیازمندی→آزمون", /فاز ۱/.test(tm) && /فاز ۷/.test(tm));

const ps = read(docs("PHASE_STATUS.md"));
check("وضعیت فاز: شواهد آزمون ثبت‌شده", /شاهد/.test(ps));
check("وضعیت فاز: موارد آزموده‌نشده اعلام‌شده", /آزموده نشد|آزموده‌نشده|نشده/.test(ps));

const kl = read(docs("KNOWN_LIMITATIONS.md"));
check("محدودیت‌ها: ثبت ریسک/فرض", /ریسک|فرض/.test(kl));

const rl = read(docs("RESEARCH_LOG.md"));
check("سابقه پژوهش: تاریخ راستی‌آزمایی ۲۰۲۶", /۲۰۲۶-۱۰-۲۹|2026-10-29/.test(rl));

// ─── ۴. نمونه اولیه قابل بررسی ────────────────────────────────────
console.log("\n[۴] نمونه اولیه UI (وایرفریم تعاملی فاز صفر):");
const page = read(join(ROOT, "src", "app", "page.tsx"));
check("صفحه / موجود با پوسته نمونه اولیه", /PrototypeShell/.test(page));
const shell = read(join(ROOT, "src", "components", "prototype", "shell.tsx"));
check("پوسته RTL با فوتر چسبان", /min-h-screen flex flex-col/.test(shell) && /mt-auto/.test(shell));
const viewsDir = join(ROOT, "src", "components", "prototype", "views");
for (const v of ["dashboard", "new-project", "config", "timing", "diagrams", "analysis", "balance", "reports"]) {
  check(`نمای ${v}`, existsSync(join(viewsDir, `${v}.tsx`)));
}
check("کرنومتر نمایشی از performance.now()", /performance\.now\(\)/.test(read(join(viewsDir, "timing.tsx"))));
check("داده نمونه جدا از داده واقعی (DEMO_TAG)", /DEMO_TAG/.test(read(join(ROOT, "src", "components", "prototype", "data.ts"))));

// ─── ۵. همگام‌سازی با مخزن ─────────────────────────────────────────
console.log("\n[۵] همگام‌سازی فایل‌های مخزن (شرط Phase0.txt):");
for (const f of [
  "README.md",
  "industrial_time_study_master_spec_fa.md",
  ...Array.from({ length: 8 }, (_, i) => `Phase${i}.txt`),
]) {
  check(`فایل مخزن: ${f}`, existsSync(join(ROOT, f)));
}

// ─── نتیجه ─────────────────────────────────────────────────────────
console.log("\n" + "═".repeat(72));
console.log(`نتیجه: ${pass} قبول · ${fail} رد`);
if (fail > 0) {
  console.log("موارد رد‌شده:");
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exit(1);
} else {
  console.log("همه موارد الزامی فاز صفر قبول شد ✓");
  process.exit(0);
}
