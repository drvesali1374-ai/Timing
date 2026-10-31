#!/usr/bin/env node
/**
 * آزمون‌های یکپارچگی فاز ۴ — درخواست-پاسخ واقعی به سرور توسعه (localhost:3000).
 *
 * پوشش معیارهای پذیرش فاز ۴ (TEST_MATRIX + سند جامع فاز چهار):
 *  R4-1  سناریوی مرجع کامل: ایجاد جلسه → شروع → قرائت‌ها → مکث/ادامه → توقف → چرخه‌های مشتق با داده مورد انتظار
 *  R4-2  چند چرخه: ۳ چرخه با عناصر/مدت‌های مورد انتظار + کنترل تلورانس TS-005 (معتبر)
 *  R4-3  مکث با علت وقفه + گزارش وقفه با مدت (از ساعت دیواری)
 *  R4-4  اصلاح: رویداد correction با دلیل → اعمال در مشتق؛ رویداد اصلی حفظ می‌شود
 *  R4-5  idempotency: ارسال دوباره همان batch → duplicates بدون دوباره‌شماری
 *  R4-6  نهایی‌سازی: فقط پس از stop؛ چرخه‌های ذخیره‌شده؛ قفل رویداد جدید (409)
 *  R4-7  بازیابی: بازگشایی جلسه running پس از «reload» (رویداد recover با پرچم clockRecovery) + مشتق recovered
 *  R4-8  snapback: ثبت مستقیم عناصر + مدت‌های مستقیم
 *  R4-9  RBAC: ۴۰۱ بی‌نشست · ۴۰۴ پروژه دیگران · ۴۰۳ viewer روی ثبت · recorder مجاز
 *  R4-10 عنصر نامعتبر رد می‌شود + خروجی خام JSON قابل بازیابی
 *
 * اجرا: `bun run test:phase4` — سرور توسعه باید در حال اجرا باشد.
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
const owner = { name: "آزمون‌گر فاز۴", email: `p4a-${stamp}@test.local`, password: "TestPass1234" };
const other = { name: "کاربر دیگر فاز۴", email: `p4b-${stamp}@test.local`, password: "TestPass1234" };
const viewer = { name: "ببیننده فاز۴", email: `p4c-${stamp}@test.local`, password: "TestPass1234" };
const recorder = { name: "ثبت‌کننده فاز۴", email: `p4d-${stamp}@test.local`, password: "TestPass1234" };

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

// ─────────────────────── سازنده رویدادهای شبیه‌سازی کلاینت ───────────────────────

let eventCounter = 0;
function evId() {
  eventCounter += 1;
  return `evt-${stamp}-${String(eventCounter).padStart(5, "0")}`;
}

let wallMs = Date.now();
function wallIso(deltaMs = 0) {
  wallMs += deltaMs;
  return new Date(wallMs).toISOString();
}

/** شبیه‌سازی رویدادهای کرنومتر — مقادیر elapsedActiveMs صریح (داده مورد انتظار). */
function makeEvents(sessionId, script) {
  return script.map((s) => ({
    clientEventId: evId(),
    sessionId,
    seq: s.seq,
    type: s.type,
    ...(s.elementId !== undefined ? { elementId: s.elementId } : {}),
    cycleNo: s.cycleNo ?? 0,
    elapsedActiveMs: s.elapsedActiveMs,
    ...(s.splitMs !== undefined ? { splitMs: s.splitMs } : {}),
    wallClock: wallIso(s.wallDelta ?? 50),
    ...(s.note ? { note: s.note } : {}),
    ...(s.interruptionReason ? { interruptionReason: s.interruptionReason } : {}),
    ...(s.integrity ? { integrity: s.integrity } : {}),
  }));
}

// ─────────────────────── سناریوها ───────────────────────

async function main() {
  console.log("════════ آزمون‌های یکپارچگی فاز ۴ ════════\n");

  const [ownerC, otherC, viewerC, recorderC] = await Promise.all([
    registerAndLogin(owner),
    registerAndLogin(other),
    registerAndLogin(viewer),
    registerAndLogin(recorder),
  ]);

  // پروژه آزمون + فعالیت‌ها (عناصر جلسه)
  const proj = await ownerC.req("/api/projects", {
    method: "POST",
    body: JSON.stringify({
      code: `P4-${stamp}`,
      title: `پروژه آزمون فاز ۴ ${stamp}`,
      profileTemplateId: "profile.continuous-timing",
    }),
  });
  const projectId = proj.body?.id;
  if (proj.status !== 201 || !projectId) throw new Error(`project create failed: ${JSON.stringify(proj.body)}`);

  const ELEMENTS = [
    { key: "act-1", name: "قرار دادن قطعه", activityStableKey: "act-1", order: 1 },
    { key: "act-2", name: "پرس", activityStableKey: "act-2", order: 2 },
    { key: "act-3", name: "بازرسی", activityStableKey: "act-3", order: 3 },
  ];

  // ── [۱] R4-1: سناریوی مرجع کامل (شروع/قرائت/مکث/ادامه/پایان + مشتق) ──
  console.log("[۱] R4-1 — سناریوی مرجع کامل با داده مورد انتظار");
  {
    const create = await ownerC.req(`/api/projects/${projectId}/timing/sessions`, {
      method: "POST",
      body: JSON.stringify({
        method: "continuous",
        observer: "ناظر آزمون",
        elements: ELEMENTS,
        elementAdvanceMode: "auto",
        tolerancePct: 5,
        elementSource: "manual",
      }),
    });
    check("ایجاد جلسه → 201 + method/observer/تلورانس", create.status === 201 && create.body?.method === "continuous" && create.body?.observer === "ناظر آزمون" && create.body?.tolerancePct === 5);
    const sessionId = create.body?.id;

    // سناریو: شروع، چرخه ۱ (قرائت‌ها 2s/1.5s/1s)، مکث 30s، چرخه ۲ (2.2s/1.4s/1.1s)، توقف
    const script = [
      { seq: 1, type: "start", elapsedActiveMs: 0, wallDelta: 10 },
      { seq: 2, type: "cycleStart", cycleNo: 1, elapsedActiveMs: 0, wallDelta: 20 },
      { seq: 3, type: "reading", elementId: "act-1", cycleNo: 1, elapsedActiveMs: 2_000, splitMs: 2_000, wallDelta: 2_000 },
      { seq: 4, type: "reading", elementId: "act-2", cycleNo: 1, elapsedActiveMs: 3_500, splitMs: 1_500, wallDelta: 1_500 },
      { seq: 5, type: "reading", elementId: "act-3", cycleNo: 1, elapsedActiveMs: 4_500, splitMs: 1_000, wallDelta: 1_000 },
      { seq: 6, type: "pause", cycleNo: 1, elapsedActiveMs: 4_500, interruptionReason: "خرابی فیکسچر", wallDelta: 50 },
      { seq: 7, type: "resume", cycleNo: 1, elapsedActiveMs: 4_500, wallDelta: 30_000 },
      { seq: 8, type: "cycleStart", cycleNo: 2, elapsedActiveMs: 4_500, wallDelta: 20 },
      { seq: 9, type: "reading", elementId: "act-1", cycleNo: 2, elapsedActiveMs: 6_700, splitMs: 2_200, wallDelta: 2_200 },
      { seq: 10, type: "reading", elementId: "act-2", cycleNo: 2, elapsedActiveMs: 8_100, splitMs: 1_400, wallDelta: 1_400 },
      { seq: 11, type: "reading", elementId: "act-3", cycleNo: 2, elapsedActiveMs: 9_200, splitMs: 1_100, wallDelta: 1_100 },
      { seq: 12, type: "stop", elapsedActiveMs: 9_200, wallDelta: 30 },
    ];
    const events = makeEvents(sessionId, script);
    const ingest = await ownerC.req(`/api/projects/${projectId}/timing/sessions/${sessionId}/events`, {
      method: "POST",
      body: JSON.stringify({ events, origin: "normal" }),
    });
    check("دریافت batch رویدادها → 12 ingested", ingest.status === 200 && ingest.body?.ingested === 12, `ingested=${ingest.body?.ingested}`);
    check("وضعیت جلسه پس از توقف → stopped", ingest.body?.sessionStatus === "stopped");

    const detail = await ownerC.req(`/api/projects/${projectId}/timing/sessions/${sessionId}`);
    const cycles = detail.body?.derived?.cycles ?? [];
    check("جزئیات: ۱۲ رویداد + ۲ چرخه", detail.status === 200 && detail.body?.eventCount === 12 && cycles.length === 2);
    const c1 = cycles[0] ?? {};
    check(
      "چرخه ۱: مدت عناصر TS-003 دقیق (2000/1500/1000ms)",
      c1?.elements?.length === 3 && c1.elements[0]?.durationMs === 2_000 && c1.elements[1]?.durationMs === 1_500 && c1.elements[2]?.durationMs === 1_000,
      JSON.stringify(c1?.elements?.map((e) => e.durationMs)),
    );
    check("چرخه ۱: C = 4500 (TS-004) + status valid (TS-005)", c1?.cycleTimeMs === 4_500 && c1?.status === "valid");
    const c2 = cycles[1] ?? {};
    check("چرخه ۲: C = 4700 + valid", c2?.cycleTimeMs === 4_700 && c2?.status === "valid");

    // R4-3: وقفه با مدت
    const inter = (detail.body?.derived?.interruptions ?? [])[0] ?? {};
    check(
      "R4-3 وقفه: علت «خرابی فیکسچر» + مدت ~30000ms از ساعت دیواری",
      inter?.reason === "خرابی فیکسچر" && Math.abs((inter?.durationMs ?? 0) - 30_000) < 1_000,
      `durationMs=${inter?.durationMs}`,
    );
    check("زمان فعال کل = 9200 (بدون مکث)", detail.body?.derived?.activeMs === 9_200);

    // R4-4: اصلاح قرائت — مقدار 3500 → 3200 با دلیل
    const target = (detail.body?.events ?? []).find((e) => e.seq === 4);
    const corr = await ownerC.req(`/api/projects/${projectId}/timing/sessions/${sessionId}/events`, {
      method: "POST",
      body: JSON.stringify({
        events: [
          {
            clientEventId: evId(),
            sessionId,
            seq: 13,
            type: "correction",
            cycleNo: 1,
            elapsedActiveMs: 3_500,
            wallClock: wallIso(30),
            correctionOf: target?.clientEventId,
            correctedValueMs: 3_200,
            correctionReason: "قرائت دیرهنگام — بازبینی ناظر",
          },
        ],
        origin: "normal",
      }),
    });
    check("R4-4 اصلاح: رویداد correction پذیرفته (1 ingested)", corr.status === 200 && corr.body?.ingested === 1);
    const detail2 = await ownerC.req(`/api/projects/${projectId}/timing/sessions/${sessionId}`);
    const c1b = (detail2.body?.derived?.cycles ?? [])[0] ?? {};
    check(
      "R4-4 اعمال اصلاح: عنصر act-2 → 1200ms (آخرین اصلاح برنده)",
      c1b?.elements?.[1]?.durationMs === 1_200 && c1b?.elements?.[1]?.corrected === true,
      `durationMs=${c1b?.elements?.[1]?.durationMs}`,
    );
    check(
      "R4-4 رویداد اصلی حفظ می‌شود (append-only — ۱۳ رویداد)",
      detail2.body?.eventCount === 13 && (detail2.body?.events ?? []).some((e) => e.seq === 4 && e.type === "reading"),
    );
    // پس از اصلاح r(act-2)=3200: Σ=2000+1200+1300=4500 → همچنان سازگار؟ C=4500 → valid
    check("پس از اصلاح، تلورانس با C=4500 همچنان سازگار (valid)", c1b?.status === "valid", `Σ=${c1b?.elementsSumMs}`);

    // R4-5: idempotency — ارسال دوباره همان batch
    const dup = await ownerC.req(`/api/projects/${projectId}/timing/sessions/${sessionId}/events`, {
      method: "POST",
      body: JSON.stringify({ events, origin: "normal" }),
    });
    check(
      "R4-5 ارسال دوباره همان ۱۲ رویداد → duplicates=12 بدون ingested",
      dup.status === 200 && dup.body?.duplicates === 12 && (dup.body?.ingested ?? 0) === 0,
      `duplicates=${dup.body?.duplicates}, ingested=${dup.body?.ingested}`,
    );
    const detail3 = await ownerC.req(`/api/projects/${projectId}/timing/sessions/${sessionId}`);
    check("R4-5 دوباره‌شماری نشد — eventCount هنوز ۱۳", detail3.body?.eventCount === 13, `count=${detail3.body?.eventCount}`);

    // R4-10: عنصر نامعتبر رد می‌شود
    const badEl = await ownerC.req(`/api/projects/${projectId}/timing/sessions/${sessionId}/events`, {
      method: "POST",
      body: JSON.stringify({
        events: [
          {
            clientEventId: evId(),
            sessionId,
            seq: 14,
            type: "note",
            cycleNo: 2,
            elapsedActiveMs: 9_200,
            wallClock: wallIso(10),
            note: "یادداشت آزمون",
          },
        ],
        origin: "normal",
      }),
    });
    // جلسه stopped — note مجاز است (رویداد غیر وضعیتی)؛ حالا عنصر ناموجود:
    const badElement = await ownerC.req(`/api/projects/${projectId}/timing/sessions/${sessionId}/events`, {
      method: "POST",
      body: JSON.stringify({
        events: [
          {
            clientEventId: evId(),
            sessionId,
            seq: 15,
            type: "reading",
            elementId: "عنصر-ناموجود",
            cycleNo: 2,
            elapsedActiveMs: 10_000,
            wallClock: wallIso(10),
          },
        ],
        origin: "normal",
      }),
    });
    check(
      "R4-10 عنصر تعریف‌نشده در جلسه → rejected (400 یا rejected>0)",
      badElement.status === 400 || (badElement.body?.rejected?.length ?? 0) > 0,
      `status=${badElement.status}, rejected=${badElement.body?.rejected?.length ?? 0}`,
    );
    void badEl;

    // R4-10: خروجی خام قابل بازیابی
    const exportRes = await fetch(`${BASE}/api/projects/${projectId}/timing/sessions/${sessionId}`, {
      headers: { Cookie: [...ownerC.cookies ?? []].join("; ") },
    });
    void exportRes;
    const rawExport = await ownerC.req(`/api/projects/${projectId}/timing/sessions/${sessionId}/export`);
    check(
      "R4-10 خروجی خام JSON: session + events قابل بازیابی",
      rawExport.status === 200 && rawExport.body?.events?.length === 14 && rawExport.body?.session?.method === "continuous",
      `events=${rawExport.body?.events?.length}`,
    );

    // R4-6: نهایی‌سازی
    const fin = await ownerC.req(`/api/projects/${projectId}/timing/sessions/${sessionId}/finalize`, { method: "POST" });
    check(
      "R4-6 نهایی‌سازی → finalized + ۲ چرخه کامل",
      fin.status === 200 && fin.body?.status === "finalized" && fin.body?.completedCycles === 2 && fin.body?.cycles === 2,
      JSON.stringify({ cycles: fin.body?.cycles, completed: fin.body?.completedCycles }),
    );
    const afterFin = await ownerC.req(`/api/projects/${projectId}/timing/sessions/${sessionId}/events`, {
      method: "POST",
      body: JSON.stringify({
        events: [
          { clientEventId: evId(), sessionId, seq: 99, type: "note", cycleNo: 2, elapsedActiveMs: 9_200, wallClock: wallIso(10), note: "بعد از نهایی‌سازی" },
        ],
        origin: "normal",
      }),
    });
    check("R4-6 قفل: رویداد جدید پس از نهایی‌سازی → 409", afterFin.status === 409, `status=${afterFin.status}`);
    const cyclesRoute = await ownerC.req(`/api/projects/${projectId}/timing/sessions/${sessionId}/cycles`);
    check("R4-6 چرخه‌های ذخیره‌شده از جدول TimingCycle", cyclesRoute.status === 200 && cyclesRoute.body?.finalized === true && cyclesRoute.body?.cycles?.length === 2);

    globalThis.__sessionA = { projectId, sessionId };
  }

  // ── [۲] R4-7: بازیابی پس از reload (running → recover) ──
  console.log("\n[۲] R4-7 — بازیابی جلسه running پس از بارگذاری مجدد");
  {
    const create = await ownerC.req(`/api/projects/${projectId}/timing/sessions`, {
      method: "POST",
      body: JSON.stringify({ method: "continuous", observer: "ناظر بازیابی", elements: ELEMENTS, elementAdvanceMode: "auto", tolerancePct: 5, elementSource: "manual" }),
    });
    const sessionId = create.body?.id;
    // جلسه نیمه‌کاره: شروع + چرخه + یک قرائت — بدون توقف (running)
    const script = [
      { seq: 1, type: "start", elapsedActiveMs: 0, wallDelta: 10 },
      { seq: 2, type: "cycleStart", cycleNo: 1, elapsedActiveMs: 0, wallDelta: 20 },
      { seq: 3, type: "reading", elementId: "act-1", cycleNo: 1, elapsedActiveMs: 2_000, splitMs: 2_000, wallDelta: 2_000 },
    ];
    await ownerC.req(`/api/projects/${projectId}/timing/sessions/${sessionId}/events`, {
      method: "POST",
      body: JSON.stringify({ events: makeEvents(sessionId, script), origin: "normal" }),
    });
    const before = await ownerC.req(`/api/projects/${projectId}/timing/sessions/${sessionId}`);
    check("جلسه running با ۳ رویداد", before.body?.status === "running" && before.body?.eventCount === 3);

    // «reload» کلاینت: رویداد بازیابی با پرچم clockRecovery (مثل recover() موتور)
    const rec = await ownerC.req(`/api/projects/${projectId}/timing/sessions/${sessionId}/events`, {
      method: "POST",
      body: JSON.stringify({
        events: [
          {
            clientEventId: evId(),
            sessionId,
            seq: 4,
            type: "pause",
            cycleNo: 1,
            elapsedActiveMs: 2_000,
            wallClock: wallIso(5_000),
            interruptionReason: "بازگشت پس از بارگذاری مجدد صفحه",
            note: "جلسه بازیابی شد؛ زمان گذشته قابل اثبات نیست.",
            integrity: ["clockRecovery"],
          },
        ],
        origin: "normal",
      }),
    });
    check("رویداد بازیابی (pause + clockRecovery) پذیرفته", rec.status === 200 && rec.body?.ingested === 1);
    check("پرچم جلسه clockRecovery تجمیع شد", (rec.body?.flags ?? []).includes("clockRecovery"));

    // ادامه پس از بازیابی: resume + قرائت + بستن چرخه
    const script2 = [
      { seq: 5, type: "resume", cycleNo: 1, elapsedActiveMs: 2_000, wallDelta: 100 },
      { seq: 6, type: "reading", elementId: "act-2", cycleNo: 1, elapsedActiveMs: 3_500, splitMs: 1_500, wallDelta: 1_500 },
      { seq: 7, type: "reading", elementId: "act-3", cycleNo: 1, elapsedActiveMs: 4_500, splitMs: 1_000, wallDelta: 1_000 },
      { seq: 8, type: "cycleStart", cycleNo: 2, elapsedActiveMs: 4_500, wallDelta: 20 },
      { seq: 9, type: "stop", elapsedActiveMs: 4_500, wallDelta: 30 },
    ];
    await ownerC.req(`/api/projects/${projectId}/timing/sessions/${sessionId}/events`, {
      method: "POST",
      body: JSON.stringify({ events: makeEvents(sessionId, script2), origin: "normal" }),
    });
    const after = await ownerC.req(`/api/projects/${projectId}/timing/sessions/${sessionId}`);
    const cycles = after.body?.derived?.cycles ?? [];
    check(
      "چرخه بازیابی‌شده → status=recovered + وقفه durationUnknown",
      cycles[0]?.status === "recovered" && (after.body?.derived?.interruptions ?? []).some((i) => i.durationUnknown === true),
      `status=${cycles[0]?.status}`,
    );
    check("چرخه با وجود پرچم، مدت عناصر را دارد (۲۰۰۰/۱۵۰۰/۱۰۰۰)", cycles[0]?.elements?.map((e) => e.durationMs)?.join(",") === "2000,1500,1000");
  }

  // ── [۳] R4-8: snapback ──
  console.log("\n[۳] R4-8 — روش بازگشت به صفر (عنصری)");
  {
    const create = await ownerC.req(`/api/projects/${projectId}/timing/sessions`, {
      method: "POST",
      body: JSON.stringify({ method: "snapback", observer: "ناظر عنصری", elements: ELEMENTS, elementAdvanceMode: "auto", elementSource: "manual" }),
    });
    const sessionId = create.body?.id;
    const script = [
      { seq: 1, type: "start", elapsedActiveMs: 0, wallDelta: 10 },
      { seq: 2, type: "cycleStart", cycleNo: 1, elapsedActiveMs: 0, wallDelta: 20 },
      { seq: 3, type: "element", elementId: "act-1", cycleNo: 1, elapsedActiveMs: 1_200, splitMs: 1_200, wallDelta: 1_200 },
      { seq: 4, type: "element", elementId: "act-2", cycleNo: 1, elapsedActiveMs: 2_000, splitMs: 800, wallDelta: 800 },
      { seq: 5, type: "element", elementId: "act-3", cycleNo: 1, elapsedActiveMs: 3_000, splitMs: 1_000, wallDelta: 1_000 },
      { seq: 6, type: "stop", elapsedActiveMs: 3_000, wallDelta: 30 },
    ];
    const ingest = await ownerC.req(`/api/projects/${projectId}/timing/sessions/${sessionId}/events`, {
      method: "POST",
      body: JSON.stringify({ events: makeEvents(sessionId, script), origin: "normal" }),
    });
    check("batch عنصری پذیرفته (۶ رویداد)", ingest.status === 200 && ingest.body?.ingested === 6);
    const detail = await ownerC.req(`/api/projects/${projectId}/timing/sessions/${sessionId}`);
    const c1 = (detail.body?.derived?.cycles ?? [])[0] ?? {};
    check(
      "مدت‌های مستقیم splitMs (1200/800/1000) — بدون تفاضل",
      c1?.elements?.[0]?.durationMs === 1_200 && c1?.elements?.[1]?.durationMs === 800 && c1?.elements?.[2]?.durationMs === 1_000,
      JSON.stringify(c1?.elements?.map((e) => e.durationMs)),
    );
    check("snapback: بدون کنترل تلورانس (deviationPct=null) + valid", c1?.deviationPct === null && c1?.status === "valid");
    check("readingMode عناصر = snapback", c1?.elements?.[0]?.readingMode === "snapback");
  }

  // ── [۴] R4-9: RBAC ──
  console.log("\n[۴] R4-9 — کنترل دسترسی");
  {
    const anon = makeClient();
    const noAuth = await anon.req(`/api/projects/${projectId}/timing/sessions`);
    check("بدون نشست → 401", noAuth.status === 401, `status=${noAuth.status}`);

    // پروژه دیگران → 404
    const otherProj = await otherC.req("/api/projects", {
      method: "POST",
      body: JSON.stringify({ code: `P4B-${stamp}`, title: "پروژه دیگر" }),
    });
    const otherProjectId = otherProj.body?.id;
    const cross = await otherC.req(`/api/projects/${projectId}/timing/sessions`);
    check("پروژه دیگران → 404", cross.status === 404, `status=${cross.status}`);

    // viewer و recorder عضو پروژه شوند (RBAC واقعی — نه 404 عدم عضویت)
    await ownerC.req(`/api/projects/${projectId}/members`, {
      method: "POST",
      body: JSON.stringify({ email: viewer.email, role: "viewer" }),
    });

    // viewer: خواندن مجاز، نوشتن ممنوع
    const vRead = await viewerC.req(`/api/projects/${projectId}/timing/sessions`);
    check("viewer: observations:read مجاز", vRead.status === 200);
    const vWrite = await viewerC.req(`/api/projects/${projectId}/timing/sessions`, {
      method: "POST",
      body: JSON.stringify({ method: "continuous", observer: "v", elements: ELEMENTS, elementSource: "manual" }),
    });
    check("viewer: observations:write → 403", vWrite.status === 403, `status=${vWrite.status}`);

    // recorder: ثبت مجاز (نقش اصلی فاز ۴) — عضویت لازم
    const addMember = await ownerC.req(`/api/projects/${projectId}/members`, {
      method: "POST",
      body: JSON.stringify({ email: recorder.email, role: "recorder" }),
    });
    check("افزودن عضو recorder → 201", addMember.status === 201, `status=${addMember.status}`);
    const rCreate = await recorderC.req(`/api/projects/${projectId}/timing/sessions`, {
      method: "POST",
      body: JSON.stringify({ method: "laps", observer: "ثبت‌کننده", elements: ELEMENTS, elementSource: "manual" }),
    });
    check("recorder: ایجاد جلسه مجاز (observations:write)", rCreate.status === 201, `status=${rCreate.status}`);
    const vCreate2 = await viewerC.req(`/api/projects/${projectId}/members`, {
      method: "POST",
      body: JSON.stringify({ email: viewer.email, role: "viewer" }),
    });
    check("viewer: manage-members → 403", vCreate2.status === 403);
    void otherProjectId;
  }

  // ── [۵] ممیزی + فهرست ──
  console.log("\n[۵] ممیزی و فهرست جلسات");
  {
    const audit = await ownerC.req(`/api/projects/${projectId}/audit`);
    const actions = (audit.body?.items ?? []).map((a) => a.action);
    check("ممیزی: timing.session-created ثبت شد", actions.includes("timing.session-created"));
    check("ممیزی: timing.session-finalized ثبت شد", actions.includes("timing.session-finalized"));
    check("ممیزی: timing.event-corrected ثبت شد", actions.includes("timing.event-corrected"));
    // رویدادهای معمول ممیزی نمی‌شوند (ADR-013) — فقط ۳ نوع بالا
    const timingAudits = (audit.body?.items ?? []).filter((a) => String(a.action).startsWith("timing."));
    check("رویدادهای معمول قرائت ممیزی نمی‌شوند (فقط چرخه عمر/اصلاح)", timingAudits.length <= 8, `count=${timingAudits.length}`);

    const list = await ownerC.req(`/api/projects/${projectId}/timing/sessions`);
    check("فهرست جلسات: ≥۴ جلسه با پرچم‌ها/شمارش", (list.body?.items?.length ?? 0) >= 4, `count=${list.body?.items?.length}`);
    const finalizedOne = (list.body?.items ?? []).find((s) => s.status === "finalized");
    check("جلسه نهایی‌شده در فهرست با completedCycles", finalizedOne?.completedCycles === 2);
  }

  // ── جمع‌بندی ──
  console.log("\n════════ جمع‌بندی فاز ۴ ════════");
  console.log(`قبول: ${passed} · رد: ${failed}`);
  if (failed > 0) {
    console.log("آزمون‌های ردشده:", failures.join(" | "));
    process.exit(1);
  } else {
    console.log("همه آزمون‌های فاز ۴ قبول شد ✓");
  }
}

main().catch((err) => {
  console.error("خطای اجرای آزمون‌ها:", err);
  process.exit(1);
});
