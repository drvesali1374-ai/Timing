#!/usr/bin/env node
/**
 * بررسی مرزهای ماژول‌ها و کشف وابستگی حلقوی — آزمون R1-4 (فاز ۱).
 *
 * قواعد (مطابق docs/ARCHITECTURE.md §۱٫۲ و تصمیم‌های ثبت‌شده فاز ۱):
 *  ۱) لایه‌های هر ماژول: domain / application / infrastructure (+ definitions برای پروفایل‌ها).
 *  ۲) وابستگی یک‌طرفه رو به پایین: domain → shared؛ application → domain/infra همان ماژول
 *     + application ماژول‌های دیگر (بدون چرخه) + shared + lib/db (برای تراکنش)؛
 *     infrastructure → domain/application همان ماژول + shared + lib/db.
 *  ۳) دسترسی بین‌ماژولی به زیرساخت ماژول دیگر ممنوع (فقط Application مجاز است فراخوانی شود).
 *  ۴) UI (components/hooks/app غیر از api) فقط shared + lib کلاینت — هیچ import از modules.
 *  ۵) API routes (ریشه ترکیب) → application ماژول‌ها + shared + lib/db؛
 *     استثنای مستند: آداپتور NextAuth (identity/infrastructure/nextauth) برای route احراز هویت.
 *  ۶) هیچ وابستگی حلقوی در سطح فایل یا ماژول مجاز نیست.
 *
 * اجرا: `bun run check:boundaries` (node scripts/check-module-boundaries.mjs)
 * خروجی: فهرست نقض‌ها + نمودار وابستگی ماژول‌ها + نتیجه چرخه‌ها؛ exit 1 در صورت نقض.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, dirname } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");

// ─── گردآوری فایل‌ها ───
const TS_FILES = [];
function walk(dir) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.(ts|tsx)$/.test(name)) TS_FILES.push(full);
  }
}
walk(SRC);

// ─── دسته‌بندی هر فایل ───
function classify(file) {
  const rel = relative(SRC, file).replace(/\\/g, "/");
  if (rel.startsWith("shared/")) return { kind: "shared", module: "shared", layer: "shared", rel };
  if (rel.startsWith("types/")) return { kind: "types", module: "types", layer: "types", rel };
  if (rel.startsWith("lib/")) return { kind: "lib", module: `lib:${rel}`, layer: "lib", rel };
  const modMatch = rel.match(/^modules\/([^/]+)\/(.+)$/);
  if (modMatch) {
    const [, module, rest] = modMatch;
    const layer = rest.split("/")[0];
    if (!["domain", "application", "infrastructure", "definitions"].includes(layer)) {
      return { kind: "module-root", module, layer: "root", rel };
    }
    return { kind: "module", module, layer, rel };
  }
  if (rel.startsWith("app/api/")) return { kind: "api", module: "api", layer: "api", rel };
  if (rel.startsWith("app/")) return { kind: "ui", module: "ui:app", layer: "ui", rel };
  if (rel.startsWith("components/")) return { kind: "ui", module: `ui:${rel}`, layer: "ui", rel };
  if (rel.startsWith("hooks/")) return { kind: "ui", module: `ui:${rel}`, layer: "ui", rel };
  return { kind: "other", module: `other:${rel}`, layer: "other", rel };
}

// ─── استخراج importهای داخلی ───
const IMPORT_RE = /(?:import|export)\s+(?:type\s+)?[^'";]*?from\s+['"]([^'"]+)['"]/g;
function extractImports(file) {
  const src = readFileSync(file, "utf8");
  const out = [];
  let m;
  while ((m = IMPORT_RE.exec(src)) !== null) {
    const spec = m[1];
    if (spec.startsWith("@/")) {
      out.push({ spec, resolved: spec.slice(2) }); // نسبت به src/
    } else if (spec.startsWith(".")) {
      const base = join(dirname(file), spec).replace(/\\/g, "/");
      const relToSrc = relative(SRC, base).replace(/\\/g, "/");
      out.push({ spec, resolved: relToSrc });
    }
  }
  return out;
}

// resolution helper: مسیر import ممکن است بدون پسوند یا به پوشه اشاره کند
function resolveModuleInfo(resolvedPath) {
  // امتحان پسوندها و index
  const candidates = [
    resolvedPath,
    `${resolvedPath}.ts`,
    `${resolvedPath}.tsx`,
    `${resolvedPath}/index.ts`,
  ];
  for (const c of candidates) {
    const full = join(SRC, c);
    if (existsSync(full) && statSync(full).isFile()) return classify(full);
  }
  return null;
}

const violations = [];
const moduleEdges = new Set(); // «A → B» در سطح ماژول
const fileEdges = []; // برای کشف چرخه فایل

for (const file of TS_FILES) {
  const info = classify(file);
  const imports = extractImports(file);
  for (const imp of imports) {
    const target = resolveModuleInfo(imp.resolved);
    if (!target) continue; // import خارج از src (npm) یا non-file
    const self = info;

    // یال برای تحلیل چرخه
    if (self.rel !== target.rel) {
      fileEdges.push([self.rel, target.rel]);
      if (self.module !== target.module && self.kind === "module" && target.kind === "module") {
        moduleEdges.add(`${self.module}→${target.module}`);
      }
    }

    const rule = (cond, message) => {
      if (!cond) violations.push({ file: self.rel, import: imp.spec, target: target.rel, message });
    };

    // ─── قواعد لایه‌ای ───
    const isSameModule = self.kind === "module" && target.kind === "module" && self.module === target.module;

    if (self.kind === "module") {
      // دامنه: فقط shared/types
      if (self.layer === "domain") {
        rule(target.kind === "shared" || target.kind === "types" || isSameModule,
          "دامنه فقط می‌تواند shared/(types)/همان ماژول را import کند");
      }
      // definitions: فقط همان ماژول (barrel هم‌سطح‌ها + domain) + shared/types
      if (self.layer === "definitions") {
        rule(isSameModule || target.kind === "shared" || target.kind === "types",
          "تعریف‌های داده فقط همان ماژول/shared/types");
      }
      // application: همان ماژول (هر لایه) + shared + application ماژول دیگر + lib/db + types
      if (self.layer === "application") {
        const ok =
          isSameModule ||
          target.kind === "shared" ||
          target.kind === "types" ||
          (target.kind === "module" && target.layer === "application") ||
          (target.kind === "lib" && target.rel === "lib/db.ts");
        rule(ok, "application فقط: همان ماژول/shared/application ماژول دیگر/lib-db");
      }
      // infrastructure: همان ماژول + shared + lib/db + types
      if (self.layer === "infrastructure") {
        const ok =
          isSameModule ||
          target.kind === "shared" ||
          target.kind === "types" ||
          (target.kind === "lib" && target.rel === "lib/db.ts");
        rule(ok, "infrastructure فقط: همان ماژول/shared/lib-db — دسترسی بین‌ماژولی به زیرساخت ممنوع");
      }
    }

    // ─── UI: فقط shared + lib کلاینت ───
    if (self.kind === "ui") {
      const ok =
        target.kind === "shared" ||
        target.kind === "types" ||
        (target.kind === "lib" && target.rel !== "lib/db.ts") ||
        target.kind === "ui";
      rule(ok, "UI فقط shared/lib-کلاینت — import مستقیم ماژول‌ها ممنوع (منطق دامنه در UI ممنوع)");
    }

    // ─── API routes: composition root ───
    if (self.kind === "api") {
      const ok =
        target.kind === "shared" ||
        target.kind === "types" ||
        (target.kind === "module" && target.layer === "application") ||
        (target.kind === "lib" && (target.rel === "lib/db.ts" || target.rel === "lib/utils.ts")) ||
        // استثنای مستند: آداپتور NextAuth برای route احراز هویت (توصیه‌شده در سند NextAuth v4)
        (target.kind === "module" && target.rel === "modules/identity/infrastructure/nextauth.ts");
      rule(ok, "API فقط application/shared/lib — استثنای مستند: آداپتور NextAuth");
    }

    // ─── shared/types/lib نباید به ماژول‌ها یا UI وابسته باشند ───
    if (self.kind === "shared" || self.kind === "types") {
      rule(target.kind === "shared" || target.kind === "types",
        "shared/types نباید به ماژول/UI/lib وابسته باشد (بدون وابستگی معکوس)");
    }
    if (self.kind === "lib") {
      rule(target.kind === "shared" || target.kind === "lib" || target.kind === "types" || target.kind === "ui",
        "lib نباید به ماژول‌ها وابسته باشد");
    }
  }
}

// ─── کشف چرخه (سطح ماژول و فایل) ───
function findCycles(edges) {
  const graph = new Map();
  for (const [a, b] of edges) {
    if (!graph.has(a)) graph.set(a, []);
    graph.get(a).push(b);
  }
  const state = new Map(); // 0=white 1=gray 2=black
  const cycles = [];
  const stack = [];
  function dfs(node) {
    state.set(node, 1);
    stack.push(node);
    for (const next of graph.get(node) ?? []) {
      const s = state.get(next) ?? 0;
      if (s === 1) {
        const idx = stack.indexOf(next);
        cycles.push(stack.slice(idx).concat(next).join(" → "));
      } else if (s === 0) {
        dfs(next);
      }
    }
    stack.pop();
    state.set(node, 2);
  }
  for (const node of graph.keys()) {
    if ((state.get(node) ?? 0) === 0) dfs(node);
  }
  return [...new Set(cycles)];
}

const moduleCycleEdges = [...moduleEdges].map((e) => e.split("→"));
const moduleCycles = findCycles(moduleCycleEdges);
const fileCycles = findCycles(fileEdges);

// ─── گزارش ───
console.log("════════ بررسی مرزهای ماژول‌ها (R1-4) ════════");
console.log(`فایل‌های بررسی‌شده: ${TS_FILES.length}`);
console.log(`یال‌های بین‌ماژولی: ${[...moduleEdges].join("  ") || "(بدون)"}`);
console.log("");

if (violations.length > 0) {
  console.log(`✗ نقض قواعد لایه‌بندی: ${violations.length}`);
  for (const v of violations) {
    console.log(`  - ${v.file}`);
    console.log(`      import: ${v.import} → ${v.target}`);
    console.log(`      قاعده: ${v.message}`);
  }
} else {
  console.log("✓ هیچ نقض قاعده لایه‌بندی وجود ندارد.");
}
console.log("");

if (moduleCycles.length > 0) {
  console.log(`✗ چرخه وابستگی ماژولی: ${moduleCycles.length}`);
  moduleCycles.forEach((c) => console.log(`  - ${c}`));
} else {
  console.log("✓ هیچ وابستگی حلقوی ماژولی وجود ندارد.");
}
if (fileCycles.length > 0) {
  console.log(`✗ چرخه وابستگی در سطح فایل: ${fileCycles.length}`);
  fileCycles.forEach((c) => console.log(`  - ${c}`));
} else {
  console.log("✓ هیچ وابستگی حلقوی در سطح فایل وجود ندارد.");
}

const failed = violations.length > 0 || moduleCycles.length > 0 || fileCycles.length > 0;
console.log("");
console.log(failed ? "نتیجه: رد — رفع نقض‌ها الزامی است." : "نتیجه: قبول — ساختار ماژول‌ها سالم و بدون چرخه است ✓");
process.exit(failed ? 1 : 0);
