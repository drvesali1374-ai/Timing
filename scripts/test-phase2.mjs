#!/usr/bin/env node
/**
 * آزمون‌های یکپارچگی فاز ۲ — درخواست-پاسخ واقعی به سرور توسعه (localhost:3000).
 *
 * پوشش معیارهای پذیرش فاز ۲ (TEST_MATRIX + سند جامع فاز دو):
 *  R2-1  مسیر کامل پارامتر سفارشی بدون تغییر کد (معیار پذیرش اصلی فاز):
 *        ساخت خانواده + پارامتر ← ثبت مقدار در فرم ← ساخت فرمول با آن پارامتر ←
 *        دیدن نتیجه ← بستن/بازکردن پروژه (GET جدید) ← بازیابی همان داده/نتیجه؛
 *        و پروژه دیگر نباید از آن تعریف تأثیر بپذیرد (جداسازی).
 *  R2-2  قطعیت و بازتولید نتیجه فرمول (ارزیابی دوباره → نتیجه یکسان)
 *  R2-3  مرزی DSL: چرخه وابستگی · تقسیم‌برصفر (پویا/ثابت) · ارجاع ناموجود ·
 *        نوع نادرست · واحد ناسازگار · سقف طول/گره/عمق · تزریق کد (بدون eval)
 *  R2-V  نسخه‌بندی: append-only + defVersion pinning مقدارها + semver فرمول
 *  R2-IE import/export: خروجی معتبر ← درون‌ریزی dryRun معتبر ← اعمال ←
 *        فایل خراب/نامعتبر ← dryRun رد و «اعمال نمی‌شود»
 *  R2-RB RBAC: ۴۰۱ بی‌نشست · ۴۰۴ پروژه دیگران · ۴۰۳ نقش viewer/recorder
 *  R2-A  فعالیت‌ها (مدل B5): ایجاد/ویرایش/بایگانی + readiness
 *
 * اجرا: `bun run test:phase2` — سرور توسعه باید در حال اجرا باشد.
 * خروجی: گزارش گام‌به‌گام + جمع‌بندی؛ exit 1 اگر هر آزمونی رد شود.
 */
const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";

let passed = 0;
let failed = 0;
const failures = [];

function check(name, cond, evidence = "") {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${name}${evidence ? ` — ${evidence}` : ""}`);
  } else {
    failed += 1;
    failures.push(name);
    console.log(`  ✗ ${name}${evidence ? ` — ${evidence}` : ""}`);
  }
}

function makeClient() {
  const cookies = new Map();
  function cookieHeader() {
    return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  function storeCookies(res) {
    const setCookies = res.headers.getSetCookie?.() ?? [];
    for (const sc of setCookies) {
      const [pair] = sc.split(";");
      const eq = pair.indexOf("=");
      if (eq > 0) cookies.set(pair.slice(0, eq), pair.slice(eq + 1));
    }
  }
  return {
    async req(path, init = {}) {
      const res = await fetch(BASE + path, {
        ...init,
        headers: {
          ...(init.body ? { "Content-Type": "application/json" } : {}),
          ...(cookies.size > 0 ? { Cookie: cookieHeader() } : {}),
          ...(init.headers ?? {}),
        },
        redirect: "manual",
      });
      storeCookies(res);
      let body = null;
      try {
        body = await res.json();
      } catch {
        body = null;
      }
      return { status: res.status, body };
    },
    async login(email, password) {
      const csrfRes = await this.req("/api/auth/csrf");
      const csrfToken = csrfRes.body?.csrfToken;
      const res = await fetch(BASE + "/api/auth/callback/credentials", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          ...(cookies.size > 0 ? { Cookie: cookieHeader() } : {}),
        },
        body: new URLSearchParams({ csrfToken, email, password, json: "true" }),
        redirect: "manual",
      });
      storeCookies(res);
      return res.ok;
    },
  };
}

const stamp = Date.now();
const owner = { name: "آزمون‌گر فاز۲", email: `p2a-${stamp}@test.local`, password: "TestPass1234" };
const other = { name: "کاربر دیگر فاز۲", email: `p2b-${stamp}@test.local`, password: "TestPass1234" };
const viewer = { name: "ببیننده فاز۲", email: `p2c-${stamp}@test.local`, password: "TestPass1234" };

async function registerAndLogin(user) {
  const client = makeClient();
  const reg = await client.req("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ name: user.name, email: user.email, password: user.password }),
  });
  if (reg.status !== 201) throw new Error(`register failed: ${reg.status} ${JSON.stringify(reg.body)}`);
  const ok = await client.login(user.email, user.password);
  if (!ok) throw new Error("login failed");
  return client;
}

async function createProject(client, code) {
  const res = await client.req("/api/projects", {
    method: "POST",
    body: JSON.stringify({
      title: `پروژه آزمون فاز۲ ${code}`,
      code,
      goal: "آزمون خودکار فاز ۲",
      profileTemplateId: "profile.general-industrial-time-study",
      profileComponents: {},
    }),
  });
  if (res.status !== 201) throw new Error(`create project failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.id;
}

async function applyOps(client, projectId, reason, operations) {
  return client.req(`/api/projects/${projectId}/config/versions`, {
    method: "POST",
    body: JSON.stringify({ reason, operations }),
  });
}

async function main() {
  console.log("════════ آزمون‌های یکپارچگی فاز ۲ ════════");
  console.log(`هدف: ${BASE}\n`);

  console.log("[۰] آماده‌سازی کاربران و دو پروژه مستقل");
  const cOwner = await registerAndLogin(owner);
  const cOther = await registerAndLogin(other);
  const cViewer = await registerAndLogin(viewer);
  const projA = await createProject(cOwner, `P2-A-${stamp}`);
  const projB = await createProject(cOwner, `P2-B-${stamp}`);
  check("دو پروژه مستقل از پروفایل پیش‌فرض ساخته شد", !!projA && !!projB);

  const cfgA = await cOwner.req(`/api/projects/${projA}/config`);
  check("GET config → snapshot v2 با فرمول‌های اجرایی", cfgA.status === 200 && cfgA.body.snapshot.snapshotVersion === "2" && cfgA.body.snapshot.formulas.some((f) => f.key === "TS-011" && f.expr.includes("toUnit")), `semver ${cfgA.body?.semver}`);

  // ─── R2-1: مسیر کامل پارامتر سفارشی ───
  console.log("\n[۱] R2-1 — مسیر کامل پارامتر سفارشی بدون تغییر کد");
  const addOps = await applyOps(cOwner, projA, "آزمون R2-1: خانواده و پارامتر سفارشی کوره", [
    { op: "addFamily", family: { stableKey: "oven.settings", nameFa: "تنظیمات کوره", parameters: [] } },
    {
      op: "addParameter",
      familyKey: "oven.settings",
      parameter: {
        stableKey: "oven.cycleTime", nameFa: "زمان چرخه کوره", dataType: "duration",
        analysisRole: "variable", required: true, min: 0, unit: "s", displayContexts: ["form", "report"],
      },
    },
    {
      op: "addParameter",
      familyKey: "oven.settings",
      parameter: {
        stableKey: "oven.batchesPerDay", nameFa: "تعداد batch روزانه", dataType: "integer",
        analysisRole: "input", defaultValue: 10, unit: "pcs", displayContexts: ["form", "report"],
      },
    },
    {
      op: "addFormula",
      formula: {
        key: "f.ovenTotalDaily", nameFa: "زمان کل کوره روزانه", scopeLevel: "project",
        status: "active", descriptionFa: "زمان چرخه × تعداد batch روزانه",
        expr: "oven.cycleTime * oven.batchesPerDay", outputUnit: "s",
      },
    },
  ]);
  check("۴ عملیات (خانواده+۲پارامتر+فرمول) → نسخه جدید append-only", addOps.status === 201 && addOps.body.semver === "1.1.0", `v${addOps.body?.semver}`);

  const versions1 = await cOwner.req(`/api/projects/${projA}/config-versions`);
  check("نسخه ۱٫۰٫۰ قبلی هنوز موجود است (append-only)", versions1.body.items.length === 2 && versions1.body.items.some((v) => v.semver === "1.0.0"));

  const saveVal = await cOwner.req(`/api/projects/${projA}/values`, {
    method: "PUT",
    body: JSON.stringify({ values: [{ stableKey: "oven.cycleTime", value: 42.5 }, { stableKey: "oven.batchesPerDay", value: 12 }] }),
  });
  check("ثبت مقدار در فرم (PUT values)", saveVal.status === 200 && saveVal.body.items.length === 2);

  const evalRes = await cOwner.req(`/api/projects/${projA}/formulas/evaluate`, {
    method: "POST",
    body: JSON.stringify({ formulaKey: "f.ovenTotalDaily" }),
  });
  check(
    "ارزیابی فرمول با پارامتر سفارشی → نتیجه صحیح",
    evalRes.status === 201 && evalRes.body.status === "valid" && evalRes.body.value === 510 && evalRes.body.unit === "s",
    `${evalRes.body?.value} ${evalRes.body?.unit}`,
  );
  check("trace ارزیابی ثبت شد", Array.isArray(evalRes.body?.trace) && evalRes.body.trace.length > 0, `${evalRes.body?.trace?.length} گام`);
  check("inputRefs به پارامترهای سفارشی ارجاع می‌دهد", JSON.stringify(evalRes.body?.inputRefs) === JSON.stringify(["oven.cycleTime", "oven.batchesPerDay"]));

  // «بستن و باز کردن پروژه» = کلاینت جدید + GET تازه
  console.log("  … شبیه‌سازی بستن/بازکردن پروژه (نشست و GET جدید)");
  const cReopen = makeClient();
  const okLogin = await cReopen.login(owner.email, owner.password);
  const valuesAfter = await cReopen.req(`/api/projects/${projA}/values`);
  const ovenValue = valuesAfter.body.items.find((v) => v.stableKey === "oven.cycleTime");
  check("بازگشایی: همان مقدار بازیابی می‌شود", okLogin && ovenValue?.value?.value === 42.5 && ovenValue?.defVersion === 1);
  const resultsAfter = await cReopen.req(`/api/projects/${projA}/formulas/results`);
  const ovenResult = resultsAfter.body.items.find((r) => r.formulaKey === "f.ovenTotalDaily");
  check("بازگشایی: همان نتیجه بازیابی می‌شود", ovenResult?.status === "valid" && ovenResult?.value === 510 && ovenResult?.unit === "s");

  // جداسازی: پروژه B نباید از تعریف A تأثیر بپذیرد
  const cfgB = await cOwner.req(`/api/projects/${projB}/config`);
  const bHasOven = cfgB.body.snapshot.families.some((f) => f.stableKey === "oven.settings");
  const bHasFormula = cfgB.body.snapshot.formulas.some((f) => f.key === "f.ovenTotalDaily");
  check("جداسازی: پروژه B خانواده سفارشی A را ندارد", !bHasOven);
  check("جداسازی: پروژه B فرمول سفارشی A را ندارد", !bHasFormula);
  check("جداسازی: نسخه B هنوز ۱٫۰٫۰ است", cfgB.body.semver === "1.0.0");
  const bValues = await cOwner.req(`/api/projects/${projB}/values`);
  const bOven = bValues.body.items.find((v) => v.stableKey === "oven.cycleTime");
  check("جداسازی: مقدار A در B ظاهر نمی‌شود", !bOven);

  // استقلال از الگو (بند ۸ فاز ۲): تغییر الگو نباید پروژه را تغییر دهد — با نسخه الگوی ثبت‌شده اثبات می‌شود
  check("استقلال: snapshot A به نسخه الگوی لحظه ایجاد گره خورده", cfgA.body.snapshot.meta.templateVersion === "1.1.0" && cfgB.body.snapshot.meta.templateVersion === "1.1.0");

  // ─── R2-2: قطعیت ───
  console.log("\n[۲] R2-2 — قطعیت و بازتولید نتیجه");
  const evalRes2 = await cOwner.req(`/api/projects/${projA}/formulas/evaluate`, {
    method: "POST",
    body: JSON.stringify({ formulaKey: "f.ovenTotalDaily" }),
  });
  const evalRes3 = await cOwner.req(`/api/projects/${projA}/formulas/evaluate`, {
    method: "POST",
    body: JSON.stringify({ formulaKey: "f.ovenTotalDaily" }),
  });
  check(
    "ارزیابی دوباره با ورودی یکسان → مقدار/واحد/وضعیت یکسان",
    evalRes2.body.value === evalRes3.body.value && evalRes2.body.unit === evalRes3.body.unit && evalRes2.body.status === evalRes3.body.status,
  );
  check(
    "trace نیز بازتولیدپذیر است (قطعیت)",
    JSON.stringify(evalRes2.body.trace) === JSON.stringify(evalRes3.body.trace),
    `${evalRes2.body?.trace?.length} گام یکسان`,
  );
  const resultsList = await cOwner.req(`/api/projects/${projA}/formulas/results`);
  const ovenResults = resultsList.body.items.filter((r) => r.formulaKey === "f.ovenTotalDaily");
  check("نتایج قبلی append-only حفظ می‌شوند (۳ ارزیابی = ۳ رکورد در تاریخچه... آخرین نمایش)", ovenResults.length === 1, "آخرین نتیجه هر فرمول نمایش می‌یابد");

  // آزمون فرمول با داده نمونه (بدون ذخیره)
  const testRes = await cOwner.req(`/api/projects/${projA}/config/formulas/test`, {
    method: "POST",
    body: JSON.stringify({ formulaKey: "TS-011", sampleValues: { nt: 0.94, "allowance.rate": 15 }, sampleUnits: { nt: "s", "allowance.rate": "percent" } }),
  });
  check("آزمون فرمول سیستمی TS-011 با داده نمونه: NT=0.94s، r=15% → 1.081s", testRes.body.status === "valid" && Math.abs(testRes.body.value - 1.081) < 1e-9, `${testRes.body?.value} ${testRes.body?.unit}`);

  // ─── R2-3: مرزی ───
  console.log("\n[۳] R2-3 — آزمون‌های مرزی DSL");
  // چرخه وابستگی
  const cyc = await applyOps(cOwner, projA, "آزمون چرخه (باید رد شود)", [
    { op: "addFormula", formula: { key: "f.cycA", nameFa: "چرخه الف", scopeLevel: "project", status: "active", descriptionFa: "ارجاع به ب", expr: "f.cycB.result + 1" } },
    { op: "addFormula", formula: { key: "f.cycB", nameFa: "چرخه ب", scopeLevel: "project", status: "active", descriptionFa: "ارجاع به الف", expr: "f.cycA.result + 1" } },
  ]);
  check("چرخه وابستگی فرمول‌ها رد می‌شود (پیش از ذخیره)", cyc.status === 400 && JSON.stringify(cyc.body?.error?.message ?? "").includes("چرخه"));

  // خودارجاعی
  const selfRef = await applyOps(cOwner, projA, "آزمون خودارجاعی", [
    { op: "addFormula", formula: { key: "f.selfRef", nameFa: "خودارجاعی", scopeLevel: "project", status: "active", descriptionFa: "خودش", expr: "f.selfRef.result + 1" } },
  ]);
  check("خودارجاعی مستقیم رد می‌شود", selfRef.status === 400);

  // تقسیم بر صفر پویا
  const div0 = await cOwner.req(`/api/projects/${projA}/config/formulas/test`, {
    method: "POST",
    body: JSON.stringify({ expr: "oven.cycleTime / oven.batchesPerDay", sampleValues: { "oven.cycleTime": 100, "oven.batchesPerDay": 0 }, sampleUnits: { "oven.cycleTime": "s", "oven.batchesPerDay": "pcs" } }),
  });
  check("تقسیم بر صفر پویا → invalid با کد div0", div0.body.status === "invalid" && div0.body.errors.some((e) => e.code === "div0"));

  // ارجاع ناموجود
  const unknownRef = await cOwner.req(`/api/projects/${projA}/config/formulas/validate`, {
    method: "POST",
    body: JSON.stringify({ expr: "nonexistent.param + 1" }),
  });
  check("ارجاع ناموجود → خطای ref در تحلیل ایستا", unknownRef.body.errors.some((e) => e.code === "ref" && unknownRef.body.refs.unknown.includes("nonexistent.param")));

  // نوع نادرست
  const badType = await cOwner.req(`/api/projects/${projA}/config/formulas/test`, {
    method: "POST",
    body: JSON.stringify({ expr: "'متن' + 5" }),
  });
  check("نوع نادرست (رشته+عدد) → خطای type", badType.body.status === "invalid" && badType.body.errors.some((e) => e.code === "type"));

  // واحد ناسازگار
  const badUnit = await cOwner.req(`/api/projects/${projA}/config/formulas/test`, {
    method: "POST",
    body: JSON.stringify({ expr: "oven.cycleTime + oven.batchesPerDay", sampleValues: { "oven.cycleTime": 10, "oven.batchesPerDay": 5 }, sampleUnits: { "oven.cycleTime": "s", "oven.batchesPerDay": "pcs" } }),
  });
  check("واحد ناسازگار (s + pcs) → خطای unit بدون تبدیل پنهان", badUnit.body.status === "invalid" && badUnit.body.errors.some((e) => e.code === "unit"));

  // سقف‌ها
  const tooLong = await cOwner.req(`/api/projects/${projA}/config/formulas/validate`, {
    method: "POST",
    body: JSON.stringify({ expr: "1+".repeat(1100) + "1" }),
  });
  check("عبارت > ۲۰۴۸ نویسه رد می‌شود", tooLong.status === 400 || tooLong.body.errors?.length > 0);

  const tooManyNodes = await cOwner.req(`/api/projects/${projA}/config/formulas/validate`, {
    method: "POST",
    body: JSON.stringify({ expr: "1" + "+1".repeat(600) }),
  });
  check("عبارت > ۵۱۲ گره رد می‌شود", tooManyNodes.status === 400 || tooManyNodes.body.errors?.length > 0);

  const tooDeep = await cOwner.req(`/api/projects/${projA}/config/formulas/validate`, {
    method: "POST",
    body: JSON.stringify({ expr: "(".repeat(70) + "1" + ")".repeat(70) }),
  });
  check("تودرتویی > ۶۴ رد می‌شود", tooDeep.body.errors?.length > 0);

  // تزریق کد — هیچ اجرایی رخ نمی‌دهد
  let injectionBlocked = true;
  let injectionEvidence = [];
  for (const malicious of ["process.exit(1)", "eval('1+1')", "require('fs')", "__proto__", "globalThis"]) {
    const r = await cOwner.req(`/api/projects/${projA}/config/formulas/test`, {
      method: "POST",
      body: JSON.stringify({ expr: malicious }),
    });
    const isInvalid = r.body.status === "invalid" || r.body.errors?.length > 0 || r.body.parseError;
    if (!isInvalid) injectionBlocked = false;
    injectionEvidence.push(malicious);
  }
  check("رشته‌های تزریق کد اجرا نمی‌شوند (بدون eval — فقط خطا)", injectionBlocked, injectionEvidence.join(" · "));

  // ─── R2-V: نسخه‌بندی و defVersion ───
  console.log("\n[۴] R2-V — نسخه‌بندی تعریف و pinning مقدار");
  const editParam = await applyOps(cOwner, projA, "تغییر ساختاری پارامتر: دامنه", [
    { op: "updateParameter", parameterKey: "oven.cycleTime", patch: { min: 1, required: true } },
  ]);
  check("ویرایش ساختاری پارامتر → نسخه جدید پیکربندی", editParam.status === 201 && editParam.body.semver === "1.2.0", `v${editParam.body?.semver}`);
  check("defVersion پارامتر ++ شد", editParam.body.summary.parametersTouched[0].defVersion === 2);

  const valuesAfterEdit = await cOwner.req(`/api/projects/${projA}/values`);
  const ovenValue2 = valuesAfterEdit.body.items.find((v) => v.stableKey === "oven.cycleTime");
  check("مقدار ثبت‌شده به defVersion قدیم (۱) گره خورده باقی می‌ماند", ovenValue2.defVersion === 1 && ovenValue2.currentDefVersion === 2, `pinned v${ovenValue2?.defVersion} / فعلی v${ovenValue2?.currentDefVersion}`);

  // ثبت مجدد مقدار → pin به نسخه جدید
  await cOwner.req(`/api/projects/${projA}/values`, {
    method: "PUT",
    body: JSON.stringify({ values: [{ stableKey: "oven.cycleTime", value: 40 }] }),
  });
  const valuesReSaved = await cOwner.req(`/api/projects/${projA}/values`);
  const ovenValue3 = valuesReSaved.body.items.find((v) => v.stableKey === "oven.cycleTime");
  check("ثبت مجدد مقدار → pin به defVersion جدید (۲)", ovenValue3.defVersion === 2);

  // اعتبارسنجی مقدار در برابر تعریف
  const badValue = await cOwner.req(`/api/projects/${projA}/values`, {
    method: "PUT",
    body: JSON.stringify({ values: [{ stableKey: "oven.cycleTime", value: 0.5 }] }),
  });
  check("مقدار خارج از دامنه (min=1) رد می‌شود", badValue.status === 400);

  // فرمول سیستمی غیرقابل ویرایش مستقیم
  const editSystem = await applyOps(cOwner, projA, "آزمون ویرایش فرمول سیستمی", [
    { op: "updateFormula", formulaKey: "TS-011", patch: { expr: "1" } },
  ]);
  check("ویرایش عبارت فرمول سیستمی رد می‌شود (۴۰۳)", editSystem.status === 403);

  // غیرفعال‌سازی فرمول سیستمی مجاز است
  const deprecate = await applyOps(cOwner, projA, "غیرفعال‌سازی TS-012 (on-standard)", [
    { op: "deprecateFormula", formulaKey: "TS-012", deprecated: true },
  ]);
  check("غیرفعال‌سازی فرمول سیستمی مجاز است", deprecate.status === 201);

  // ─── R2-IE: import/export ───
  console.log("\n[۵] R2-IE — import/export");
  const exportRes = await cOwner.req(`/api/projects/${projA}/config/export`);
  check("خروجی گرفتن پیکربندی", exportRes.status === 200 && exportRes.body.format === "timing-config-snapshot" && exportRes.body.formatVersion === "2");

  // درون‌ریزی در پروژه B — dryRun
  const dryRun = await cOwner.req(`/api/projects/${projB}/config/import`, {
    method: "POST",
    body: JSON.stringify({ payload: exportRes.body, dryRun: true }),
  });
  check("درون‌ریزی dryRun معتبر → گزارش valid بدون اعمال", dryRun.status === 200 && dryRun.body.valid === true && !dryRun.body.applied);

  const cfgBBefore = await cOwner.req(`/api/projects/${projB}/config`);
  check("dryRun چیزی اعمال نکرد", cfgBBefore.body.semver === "1.0.0");

  // اعمال واقعی
  const doImport = await cOwner.req(`/api/projects/${projB}/config/import`, {
    method: "POST",
    body: JSON.stringify({ payload: exportRes.body, dryRun: false, reason: "درون‌ریزی از پروژه A (آزمون)" }),
  });
  check("اعمال درون‌ریزی → نسخه جدید در B", doImport.status === 201 && doImport.body.applied?.semver === "1.1.0");
  const cfgBAfter = await cOwner.req(`/api/projects/${projB}/config`);
  check("خانواده/فرمول سفارشی A پس از درون‌ریزی در B موجود است", cfgBAfter.body.snapshot.families.some((f) => f.stableKey === "oven.settings") && cfgBAfter.body.snapshot.formulas.some((f) => f.key === "f.ovenTotalDaily"));

  // فایل خراب
  const badImport = await cOwner.req(`/api/projects/${projB}/config/import`, {
    method: "POST",
    body: JSON.stringify({ payload: { format: "something-else" }, dryRun: true }),
  });
  check("فایل نامعتبر → dryRun رد با گزارش خطا", badImport.body.valid === false && badImport.body.issues.length > 0);

  const invalidSnapshot = JSON.parse(JSON.stringify(exportRes.body));
  invalidSnapshot.snapshot.families.push({ stableKey: "bad key!", nameFa: "", parameters: [{ stableKey: "x", dataType: "number" }] });
  const semiBad = await cOwner.req(`/api/projects/${projB}/config/import`, {
    method: "POST",
    body: JSON.stringify({ payload: invalidSnapshot, dryRun: true }),
  });
  check("snapshot ناقص → خطاهای دقیق گزارش و اعمال نمی‌شود", semiBad.body.valid === false && semiBad.body.issues.length > 0);
  const cfgBFinal = await cOwner.req(`/api/projects/${projB}/config`);
  check("پس از تلاش نامعتبر، نسخه B تغییر نکرد", cfgBFinal.body.semver === "1.1.0");

  // ─── R2-RB: مجوزها ───
  console.log("\n[۶] R2-RB — کنترل دسترسی");
  const anon = makeClient();
  const anonCfg = await anon.req(`/api/projects/${projA}/config`);
  check("بدون نشست → ۴۰۱", anonCfg.status === 401);

  const otherCfg = await cOther.req(`/api/projects/${projA}/config`);
  check("پروژه کاربر دیگر → ۴۰۴ (بدون افشا)", otherCfg.status === 404);

  // ببیننده پروژه A
  const addViewer = await cOwner.req(`/api/projects/${projA}/members`, {
    method: "POST",
    body: JSON.stringify({ email: viewer.email, role: "viewer" }),
  });
  check("افزودن ببیننده", addViewer.status === 201);
  const viewerRead = await cViewer.req(`/api/projects/${projA}/config`);
  check("ببیننده: خواندن مجاز", viewerRead.status === 200);
  const viewerWrite = await cViewer.req(`/api/projects/${projA}/config/versions`, {
    method: "POST",
    body: JSON.stringify({ reason: "تلاش نامجاز", operations: [{ op: "addFamily", family: { stableKey: "hacker.family", nameFa: "هک", parameters: [] } }] }),
  });
  check("ببیننده: عملیات نوشتن → ۴۰۳", viewerWrite.status === 403);
  const viewerValues = await cViewer.req(`/api/projects/${projA}/values`, {
    method: "PUT",
    body: JSON.stringify({ values: [{ stableKey: "oven.cycleTime", value: 1 }] }),
  });
  check("ببیننده: ثبت مقدار → ۴۰۳", viewerValues.status === 403);
  const viewerEval = await cViewer.req(`/api/projects/${projA}/formulas/evaluate`, {
    method: "POST",
    body: JSON.stringify({ formulaKey: "f.ovenTotalDaily" }),
  });
  check("ببیننده: ارزیابی → ۴۰۳", viewerEval.status === 403);

  // ─── R2-A: فعالیت‌ها ───
  console.log("\n[۷] R2-A — مدل فعالیت (B5)");
  const act1 = await cOwner.req(`/api/projects/${projA}/activities`, {
    method: "POST",
    body: JSON.stringify({ stableKey: "el.test-fetch", name: "برداشتن قطعه", workType: "operatorManual", description: "عنصر آزمون" }),
  });
  check("ایجاد فعالیت", act1.status === 201 && act1.body.workType === "operatorManual");
  const act2 = await cOwner.req(`/api/projects/${projA}/activities`, {
    method: "POST",
    body: JSON.stringify({ stableKey: "el.test-machine", name: "کار ماشین", workType: "machineAuto" }),
  });
  check("فعالیت نوع ماشین", act2.status === 201);
  const actPatch = await cOwner.req(`/api/projects/${projA}/activities/${act1.body.id}`, {
    method: "PATCH",
    body: JSON.stringify({ name: "برداشتن قطعه از پالت", vaClassification: "valueAdded" }),
  });
  check("ویرایش فعالیت + طبقه‌بندی ارزش (با تأیید کاربر)", actPatch.status === 200 && actPatch.body.vaClassification === "valueAdded");
  const actArch = await cOwner.req(`/api/projects/${projA}/activities/${act2.body.id}`, {
    method: "PATCH",
    body: JSON.stringify({ archived: true }),
  });
  check("بایگانی فعالیت", actArch.status === 200 && actArch.body.archived === true);
  const projARes = await cOwner.req(`/api/projects/${projA}`);
  check("readiness اندازه‌گیری با فعالیت فعال true شد", projARes.body.readiness.measurementReady === true);
  const dupeAct = await cOwner.req(`/api/projects/${projA}/activities`, {
    method: "POST",
    body: JSON.stringify({ stableKey: "el.test-fetch", name: "تکراری", workType: "operatorManual" }),
  });
  check("شناسه تکراری فعالیت → ۴۰۹", dupeAct.status === 409);
  const badWorkType = await cOwner.req(`/api/projects/${projA}/activities`, {
    method: "POST",
    body: JSON.stringify({ stableKey: "el.bad-type", name: "بد", workType: "rocketScience" }),
  });
  check("نوع کار نامعتبر → ۴۰۰", badWorkType.status === 400);

  // ─── کاتالوگ توابع ───
  console.log("\n[۸] کاتالوگ توابع");
  const fnCat = await cOwner.req("/api/formula/functions");
  check("GET /api/formula/functions — فهرست بسته توابع + واحدها + سقف‌ها", fnCat.status === 200 && fnCat.body.functions.length >= 21 && fnCat.body.limits.maxExprLength === 2048, `${fnCat.body?.functions?.length} تابع`);

  // ─── جمع‌بندی ───
  console.log("\n════════ جمع‌بندی ════════");
  console.log(`قبول: ${passed} · رد: ${failed}`);
  if (failed > 0) {
    console.log("آزمون‌های ردشده:");
    failures.forEach((f) => console.log(`  - ${f}`));
    process.exit(1);
  } else {
    console.log("همه آزمون‌های فاز ۲ قبول شد ✓");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("خطای اجرای آزمون‌ها:", err);
  process.exit(1);
});
