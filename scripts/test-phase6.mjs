#!/usr/bin/env node
/**
 * آزمون‌های یکپارچگی فاز ۶ — درخواست-پاسخ واقعی به سرور توسعه (localhost:3000).
 *
 * پوشش معیارهای پذیرش فاز ۶ (TEST_MATRIX R6-1/2/3 + دستورهای ۱۰گانه):
 *  R6-1  راه‌حل‌ها هرگز قید تقدم را بی‌گزارش نقض نکنند:
 *        اعتبارسنجی فعالیت‌ها چرخه را رد می‌کند (B5) + راهکارهای الگوریتمی بدون
 *        نقض تقدم + تخصیص دستی نامعتبر → ۴۲۲ با دلیل هر نقض (نه بی‌صدا).
 *  R6-2  شاخص‌ها با محاسبه مستقل تطبیق کند:
 *        مسیر کامل فعالیت‌ها ← جلسه زمان‌سنجی نهایی‌شده ← تحلیل فاز ۵ (نماینده)
 *        ← بالانس با جواب دست‌محاسبه (تاکت ۶۰ث):
 *          S1={m,a}=50 · S2={b,d}=50 · S3={c,e}=55 · m=3 · C=55 · E=150/(3×55)=90.909٪
 *          mMin=ceil(150/60)=3 · نیروی نظری=ceil(120/60)=2 (زمان ماشین جمع نمی‌شود!) · عملیاتی=3
 *  R6-3  تخصیص دستی با اعتبارسنجی فوری: معتبر → ذخیره + بازمحاسبه شاخص‌ها؛
 *        نامعتبر → ۴۲۲ با فهرست دلیل؛ اضافه‌بار ظرفیت → ذخیره با پرچم (نه رد بی‌صدا).
 *  بند ۱  تاکت از تقاضا: ۲۷۰۰۰ث خالص × ۲ شیفت ÷ ۴۸۰ واحد = ۱۱۲٫۵ث.
 *  بند ۳  سه الگوریتم اجرا و مقایسه می‌شوند (LCR/RPW/KW) + تمایز خروجی.
 *  بند ۵  چند سناریو + تاریخچه append-only نتایج + تابع هدف وزنی.
 *  بند ۷  مبنای override + فعالیت هم‌پوشان: به بار سریال جمع نمی‌شود (گزارش جدا).
 *  بند ۸  خروجی CSV (BOM فارسی) / XLS (RTL) / JSON (ردیابی) + ممیزی خروجی.
 *  RBAC   viewer خواندن مجاز · recorder حل ۴۰۳ · viewer export مجاز.
 *  جداسازی سناریوی پروژه دیگر → ۴۰۴.
 *
 * اجرا: `bun run test:phase6` — سرور توسعه باید در حال اجرا باشد.
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
      return { status: res.status, body, headers: res.headers };
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
      return res.status >= 200 && res.status < 400;
    },
    async raw(path) {
      const res = await fetch(BASE + path, {
        headers: cookies.size > 0 ? { Cookie: cookieHeader() } : {},
        redirect: "manual",
      });
      const buf = Buffer.from(await res.arrayBuffer());
      return { status: res.status, headers: res.headers, text: buf.toString("utf-8"), bytes: buf };
    },
  };
}

const stamp = Date.now();
const owner = { name: "آزمون‌گر فاز۶", email: `p6a-${stamp}@test.local`, password: "TestPass1234" };
const viewer = { name: "ببیننده فاز۶", email: `p6b-${stamp}@test.local`, password: "TestPass1234" };
const recorder = { name: "ثبت‌کننده فاز۶", email: `p6c-${stamp}@test.local`, password: "TestPass1234" };

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

let eventCounter = 0;
function evId() {
  eventCounter += 1;
  return `evt6-${stamp}-${String(eventCounter).padStart(5, "0")}`;
}

let wallMs = Date.now();
function wallIso(deltaMs = 0) {
  wallMs += deltaMs;
  return new Date(wallMs).toISOString();
}

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
  }));
}

async function makeFinalizedSession(client, projectId, elements, cyclesSpec) {
  const create = await client.req(`/api/projects/${projectId}/timing/sessions`, {
    method: "POST",
    body: JSON.stringify({
      method: "continuous",
      observer: "ناظر بالانس",
      elements,
      elementAdvanceMode: "auto",
      tolerancePct: 5,
      elementSource: "manual",
    }),
  });
  const sid = create.body?.id;
  const script = [{ seq: 1, type: "start", elapsedActiveMs: 0, wallDelta: 10 }];
  let seq = 2;
  let elapsed = 0;
  let cycleNo = 0;
  for (const cyc of cyclesSpec) {
    cycleNo += 1;
    script.push({ seq: seq++, type: "cycleStart", cycleNo, elapsedActiveMs: elapsed, wallDelta: 20 });
    for (let i = 0; i < elements.length; i += 1) {
      const ms = cyc[i];
      elapsed += ms;
      script.push({
        seq: seq++,
        type: "reading",
        elementId: elements[i].key,
        cycleNo,
        elapsedActiveMs: elapsed,
        splitMs: ms,
        wallDelta: ms,
      });
    }
  }
  script.push({ seq: seq++, type: "stop", elapsedActiveMs: elapsed, wallDelta: 30 });
  await client.req(`/api/projects/${projectId}/timing/sessions/${sid}/events`, {
    method: "POST",
    body: JSON.stringify({ events: makeEvents(sid, script), origin: "normal" }),
  });
  const fin = await client.req(`/api/projects/${projectId}/timing/sessions/${sid}/finalize`, { method: "POST" });
  return { sid, finalize: fin };
}

const A = (id, name, workType, preds = []) => ({ id, name, workType, preds });

/** فعالیت‌های مرجع — ۵ دستی + ۱ ماشینی (بند ۷) */
const ACTIVITIES = [
  A("bal.a", "فعالیت الف", "operatorManual"),
  A("bal.b", "فعالیت ب", "operatorManual"),
  A("bal.c", "فعالیت ج", "operatorManual", ["bal.a"]),
  A("bal.d", "فعالیت د", "operatorManual", ["bal.b"]),
  A("bal.e", "فعالیت ه", "operatorManual", ["bal.c", "bal.d"]),
  A("bal.m", "کار ماشین", "machineAuto"),
];

/** عناصر جلسه = کلید فعالیت‌ها؛ ۲ چرخه با قرائت‌های حول هدف:
 *  representative = میانگین: a=20s, b=15s, c=25s, d=35s, e=30s, m=30s
 */
const ELEMENTS = ACTIVITIES.map((a, i) => ({ key: a.id, name: a.name, order: i + 1 }));
const CYCLES = [
  [19000, 14000, 24000, 34000, 29000, 29000],
  [21000, 16000, 26000, 36000, 31000, 31000],
];

async function main() {
  console.log("════════ آزمون‌های یکپارچگی فاز ۶ ════════\n");

  const [ownerC, viewerC, recorderC] = await Promise.all([
    registerAndLogin(owner),
    registerAndLogin(viewer),
    registerAndLogin(recorder),
  ]);

  // پروژه آزمون
  const proj = await ownerC.req("/api/projects", {
    method: "POST",
    body: JSON.stringify({
      code: `P6-${stamp}`,
      title: `پروژه آزمون فاز ۶ ${stamp}`,
      profileTemplateId: "profile.general-industrial-time-study",
    }),
  });
  const projectId = proj.body?.id;
  if (proj.status !== 201 || !projectId) throw new Error(`project create failed: ${JSON.stringify(proj.body)}`);
  for (const [u, role] of [[viewer, "viewer"], [recorder, "recorder"]]) {
    await ownerC.req(`/api/projects/${projectId}/members`, {
      method: "POST",
      body: JSON.stringify({ email: u.email, role }),
    });
  }

  // پروژه دوم برای جداسازی
  const proj2 = await ownerC.req("/api/projects", {
    method: "POST",
    body: JSON.stringify({
      code: `P6X-${stamp}`,
      title: `پروژه جداسازی فاز ۶ ${stamp}`,
      profileTemplateId: "profile.general-industrial-time-study",
    }),
  });
  const projectId2 = proj2.body?.id;

  // ─── بند ۲: اعتبارسنجی گراف در مرز ایجاد فعالیت (B5) ───
  console.log("[۰] بند ۲ — گراف: API چرخه/ارجاع نامعتبر را رد می‌کند");
  {
    for (const a of ACTIVITIES) {
      const res = await ownerC.req(`/api/projects/${projectId}/activities`, {
        method: "POST",
        body: JSON.stringify({
          stableKey: a.id,
          name: a.name,
          workType: a.workType,
          predecessors: a.preds,
        }),
      });
      if (res.status !== 201) throw new Error(`activity create failed ${a.id}: ${JSON.stringify(res.body)}`);
    }
    const cyc = await ownerC.req(`/api/projects/${projectId}/activities`, {
      method: "POST",
      body: JSON.stringify({ stableKey: "bal.x", name: "چرخه‌ساز", workType: "operatorManual", predecessors: ["bal.e"] }),
    });
    // e وابسته به c,d — افزودن x با پیش‌نیاز e سپس e با پیش‌نیاز x → چرخه
    const upd = await ownerC.req(`/api/projects/${projectId}/activities/${cyc.body?.id}`, {
      method: "PATCH",
      body: JSON.stringify({ predecessors: ["bal.e", "bal.x"] }),
    });
    // bal.x preds شامل خودش؟ نه — ولی bal.e ← ... بررسی چرخه واقعی: e→x و x→e
    check("به‌روزرسانی ایجادکننده چرخه رد می‌شود (e↔x)", upd.status === 400, `status=${upd.status}`);
    const selfRef = await ownerC.req(`/api/projects/${projectId}/activities/${cyc.body?.id}`, {
      method: "PATCH",
      body: JSON.stringify({ predecessors: ["bal.x"] }),
    });
    check("خودارجاعی رد می‌شود", selfRef.status === 400, `status=${selfRef.status}`);
    // بایگانی فعالیت آزمایشی (PATCH archived — DELETE فیزیکی وجود ندارد: B5)
    const del = await ownerC.req(`/api/projects/${projectId}/activities/${cyc.body?.id}`, {
      method: "PATCH",
      body: JSON.stringify({ archived: true }),
    });
    check("فعالیت آزمایشی بایگانی شد", del.status === 200 && del.body?.archived === true, `status=${del.status}`);
  }

  // ─── مرزها: پروژه بدون جلسه نهایی ───
  console.log("\n[۱] مرز — نمای بالانس قبل از داده زمانی");
  {
    const ov = await ownerC.req(`/api/projects/${projectId}/balance`);
    check("نمای کلی ۲۰۰ — سناریو خالی + آمادگی صادقانه", ov.status === 200 && Array.isArray(ov.body?.scenarios) && ov.body.scenarios.length === 0);
    check("گراف تقدم سالم گزارش می‌شود", ov.body?.readiness?.graphCheck?.ok === true);
    check("فعالیت‌های فعال = ۶", ov.body?.readiness?.activitiesActive === 6, `n=${ov.body?.readiness?.activitiesActive}`);
    check("بدون جلسه → زمان استاندارد صفر فعالیت", (ov.body?.readiness?.activitiesWithTime?.standard ?? -1) === 0);
  }

  // ─── داده زمانی: جلسه نهایی‌شده با عناصر = کلید فعالیت‌ها ───
  console.log("\n[۲] زنجیره فاز ۴→۵→۶ — جلسه نهایی → تحلیل → آمادگی بالانس");
  {
    const s1 = await makeFinalizedSession(ownerC, projectId, ELEMENTS, CYCLES);
    check("جلسه مرجع نهایی شد (۲ چرخه)", s1.finalize.status === 200 && s1.finalize.body?.completedCycles === 2, `completed=${s1.finalize.body?.completedCycles}`);

    const ov = await ownerC.req(`/api/projects/${projectId}/balance`);
    check("۶ فعالیت دارای زمان نماینده", ov.body?.readiness?.activitiesWithTime?.representative === 6, `n=${ov.body?.readiness?.activitiesWithTime?.representative}`);
    const analysis = await ownerC.req(`/api/projects/${projectId}/analysis`);
    const elA = analysis.body?.elements?.find((e) => e.elementKey === "bal.a");
    check("نماینده bal.a = ۲۰ث (میانگین ۱۹/۲۱)", elA?.chain?.representative?.value === 20000, `rep=${elA?.chain?.representative?.value}`);
  }

  // ─── R6-2: سناریوی مرجع با تاکت مستقیم + حل LCR + تطبیق جواب مستقل ───
  console.log("\n[۳] R6-2 — سناریوی مرجع (تاکت ۶۰ث، مبنای نماینده) + LCR با جواب مستقل");
  let scenarioId;
  let lcrResult;
  {
    const create = await ownerC.req(`/api/projects/${projectId}/balance`, {
      method: "POST",
      body: JSON.stringify({
        name: "مرجع — تاکت ۶۰ ثانیه",
        inputs: {
          timeBasis: "representative",
          takt: { taktMs: 60000, demandUnits: null, netAvailableMsPerShift: null, shiftsPerPeriod: null },
          maxStations: null,
          objectives: { minimizeStations: 0.4, smoothLoad: 0.4, minChanges: 0.2 },
          activityTimeOverrides: {},
          referenceAssignment: null,
        },
      }),
    });
    check("سناریو ساخته شد", create.status === 201 && !!create.body?.scenario?.id, `status=${create.status}`);
    scenarioId = create.body?.scenario?.id;

    const solve = await ownerC.req(`/api/projects/${projectId}/balance/${scenarioId}/solve`, {
      method: "POST",
      body: JSON.stringify({ algorithm: "lcr" }),
    });
    check("LCR اجرا شد", solve.status === 201, `status=${solve.status}`);
    lcrResult = solve.body?.result;
    const m = lcrResult?.metrics;
    /** جواب مستقل (ردیابی دستی LCR — مرتب‌سازی زمان نزولی: d,e,m,c,a,b):
     *  پاس ۱: d✗(p:b) e✗(p:c,d) m→S1(30) c✗(p:a) a→S1(50) b→S1? 65>60 → S2(15)
     *  پاس ۲: d→S2(50) · c→S3? S1:75✗ S2:75✗ → S3(25)
     *  پاس ۳: e→S3(55)
     *  نتیجه: S1={m,a}=50 · S2={b,d}=50 · S3={c,e}=55
     */
    check("تخصیص مستقل: S1={m,a} · S2={b,d} · S3={c,e}",
      lcrResult?.assignments?.["bal.m"] === 1 && lcrResult?.assignments?.["bal.a"] === 1 &&
      lcrResult?.assignments?.["bal.b"] === 2 && lcrResult?.assignments?.["bal.d"] === 2 &&
      lcrResult?.assignments?.["bal.c"] === 3 && lcrResult?.assignments?.["bal.e"] === 3,
      JSON.stringify(lcrResult?.assignments));
    // جمع سریال = 20+15+25+35+30+30 = 155ث · Σاپراتور = 125ث (ماشین 30ث جدا)
    // E = 155/(3×55) = 93.939٪ · mMin = ceil(155/60) = 3 · بیکاری = 10+10+5 = 25ث
    // نیروی نظری = ceil(125/60) = 3 · اشتغال اپراتور = 125/(3×60) = 69.444٪
    check("m=3 · C=55ث · E=155/(3×55)=93.939٪",
      m?.stationCount === 3 && m?.bottleneckMs === 55000 &&
      Math.abs((m?.efficiencyPct ?? 0) - (15500 / 165)) < 0.01,
      `m=${m?.stationCount} C=${m?.bottleneckMs} E=${m?.efficiencyPct?.toFixed(3)}`);
    check("mMin=ceil(155/60)=3 · بیکاری کل=25ث",
      m?.minStationsTheoretical === 3 && m?.totalIdleMs === 25000, `mMin=${m?.minStationsTheoretical} idle=${m?.totalIdleMs}`);
    check("بند ۷ — Σاپراتور=125ث جدا از Σماشین=30ث",
      m?.totalOperatorMs === 125000 && m?.totalMachineMs === 30000,
      `op=${m?.totalOperatorMs} mach=${m?.totalMachineMs}`);
    check("نیروی نظری=ceil(125/60)=3 · عملیاتی=3 · اشتغال=69.444٪",
      m?.theoreticalOperators === 3 && m?.operationalOperators === 3 &&
      Math.abs((m?.operatorUtilizationPct ?? 0) - (12500 / 180)) < 0.01,
      `نظری=${m?.theoreticalOperators} عملیاتی=${m?.operationalOperators} util=${m?.operatorUtilizationPct?.toFixed(1)}٪`);
    check("بدون نقض قید — solved", lcrResult?.status === "solved" && (lcrResult?.violations?.length ?? 1) === 0);
    const s1Load = lcrResult?.stations?.find((st) => st.station === 1);
    check("بند ۷ — S1: ماشین=30ث جدا از اپراتور=20ث (سریال=50)",
      s1Load?.machineMs === 30000 && s1Load?.operatorMs === 20000 && s1Load?.serialMs === 50000,
      `mach=${s1Load?.machineMs} op=${s1Load?.operatorMs}`);
    const detail = await ownerC.req(`/api/projects/${projectId}/balance/${scenarioId}`);
    check("مسئله: منبع زمان هر فعالیت = تحلیل فاز ۵", detail.body?.problem?.activities?.every(
      (a) => a.timeStatus === "valid" && a.timeSource === "analysis"));
    check("تاکت ۶۰ث با منبع مستقیم", detail.body?.problem?.taktMs === 60000);
  }

  // ─── بند ۳: الگوریتم‌های جایگزین + تمایز ───
  console.log("\n[۴] بند ۳ — RPW و KW هم اجرا می‌شوند (مقایسه‌پذیری)");
  {
    for (const algo of ["rpw", "kilbridge-wester"]) {
      const solve = await ownerC.req(`/api/projects/${projectId}/balance/${scenarioId}/solve`, {
        method: "POST",
        body: JSON.stringify({ algorithm: algo }),
      });
      const r = solve.body?.result;
      check(`${algo} اجرا و بدون نقض تقدم حل شد (R6-1)`, solve.status === 201 && r?.status !== "infeasible-flagged" &&
        !(r?.violations ?? []).some((v) => v.code === "precedence"),
        `m=${r?.metrics?.stationCount} E=${r?.metrics?.efficiencyPct?.toFixed(1)}٪`);
    }
    const detail = await ownerC.req(`/api/projects/${projectId}/balance/${scenarioId}`);
    check("تاریخچه append-only: ۳ نتیجه", detail.body?.results?.length === 3, `n=${detail.body?.results?.length}`);
    const obj = detail.body?.results?.map((r) => r.metrics?.objectiveValue);
    check("تابع هدف برای همه نتایج محاسبه شد", obj?.every((v) => typeof v === "number" && v >= 0));
  }

  // ─── R6-3: تخصیص دستی — معتبر و نامعتبر ───
  console.log("\n[۵] R6-3 — تخصیص دستی با اعتبارسنجی فوری");
  {
    // معتبر با اضافه‌بار ظرفیت (نرم → پرچم، نه رد)
    const ok = await ownerC.req(`/api/projects/${projectId}/balance/${scenarioId}/assignment`, {
      method: "PUT",
      body: JSON.stringify({
        assignments: { "bal.m": 1, "bal.a": 1, "bal.b": 2, "bal.c": 2, "bal.d": 2, "bal.e": 3 },
      }),
    });
    const r = ok.body?.result;
    check("دستی معتبر ذخیره شد (۲۰۱/۲۰۰) + بازمحاسبه فوری", ok.status === 200 && r?.algorithm === "manual");
    check("اضافه‌بار S2 (15+25+35=75>60) پرچم خورد — نه رد بی‌صدا",
      r?.status === "solved-with-flags" && (r?.violations ?? []).some((v) => v.code === "capacity"));
    check("شاخص‌ها بازمحاسبه شدند (m=3 · C=75ث)",
      r?.metrics?.stationCount === 3 && r?.metrics?.bottleneckMs === 75000, `C=${r?.metrics?.bottleneckMs}`);

    // نامعتبر: نقض تقدم (c در ۱ ولی پیش‌نیاز a در ۲)
    const bad = await ownerC.req(`/api/projects/${projectId}/balance/${scenarioId}/assignment`, {
      method: "PUT",
      body: JSON.stringify({
        assignments: { "bal.m": 1, "bal.a": 2, "bal.b": 1, "bal.c": 1, "bal.d": 2, "bal.e": 3 },
      }),
    });
    check("نقض تقدم → ۴۲۲ (نه پذیرش بی‌هشدار)", bad.status === 422, `status=${bad.status}`);
    const viols = bad.body?.error?.details?.violations ?? [];
    check("دلیل نقض صریح فارسی", viols.length > 0 && viols.some((v) => String(v).includes("نقض تقدم")), JSON.stringify(viols.slice(0, 1)));
  }

  // ─── بند ۱: تاکت از تقاضا + بند ۷: override و هم‌پوشان ───
  console.log("\n[۶] بند ۱/۷ — تاکت از تقاضا + مبنای override + فعالیت هم‌پوشان");
  {
    const create = await ownerC.req(`/api/projects/${projectId}/balance`, {
      method: "POST",
      body: JSON.stringify({
        name: "بازتنظیم دستی + هم‌پوشان",
        inputs: {
          timeBasis: "override",
          takt: { taktMs: null, demandUnits: 480, netAvailableMsPerShift: 27000000, shiftsPerPeriod: 2 },
          maxStations: null,
          objectives: { minimizeStations: 0.4, smoothLoad: 0.4, minChanges: 0.2 },
          activityTimeOverrides: { "bal.a": 20000, "bal.b": 15000, "bal.m": 30000 },
          referenceAssignment: null,
        },
      }),
    });
    check("سناریوی override + تقاضا ساخته شد", create.status === 201);
    const sid2 = create.body?.scenario?.id;
    const detail = await ownerC.req(`/api/projects/${projectId}/balance/${sid2}`);
    check("تاکت از تقاضا: 54000ث÷480 = 112.5ث", detail.body?.problem?.taktMs === 112500, `takt=${detail.body?.problem?.taktMs}`);
    check("فعالیت‌های بدون override → missing (بدون عدد جعلی)",
      detail.body?.problem?.activities?.filter((a) => a.timeStatus === "missing")?.length === 3);

    const solve = await ownerC.req(`/api/projects/${projectId}/balance/${sid2}/solve`, {
      method: "POST",
      body: JSON.stringify({ algorithm: "lcr" }),
    });
    const r = solve.body?.result;
    check("فعالیت‌های missing از تخصیص کنار گذاشته شدند", Object.keys(r?.assignments ?? {}).length === 3, JSON.stringify(r?.assignments));
    check("یادداشت صادقانه: فعالیت‌های بدون زمان فهرست شدند", (r?.notesFa ?? []).some((n) => n.includes("بدون زمان معتبر")));
  }

  // ─── بند ۵/۹: به‌روزرسانی سناریو + بایگانی ───
  console.log("\n[۷] بند ۵/۹ — به‌روزرسانی ورودی سناریو + بایگانی");
  {
    const ov = await ownerC.req(`/api/projects/${projectId}/balance`);
    const first = ov.body?.scenarios?.find((s) => s.name?.startsWith("مرجع"));
    const upd = await ownerC.req(`/api/projects/${projectId}/balance/${first?.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: "مرجع — تاکت ۶۰ ثانیه (ویرایش‌شده)",
        notes: "یادداشت آزمون",
      }),
    });
    check("PATCH سناریو (نام/یادداشت)", upd.status === 200 && upd.body?.scenario?.name?.includes("ویرایش‌شده"));

    const badTakt = await ownerC.req(`/api/projects/${projectId}/balance`, {
      method: "POST",
      body: JSON.stringify({
        name: "بدون تاکت",
        inputs: {
          timeBasis: "representative",
          takt: { taktMs: null, demandUnits: null, netAvailableMsPerShift: null, shiftsPerPeriod: null },
          maxStations: null,
          objectives: { minimizeStations: 0.4, smoothLoad: 0.4, minChanges: 0.2 },
          activityTimeOverrides: {},
          referenceAssignment: null,
        },
      }),
    });
    check("سناریو بدون تاکت → ۴۰۰ با پیام شفاف", badTakt.status === 400, `status=${badTakt.status}`);

    const arch = await ownerC.req(`/api/projects/${projectId}/balance/${first?.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "archived" }),
    });
    check("بایگانی سناریو", arch.status === 200 && arch.body?.scenario?.status === "archived");
    const listAfter = await ownerC.req(`/api/projects/${projectId}/balance`);
    check("سناریوی بایگانی با وضعیت archived قابل بازیابی در فهرست ماند",
      (listAfter.body?.scenarios ?? []).some((s) => s.status === "archived" && s.id === first?.id));
  }

  // ─── بند ۸: خروجی CSV/XLS/JSON ───
  console.log("\n[۸] بند ۸ — خروجی‌ها با ردیابی و فارسی/RTL");
  {
    const ov = await ownerC.req(`/api/projects/${projectId}/balance`);
    const active = ov.body?.scenarios?.find((s) => s.status === "active" && s.resultCount > 0);
    const sid = active?.id ?? scenarioId;

    const csv = await ownerC.raw(`/api/projects/${projectId}/balance/${sid}/export?template=balance-summary&format=csv`);
    check("CSV: ۲۰۰ + BOM (فارسی Excel سالم)", csv.status === 200 && csv.text.startsWith("\uFEFF"), `len=${csv.text.length}`);
    check("CSV: شاخص‌ها/فرمول فارسی حاضر", csv.text.includes("راندمان") && csv.text.includes("ΣT"));

    const xls = await ownerC.raw(`/api/projects/${projectId}/balance/${sid}/export?template=station-assignments&format=xls`);
    check("XLS: SpreadsheetML + RightToLeft", xls.status === 200 && xls.text.includes("RightToLeft") && xls.text.includes("Workbook"));

    const json = await ownerC.raw(`/api/projects/${projectId}/balance/${sid}/export?template=scenario-comparison&format=json`);
    let parsed = null;
    try { parsed = JSON.parse(json.text); } catch { /* خراب */ }
    check("JSON: ردیابی کامل (سناریو/مسئله/نتایج)", json.status === 200 && parsed?.trace?.generatedAt && Array.isArray(parsed?.results) && parsed?.problem?.taktMs > 0, `results=${parsed?.results?.length}`);

    const badFmt = await ownerC.req(`/api/projects/${projectId}/balance/${sid}/export?template=balance-summary&format=pdf`);
    check("قالب نامعتبر → ۴۰۰", badFmt.status === 400, `status=${badFmt.status}`);
  }

  // ─── RBAC ───
  console.log("\n[۹] RBAC — balance:read/write");
  {
    const vRead = await viewerC.req(`/api/projects/${projectId}/balance`);
    check("viewer: خواندن مجاز", vRead.status === 200);
    const vSolve = await viewerC.req(`/api/projects/${projectId}/balance/${scenarioId}/solve`, {
      method: "POST",
      body: JSON.stringify({ algorithm: "lcr" }),
    });
    check("viewer: حل → ۴۰۳", vSolve.status === 403, `status=${vSolve.status}`);
    const rSolve = await recorderC.req(`/api/projects/${projectId}/balance/${scenarioId}/solve`, {
      method: "POST",
      body: JSON.stringify({ algorithm: "lcr" }),
    });
    check("recorder: حل → ۴۰۳ (فقط خواندن)", rSolve.status === 403, `status=${rSolve.status}`);
    const rManual = await recorderC.req(`/api/projects/${projectId}/balance/${scenarioId}/assignment`, {
      method: "PUT",
      body: JSON.stringify({ assignments: { "bal.a": 1 } }),
    });
    check("recorder: تخصیص دستی → ۴۰۳", rManual.status === 403, `status=${rManual.status}`);
    const vExport = await viewerC.raw(`/api/projects/${projectId}/balance/${scenarioId}/export?template=balance-summary&format=csv`);
    check("viewer: خروجی مجاز (گزارش‌گیری)", vExport.status === 200);
    const anon = makeClient();
    const anonRead = await anon.req(`/api/projects/${projectId}/balance`);
    check("بی‌نشست → ۴۰۱", anonRead.status === 401, `status=${anonRead.status}`);
  }

  // ─── جداسازی پروژه‌ها ───
  console.log("\n[۱۰] جداسازی — سناریوی پروژه دیگر در دسترس نیست");
  {
    const sc2 = await ownerC.req(`/api/projects/${projectId2}/balance`, {
      method: "POST",
      body: JSON.stringify({
        name: "سناریوی پروژه ۲",
        inputs: {
          timeBasis: "override",
          takt: { taktMs: 50000, demandUnits: null, netAvailableMsPerShift: null, shiftsPerPeriod: null },
          maxStations: null,
          objectives: { minimizeStations: 0.4, smoothLoad: 0.4, minChanges: 0.2 },
          activityTimeOverrides: {},
          referenceAssignment: null,
        },
      }),
    });
    const sid2 = sc2.body?.scenario?.id;
    const cross = await ownerC.req(`/api/projects/${projectId}/balance/${sid2}`);
    check("سناریوی پروژه ۲ از مسیر پروژه ۱ → ۴۰۴", cross.status === 404, `status=${cross.status}`);
    const crossSolve = await ownerC.req(`/api/projects/${projectId}/balance/${sid2}/solve`, {
      method: "POST",
      body: JSON.stringify({ algorithm: "lcr" }),
    });
    check("حل سناریوی متقاطع → ۴۰۴", crossSolve.status === 404, `status=${crossSolve.status}`);
  }

  // ─── ممیزی ───
  console.log("\n[۱۱] ممیزی — عملیات بالانس ثبت شد");
  {
    const audit = await ownerC.req(`/api/projects/${projectId}/audit?limit=100`);
    const actions = new Set((audit.body?.items ?? []).map((a) => a.action));
    check("balance.scenario-created ثبت شد", actions.has("balance.scenario-created"));
    check("balance.solved ثبت شد", actions.has("balance.solved"));
    check("balance.manual-saved ثبت شد", actions.has("balance.manual-saved"));
    check("balance.exported ثبت شد", actions.has("balance.exported"));
  }

  // ─── جمع‌بندی ───
  console.log("\n════════ نتیجه ════════");
  console.log(`قبول: ${passed} · رد: ${failed}`);
  if (failures.length > 0) {
    console.log("رد‌شده‌ها:");
    for (const f of failures) console.log(`  ✗ ${f}`);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("خطای اجرای آزمون:", err);
  process.exit(1);
});
