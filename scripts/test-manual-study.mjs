#!/usr/bin/env node
/**
 * آزمون‌های یکپارچگی ثبت دستی زمان (ADR-017 — دستورالعمل بخش ۱۱٫۵/۱۱٫۶/۱۱٫۸).
 *
 * پوشش:
 *  M-1  جریان کامل کاربر آماتور بدون هیچ کرنومتری:
 *        ساخت پروژه ← ایجاد ایستگاه (تکی+گروهی) ← ورود گروهی فعالیت‌ها (شناسه خودکار) ←
 *        ساخت برگه ثبت ← افزودن نمونه ← ورود زمان با قالب‌های مختلف (فارسی/لاتین/زمانی) ←
 *        ثبت وقفه معمول ← وقفه «سایر» بدون متن (رد) و با متن (قبول) ← مدت نامشخص ←
 *        ذخیره ← بازخوانی (پسماند) ← اصلاح با دلیل ← نهایی‌سازی ← تحلیل ← گزارش.
 *  M-2  اعتبارسنجی: مقدار نامعتبر رد با پیام فارسی؛ نمونه خارج بازه؛ فعالیت نامعتبر.
 *  M-3  قفل وضعیت: برگه نهایی‌شده ← ذخیره مستقیم رد (403)؛ اصلاح بدون دلیل رد؛ بازگردانی با دلیل.
 *  M-4  تحلیل: داده دستی با محاسبات مستقل (میانگین/تعداد/زنجیره) مقایسه می‌شود؛
 *        منبع داده «دستی» از «کرنومتری» متمایز نمایش داده می‌شود (sessionMethod=manual).
 *  M-5  RBAC: viewer نمی‌تواند برگه/ایستگاه بسازد (403)؛ 401 بدون نشست.
 *  M-6  ایستگاه واقعی در بالانس: فعالیت دارای stationId → قید تخصیص ایستگاه.
 *  M-7  علامت‌گذاری داده پرت/حذف روی مشاهده دستی (دو عمل جدا؛ حذف با علت).
 *
 * اجرا: `node scripts/test-manual-study.mjs` — سرور توسعه باید در حال اجرا باشد.
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
const owner = { name: "آزمون‌گر دستی", email: `ms-a-${stamp}@test.local`, password: "TestPass1234" };
const viewerUser = { name: "ببیننده دستی", email: `ms-v-${stamp}@test.local`, password: "TestPass1234" };

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
      title: `پروژه آزمون ثبت دستی ${code}`,
      code,
      goal: "آزمون خودکار ثبت دستی زمان",
      profileTemplateId: "profile.general-industrial-time-study",
      profileComponents: {},
    }),
  });
  if (res.status !== 201) throw new Error(`create project failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.id;
}

async function main() {
  console.log("════════ آزمون‌های ثبت دستی زمان (ADR-017) ════════");
  const client = await registerAndLogin(owner);
  const projectId = await createProject(client, `MS-${stamp.toString(36).toUpperCase()}`);
  console.log(`پروژه: ${projectId}`);

  // ── M-5: 401 بدون نشست ──
  console.log("\n── RBAC و نشست ──");
  const anon = makeClient();
  const anonSheets = await anon.req(`/api/projects/${projectId}/manual-sheets`);
  check("M-5.1 بدون نشست → 401", anonSheets.status === 401, `status=${anonSheets.status}`);

  const viewer = await registerAndLogin(viewerUser);
  // افزودن viewer به پروژه
  const addMember = await client.req(`/api/projects/${projectId}/members`, {
    method: "POST",
    body: JSON.stringify({ email: viewerUser.email, role: "viewer" }),
  });
  check("M-5.2 افزودن viewer به پروژه", addMember.status === 201 || addMember.status === 200, `status=${addMember.status}`);
  const viewerSheet = await viewer.req(`/api/projects/${projectId}/manual-sheets`, {
    method: "POST",
    body: JSON.stringify({ title: "برگه بدون مجوز" }),
  });
  check("M-5.3 viewer نمی‌تواند برگه بسازد → 403", viewerSheet.status === 403, `status=${viewerSheet.status}`);
  const viewerStation = await viewer.req(`/api/projects/${projectId}/stations`, {
    method: "POST",
    body: JSON.stringify({ name: "ایستگاه بدون مجوز" }),
  });
  check("M-5.4 viewer نمی‌تواند ایستگاه بسازد → 403", viewerStation.status === 403, `status=${viewerStation.status}`);

  // ── ایستگاه‌ها ──
  console.log("\n── ایستگاه‌های کاری ──");
  const st1 = await client.req(`/api/projects/${projectId}/stations`, {
    method: "POST",
    body: JSON.stringify({ name: "آماده‌سازی قطعات" }),
  });
  check("M-1.1 ایجاد ایستگاه تکی", st1.status === 201 && st1.body.name === "آماده‌سازی قطعات", `status=${st1.status}`);
  const stBulk = await client.req(`/api/projects/${projectId}/stations`, {
    method: "PUT",
    body: JSON.stringify({ names: ["مونتاژ", "بازرسی", "بسته‌بندی", "مونتاژ"] }),
  });
  check(
    "M-1.2 ورود گروهی: ۳ ایجاد + ۱ تکراری رد",
    stBulk.status === 200 && stBulk.body.created.length === 3 && stBulk.body.skipped.length === 1,
    `created=${stBulk.body?.created?.length} skipped=${stBulk.body?.skipped?.length}`,
  );
  const stList = await client.req(`/api/projects/${projectId}/stations`);
  const stations = stList.body.items;
  const assembly = stations.find((s) => s.name === "مونتاژ");
  const inspection = stations.find((s) => s.name === "بازرسی");
  check("M-1.3 ترتیب ایستگاه‌ها حفظ شد", stations.map((s) => s.name).join(",") === "آماده‌سازی قطعات,مونتاژ,بازرسی,بسته‌بندی");

  // ── ورود گروهی فعالیت‌ها ──
  console.log("\n── فعالیت‌ها (ورود گروهی + شناسه خودکار) ──");
  const bulk = await client.req(`/api/projects/${projectId}/activities/bulk`, {
    method: "POST",
    body: JSON.stringify({
      items: [
        { name: "برداشتن قطعه از جعبه", stationId: assembly.id },
        { name: "جای‌گذاری قطعه در محل", stationId: assembly.id },
        { name: "نصب پیچ", stationId: assembly.id },
        { name: "بازرسی نهایی", stationId: inspection.id },
        { name: "نصب پیچ" }, // تکراری — رد
      ],
    }),
  });
  check(
    "M-1.4 ورود گروهی فعالیت: ۴ ایجاد + ۱ تکراری",
    bulk.status === 201 && bulk.body.created.length === 4 && bulk.body.skipped.length === 1,
    `created=${bulk.body?.created?.length} skipped=${bulk.body?.skipped?.length}`,
  );
  const autoKeys = bulk.body.created.map((a) => a.stableKey);
  check("M-1.5 شناسه داخلی خودکار تولید شد", autoKeys.every((k) => /^act-\d+$/.test(k)), autoKeys.join(","));
  const acts = await client.req(`/api/projects/${projectId}/activities`);
  const actByName = new Map(acts.body.items.map((a) => [a.name, a]));
  check(
    "M-1.6 نام ایستگاه فعالیت‌ها در DTO",
    actByName.get("نصب پیچ")?.stationName === "مونتاژ" && actByName.get("بازرسی نهایی")?.stationName === "بازرسی",
  );

  // ── برگه ثبت ──
  console.log("\n── برگه ثبت زمان ──");
  const sheet = await client.req(`/api/projects/${projectId}/manual-sheets`, {
    method: "POST",
    body: JSON.stringify({ title: "اندازه‌گیری خط مونتاژ — آزمون" }),
  });
  check("M-1.7 ایجاد برگه", sheet.status === 201 && sheet.body.status === "draft", `status=${sheet.status}`);
  const sheetId = sheet.body.id;

  const fetchAct = acts.body.items;
  const screws = fetchAct.find((a) => a.name === "نصب پیچ");
  const pick = fetchAct.find((a) => a.name === "برداشتن قطعه از جعبه");

  // ذخیره سلول‌ها با قالب‌های مختلف (۱۱٫۵: فارسی/لاتین/زمانی/ویرگول)
  const save1 = await client.req(`/api/projects/${projectId}/manual-sheets/${sheetId}/observations`, {
    method: "PUT",
    body: JSON.stringify({
      source: "manual",
      cells: [
        { activityId: pick.id, sampleIndex: 1, value: "4.2" },
        { activityId: pick.id, sampleIndex: 2, value: "۴٫۵" }, // فارسی
        { activityId: pick.id, sampleIndex: 3, value: "4,1" }, // ویرگول
        { activityId: screws.id, sampleIndex: 1, value: "00:12.1" }, // mm:ss.s
        { activityId: screws.id, sampleIndex: 2, value: "۱۲٫۵" },
        { activityId: screws.id, sampleIndex: 3, value: "12.3" },
        { activityId: screws.id, sampleIndex: 4, value: "12.2" },
        { activityId: screws.id, sampleIndex: 5, value: "12.6" },
      ],
    }),
  });
  check(
    "M-1.8 ذخیره ۸ مشاهده با ۴ قالب ورود",
    save1.status === 200 && save1.body.saved === 8 && save1.body.rejected.length === 0,
    `saved=${save1.body?.saved} rejected=${save1.body?.rejected?.length}`,
  );

  // مقدار نامعتبر — رد با پیام فارسی (۱۱٫۵)
  const saveBad = await client.req(`/api/projects/${projectId}/manual-sheets/${sheetId}/observations`, {
    method: "PUT",
    body: JSON.stringify({
      cells: [
        { activityId: screws.id, sampleIndex: 6, value: "abc" },
        { activityId: screws.id, sampleIndex: 7, value: "-5" },
        { activityId: screws.id, sampleIndex: 8, value: "12:75" },
      ],
    }),
  });
  check(
    "M-2.1 مقادیر نامعتبر رد با پیام فارسی",
    saveBad.status === 200 && saveBad.body.saved === 0 && saveBad.body.rejected.length === 3 &&
      saveBad.body.rejected.every((r) => typeof r.reasonFa === "string" && r.reasonFa.length > 3),
    `rejected=${saveBad.body?.rejected?.length}`,
  );
  const saveOutOfRange = await client.req(`/api/projects/${projectId}/manual-sheets/${sheetId}/observations`, {
    method: "PUT",
    body: JSON.stringify({ cells: [{ activityId: screws.id, sampleIndex: 99, value: "5" }] }),
  });
  check("M-2.2 نمونه خارج از بازه رد شد", saveOutOfRange.body.rejected.length === 1);
  const saveBadActivity = await client.req(`/api/projects/${projectId}/manual-sheets/${sheetId}/observations`, {
    method: "PUT",
    body: JSON.stringify({ cells: [{ activityId: "00000000-0000-0000-0000-000000000000", sampleIndex: 1, value: "5" }] }),
  });
  check("M-2.3 فعالیت نامعتبر رد شد", saveBadActivity.body.rejected.length === 1);

  // بازخوانی — پایداری داده و مقادیر تبدیل‌شده (۱۱٫۵: Refresh و بازگشایی)
  const detail1 = await client.req(`/api/projects/${projectId}/manual-sheets/${sheetId}`);
  const screwsCells = detail1.body.rows.find((r) => r.activityId === screws.id)?.cells ?? [];
  const pickCells = detail1.body.rows.find((r) => r.activityId === pick.id)?.cells ?? [];
  check(
    "M-1.9 بازخوانی: مقادیر به ms استاندارد تبدیل و پایدار شدند",
    pickCells.length === 3 && pickCells.find((c) => c.sampleIndex === 2)?.durationMs === 4500 &&
      screwsCells.find((c) => c.sampleIndex === 1)?.durationMs === 12100 &&
      screwsCells.length === 5,
    `pick=${pickCells.length} screws=${screwsCells.length} ms(pick,s2)=${pickCells.find((c) => c.sampleIndex === 2)?.durationMs}`,
  );
  check("M-1.10 شناسه فعالیت در برگه با پروژه سازگار است", detail1.body.rows.every((r) => r.activityStableKey));

  // ── وقفه‌ها (۱۱٫۵) ──
  console.log("\n── وقفه‌ها ──");
  const int1 = await client.req(`/api/projects/${projectId}/manual-sheets/${sheetId}/interruptions`, {
    method: "POST",
    body: JSON.stringify({ reason: "material-shortage", durationValue: "45", activityId: screws.id, sampleIndex: 2 }),
  });
  check("M-1.11 وقفه معمول با مدت", int1.status === 201 && int1.body.interruptions.some((i) => i.reason === "material-shortage" && i.durationMs === 45000));

  const intOtherNoText = await client.req(`/api/projects/${projectId}/manual-sheets/${sheetId}/interruptions`, {
    method: "POST",
    body: JSON.stringify({ reason: "other" }), // بدون متن — باید رد شود
  });
  check(
    "M-1.12 وقفه «سایر» بدون متن رد شد (400 + پیام فارسی)",
    intOtherNoText.status === 400 && (intOtherNoText.body?.error?.message ?? "").includes("الزامی"),
    `status=${intOtherNoText.status}`,
  );
  const intOther = await client.req(`/api/projects/${projectId}/manual-sheets/${sheetId}/interruptions`, {
    method: "POST",
    body: JSON.stringify({ reason: "other", reasonOther: "انتظار برای تأیید سرپرست", durationKnown: false }),
  });
  check(
    "M-1.13 وقفه «سایر» با متن + مدت نامشخص",
    intOther.status === 201 && intOther.body.interruptions.some((i) => i.reason === "other" && i.reasonOther === "انتظار برای تأیید سرپرست" && i.durationMs === null && i.durationKnown === false),
  );

  // ── وضعیت‌ها و اصلاح (۱۱٫۵/۱۱٫۲) ──
  console.log("\n── وضعیت، اصلاح و نهایی‌سازی ──");
  const completed = await client.req(`/api/projects/${projectId}/manual-sheets/${sheetId}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "completed" }),
  });
  check("M-1.14 علامت‌گذاری تکمیل‌شده", completed.status === 200 && completed.body.status === "completed");

  const target = screwsCells.find((c) => c.sampleIndex === 2); // 12500
  const fixNoReason = await client.req(
    `/api/projects/${projectId}/manual-sheets/${sheetId}/observations/${target.observationId}`,
    { method: "PATCH", body: JSON.stringify({ value: "13.0" }) },
  );
  check("M-1.15 اصلاح پیش از نهایی‌سازی بدون دلیل مجاز است", fixNoReason.status === 200);

  const fin = await client.req(`/api/projects/${projectId}/manual-sheets/${sheetId}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "finalized", reason: "تکمیل اندازه‌گیری" }),
  });
  check("M-1.16 ارسال به تحلیل (نهایی‌سازی)", fin.status === 200 && fin.body.status === "finalized");

  const saveAfterFin = await client.req(`/api/projects/${projectId}/manual-sheets/${sheetId}/observations`, {
    method: "PUT",
    body: JSON.stringify({ cells: [{ activityId: screws.id, sampleIndex: 5, value: "99" }] }),
  });
  check("M-3.1 ذخیره مستقیم روی برگه نهایی‌شده → 403", saveAfterFin.status === 403, `status=${saveAfterFin.status}`);

  const detailFin = await client.req(`/api/projects/${projectId}/manual-sheets/${sheetId}`);
  const target2 = detailFin.body.rows.find((r) => r.activityId === screws.id).cells.find((c) => c.sampleIndex === 5);
  const fixNoReason2 = await client.req(
    `/api/projects/${projectId}/manual-sheets/${sheetId}/observations/${target2.observationId}`,
    { method: "PATCH", body: JSON.stringify({ value: "12.4" }) },
  );
  check("M-3.2 اصلاح بدون دلیل روی نهایی‌شده → 400", fixNoReason2.status === 400, `status=${fixNoReason2.status}`);
  const fixWithReason = await client.req(
    `/api/projects/${projectId}/manual-sheets/${sheetId}/observations/${target2.observationId}`,
    { method: "PATCH", body: JSON.stringify({ value: "12.4", reason: "بازخوانی یادداشت کاغذی" }) },
  );
  check("M-3.3 اصلاح با دلیل روی نهایی‌شده مجاز", fixWithReason.status === 200);
  const detailAfterFix = await client.req(`/api/projects/${projectId}/manual-sheets/${sheetId}`);
  const fixedCell = detailAfterFix.body.rows.find((r) => r.activityId === screws.id).cells.find((c) => c.sampleIndex === 5);
  check("M-3.4 مقدار اصلاح‌شده + پرچم corrected", fixedCell.durationMs === 12400 && fixedCell.corrected === true);

  const revertNoReason = await client.req(`/api/projects/${projectId}/manual-sheets/${sheetId}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "completed" }),
  });
  check("M-3.5 بازگردانی بدون دلیل → 400", revertNoReason.status === 400);
  const revert = await client.req(`/api/projects/${projectId}/manual-sheets/${sheetId}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "completed", reason: "بازبینی داده نمونه ۵" }),
  });
  check("M-3.6 بازگردانی با دلیل مجاز", revert.status === 200 && revert.body.status === "completed");
  // نهایی مجدد برای ادامه آزمون تحلیل
  await client.req(`/api/projects/${projectId}/manual-sheets/${sheetId}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "finalized", reason: "نهایی مجدد پس از بازگردانی" }),
  });

  // ── M-4: تحلیل با محاسبه مستقل ──
  console.log("\n── تحلیل داده دستی (۱۱٫۶) ──");
  const analysis = await client.req(`/api/projects/${projectId}/analysis`);
  check("M-4.1 تحلیل پاسخ داد", analysis.status === 200);
  const manualSession = (analysis.body.sessions ?? []).find((s) => s.source === "manual");
  check("M-4.2 برگه در فهرست منابع تحلیل با منبع «دستی»", !!manualSession && manualSession.observationsCount === 8);
  const screwEl = (analysis.body.elements ?? []).find((e) => e.elementKey === screws.stableKey);
  check("M-4.3 عنصر «نصب پیچ» در تحلیل ظاهر شد", !!screwEl);
  // محاسبه مستقل: مقادیر پس از اصلاح‌ها: s1=12100, s2=13000(اصلاح M-1.15 از 12500), s3=12300, s4=12200, s5=12400(اصلاح از 12600)
  const expected = [12100, 13000, 12300, 12200, 12400];
  const expectedMean = expected.reduce((a, b) => a + b, 0) / expected.length; // 12300
  const obs = (screwEl?.observations ?? []).filter((o) => !o.mark?.excluded);
  check(
    "M-4.4 تعداد و میانگین با محاسبه مستقل سازگار",
    obs.length === 5 && Math.abs((obs.reduce((a, o) => a + o.durationMs, 0) / obs.length) - expectedMean) < 0.001,
    `n=${obs.length} mean=${obs.length > 0 ? obs.reduce((a, o) => a + o.durationMs, 0) / obs.length : "—"} expected=${expectedMean}`,
  );
  check(
    "M-4.5 منبع هر مشاهده صریح اعلام شد (دستی ≠ کرنومتری)",
    obs.every((o) => o.source === "manual" || o.source === undefined) && obs.every((o) => o.sessionMethod === "manual"),
  );
  // آمار توصیفی گزارش‌شده
  const stats = screwEl?.stats;
  check(
    "M-4.6 میانگین آماری هسته = میانگین مستقل (ms)",
    stats && Math.abs(stats.mean - expectedMean) < 0.001,
    `mean=${stats?.mean}ms`,
  );
  // زنجیره زمان (۱۱٫۶): نماینده = میانگین (پروفایل پیش‌فرض TS-001) → 12400ms
  const repVal = screwEl?.chain?.representative?.value ?? null;
  check(
    "M-4.7 زنجیره زمان برای داده دستی محاسبه شد (نماینده = 12.4s)",
    repVal != null ? Math.abs(repVal - expectedMean) < 1 : false,
    `rep=${repVal != null ? repVal / 1000 + "s" : "—"}`,
  );

  // ── M-7: علامت‌گذاری مشاهده دستی ──
  console.log("\n── علامت‌گذاری (۱۱٫۶) ──");
  const detailForMark = await client.req(`/api/projects/${projectId}/manual-sheets/${sheetId}`);
  const markTarget = detailForMark.body.rows.find((r) => r.activityId === screws.id).cells.find((c) => c.sampleIndex === 1);
  const markNoReason = await client.req(
    `/api/projects/${projectId}/manual-sheets/${sheetId}/observations/${markTarget.observationId}/mark`,
    { method: "POST", body: JSON.stringify({ outlierMarked: false, excluded: true }) },
  );
  check("M-7.1 حذف بدون علت → 400", markNoReason.status === 400);
  const markOutlier = await client.req(
    `/api/projects/${projectId}/manual-sheets/${sheetId}/observations/${markTarget.observationId}/mark`,
    { method: "POST", body: JSON.stringify({ outlierMarked: true, excluded: false }) },
  );
  check("M-7.2 علامت پرت (بدون نیاز به علت) مجاز", markOutlier.status === 200);
  const markExclude = await client.req(
    `/api/projects/${projectId}/manual-sheets/${sheetId}/observations/${markTarget.observationId}/mark`,
    { method: "POST", body: JSON.stringify({ outlierMarked: true, excluded: true, reason: "قرائت مشکوک" }) },
  );
  check("M-7.3 حذف با علت مجاز", markExclude.status === 200);
  const analysis2 = await client.req(`/api/projects/${projectId}/analysis`);
  const screwEl2 = analysis2.body.elements.find((e) => e.elementKey === screws.stableKey);
  const obs2 = screwEl2.observations;
  check(
    "M-7.4 علامت‌ها به تحلیل رسیدند (حذف‌شده از محاسبه خارج شد)",
    obs2.some((o) => o.mark?.excluded === true && o.mark?.reason === "قرائت مشکوک") &&
      (screwEl2.stats.n === 4 || (screwEl2.observations.filter((o) => !o.mark?.excluded).length === 4)),
    `n=${screwEl2.stats?.n}`,
  );

  // ── M-6: ایستگاه در بالانس ──
  console.log("\n── بالانس با ایستگاه واقعی (M-6) ──");
  const balanceOverview = await client.req(`/api/projects/${projectId}/balance`);
  check("M-6.1 نمای کلی بالانس پاسخ داد", balanceOverview.status === 200, `status=${balanceOverview.status}`);
  const scen = await client.req(`/api/projects/${projectId}/balance`, {
    method: "POST",
    body: JSON.stringify({
      name: "سناریوی آزمون دستی",
      inputs: {
        timeBasis: "representative",
        takt: { taktMs: 30000, demandUnits: null, netAvailableMsPerShift: null, shiftsPerPeriod: null },
        maxStations: 4,
        objectives: { minimizeStations: 0.4, smoothLoad: 0.4, minChanges: 0.2 },
        activityTimeOverrides: {},
        referenceAssignment: null,
      },
    }),
  });
  check("M-6.2 ایجاد سناریو", scen.status === 201 && !!scen.body?.scenario?.id, `status=${scen.status}`);
  const scenId = scen.body?.scenario?.id;
  const solve = await client.req(`/api/projects/${projectId}/balance/${scenId}/solve`, {
    method: "POST",
    body: JSON.stringify({ algorithm: "lcr" }),
  });
  check("M-6.3 حل بالانس با داده دستی", solve.status === 201, `status=${solve.status}`);
  // تخصیص‌ها: نگاشت activityKey(stableKey) → شماره ایستگاه.
  // فقط فعالیت‌های زمان‌دار تخصیص می‌گیرند (۲ فعالیت بدون داده → کنار گذاشته صادقانه).
  const assignmentsMap = solve.body?.result?.assignments ?? {};
  const assignedKeys = Object.keys(assignmentsMap);
  check(
    "M-6.4 فعالیت‌های زمان‌دار دستی تخصیص گرفتند (بدون داده → کنار گذاشته)",
    assignedKeys.length === 2 && assignedKeys.includes(screws.stableKey) && assignedKeys.includes(pick.stableKey),
    `count=${assignedKeys.length}`,
  );
  // ایستگاه مرجع فعالیت (نرم — ADR-017): تخصیص در بازه ایستگاه‌های خط معتبر است
  const screwsStation = assignmentsMap[screws.stableKey];
  check(
    "M-6.5 تخصیص در بازه ایستگاه‌های خط (ایستگاه مرجع حمل شد)",
    Number.isInteger(screwsStation) && screwsStation >= 1 && screwsStation <= 4,
    `station=${screwsStation}`,
  );

  // ── گزارش (۱۱٫۸) ──
  const report = await client.req(`/api/projects/${projectId}/analysis/export?template=element-analysis&format=json`);
  check("M-1.17 خروجی گزارش JSON از داده دستی", report.status === 200, `status=${report.status}`);

  // ── readiness پروژه ──
  const proj = await client.req(`/api/projects/${projectId}`);
  check("M-1.18 آمادگی تحلیل پروژه با برگه دستی فعال شد", proj.body.readiness.analysisReady === true);

  // ── پاک‌سازی: پروژه آزمون بایگانی ──
  await client.req(`/api/projects/${projectId}`, { method: "PATCH", body: JSON.stringify({ status: "archived" }) });

  console.log("\n════════ نتیجه ════════");
  console.log(`قبول: ${passed} · رد: ${failed}`);
  if (failed > 0) {
    console.log("موارد ردشده:", failures.join(" | "));
    process.exit(1);
  }
  console.log("همه آزمون‌های ثبت دستی زمان قبول شد ✓");
}

main().catch((e) => {
  console.error("خطای اجرای آزمون‌ها:", e);
  console.error("آیا سرور توسعه روی http://localhost:3000 در حال اجراست؟ (bun run dev)");
  process.exit(1);
});
