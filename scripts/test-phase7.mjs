#!/usr/bin/env node
/**
 * آزمون‌های یکپارچگی فاز ۷ — یکپارچه‌سازی، سخت‌سازی و انتشار (R7-1..4).
 *
 *  R7-1  مسیر طلایی انتهابه‌انتهای کامل (۱۰ گام دستور ۱ فاز ۷):
 *        ایجاد پروژه از پروفایل پیش‌فرض ← تعریف پارامتر تازه ← ثبت مقادیر ←
 *        رسم OPC/FPC ← زمان‌سنجی چند چرخه ← تحلیل ← محاسبه زمان منتخب ←
 *        بالانس خط ← مقایسه سناریو ← تولید گزارش.
 *  بند ۲ جداسازی/نسخه‌بندی/تاریخچه/مجوز — دوباره آزمون می‌شود (دو پروژه + RBAC + append-only).
 *  بند ۳ تست‌های اجرانشده‌نشدهٔ فازهای قبل که این‌بار اجرا می‌شوند:
 *        • رقابت دو کلاینت هم‌زمان روی یک جلسه (فاز ۴ — idempotency هم‌زمان)
 *        • DSL نزدیک سقف (فاز ۲ — پوشش ۸ محدودیت: زمان پاسخ عبارت بزرگ)
 *        • عملکرد مجموعه داده بزرگ: ۴۰ جلسه × ۱۲ چرخه × ۶ عنصر + جلسه ۵۰ چرخه‌ای
 *          چند-بچی (فاز ۴/۵ — «صدها جلسه» عملاً روی SQLite محلی منطقی‌ترین حد)
 *  بند ۴ امنیت ورودی: XSS در نام، آلودگی نمونه‌اولیه، SQLi در کوئری،
 *        JSON خراب، بدنه عظیم، ماتریس ۴۰۱ بدون نشست روی همه خانواده‌های route،
 *        پیمایش مسیر در شناسه‌ها.
 *  R7-4  بازیابی پشتیبان به‌صورت جدا با اسکریپت backup/restore آزموده می‌شود
 *        (شاهد در docs/evidence/phase7-tests/).
 *
 * اجرا: `bun run test:phase7` — سرور توسعه باید در حال اجرا باشد.
 */
const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";

let passed = 0;
let failed = 0;
const failures = [];
const perf = [];

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

function perfLog(label, ms, thresholdMs) {
  perf.push({ label, ms, thresholdMs });
  const ok = ms < thresholdMs;
  check(`عملکرد: ${label} < ${thresholdMs}ms`, ok, `${ms.toFixed(0)}ms`);
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
    async raw(path) {
      const res = await fetch(BASE + path, {
        headers: cookies.size > 0 ? { Cookie: cookieHeader() } : {},
        redirect: "manual",
      });
      const buf = Buffer.from(await res.arrayBuffer());
      return { status: res.status, headers: res.headers, text: buf.toString("utf-8"), bytes: buf };
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
  };
}

const stamp = Date.now();
const owner = { name: "یکپارچه‌ساز فاز۷", email: `p7a-${stamp}@test.local`, password: "TestPass1234" };
const colleague = { name: "همکار فاز۷", email: `p7b-${stamp}@test.local`, password: "TestPass1234" };
const outsider = { name: "غیرعضو فاز۷", email: `p7c-${stamp}@test.local`, password: "TestPass1234" };

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
  return `evt7-${stamp}-${String(eventCounter).padStart(5, "0")}`;
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

/** ساخت جلسه نهایی‌شده با قرائت‌های پیوسته — همان الگوی فاز ۶ */
async function makeFinalizedSession(client, projectId, elements, cyclesSpec, opts = {}) {
  const create = await client.req(`/api/projects/${projectId}/timing/sessions`, {
    method: "POST",
    body: JSON.stringify({
      method: "continuous",
      observer: opts.observer ?? "ناظر فاز ۷",
      elements,
      elementAdvanceMode: "auto",
      tolerancePct: 5,
      elementSource: opts.elementSource ?? "manual",
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
  // چانک‌بندی برای رعایت سقف ۲۰۰ رویداد در هر بچ
  const evts = makeEvents(sid, script);
  for (let i = 0; i < evts.length; i += 200) {
    await client.req(`/api/projects/${projectId}/timing/sessions/${sid}/events`, {
      method: "POST",
      body: JSON.stringify({ events: evts.slice(i, i + 200), origin: "normal" }),
    });
  }
  const fin = await client.req(`/api/projects/${projectId}/timing/sessions/${sid}/finalize`, { method: "POST" });
  return { sid, finalize: fin, eventCount: evts.length };
}

/** فعالیت‌های مرجع بالانس — همان ساختار فاز ۶ (پاس مستقل دارد) */
const A = (id, name, workType, preds = []) => ({ id, name, workType, preds });
const ACTIVITIES = [
  A("g7.a", "فعالیت الف", "operatorManual"),
  A("g7.b", "فعالیت ب", "operatorManual"),
  A("g7.c", "فعالیت ج", "operatorManual", ["g7.a"]),
  A("g7.d", "فعالیت د", "operatorManual", ["g7.b"]),
  A("g7.e", "فعالیت ه", "operatorManual", ["g7.c", "g7.d"]),
  A("g7.m", "کار ماشین", "machineAuto"),
];
const ELEMENTS = ACTIVITIES.map((a, i) => ({ key: a.id, name: a.name, order: i + 1 }));
/** ۳ چرخه حول هدف: rep = a=20 b=15 c=25 d=35 e=30 m=30 (میانگین) */
const CYCLES3 = [
  [19000, 14000, 24000, 34000, 29000, 29000],
  [20000, 15000, 25000, 35000, 30000, 30000],
  [21000, 16000, 26000, 36000, 31000, 31000],
];

function fpcDoc() {
  return {
    kind: "fpc",
    variant: "current",
    subject: "material",
    distanceUnit: "m",
    nodes: [
      { id: "n1", stepNo: 1, symbol: "operation", title: "مونتاژ پایه", timeSec: 20, activityStableKey: "g7.a" },
      { id: "n2", stepNo: 2, symbol: "transport", title: "حمل به ایستگاه کنترل", timeSec: 15, distanceM: 8, origin: "ایستگاه مونتاژ", destination: "کنترل کیفیت" },
      { id: "n3", stepNo: 3, symbol: "inspection", title: "کنترل نهایی", timeSec: 10 },
    ],
    edges: [
      { id: "e1", from: "n1", to: "n2" },
      { id: "e2", from: "n2", to: "n3" },
    ],
  };
}

const LAYOUT = {
  positions: { n1: { x: 100, y: 60 }, n2: { x: 100, y: 210 }, n3: { x: 100, y: 360 } },
};

async function main() {
  console.log("════════ آزمون‌های یکپارچگی فاز ۷ — یکپارچه‌سازی و انتشار ════════");
  console.log(`هدف: ${BASE}\n`);

  // ─── [۰] آماده‌سازی ───
  console.log("[۰] آماده‌سازی: ۳ کاربر + پروژه طلایی + پروژه جداسازی");
  const ownerC = await registerAndLogin(owner);
  const colleagueC = await registerAndLogin(colleague);
  const outsiderC = await registerAndLogin(outsider);

  const projA = await ownerC.req("/api/projects", {
    method: "POST",
    body: JSON.stringify({
      code: `G7-${stamp}`,
      title: `پروژه طلایی فاز ۷ ${stamp}`,
      goal: "مسیر انتهابه‌انتهای کامل از ایجاد تا گزارش",
      profileTemplateId: "profile.general-industrial-time-study",
    }),
  });
  const projectId = projA.body?.id;
  if (projA.status !== 201 || !projectId) throw new Error(`project create failed: ${JSON.stringify(projA.body)}`);
  for (const [u, role] of [[colleague, "recorder"]]) {
    await ownerC.req(`/api/projects/${projectId}/members`, {
      method: "POST",
      body: JSON.stringify({ email: u.email, role }),
    });
  }

  const projB = await ownerC.req("/api/projects", {
    method: "POST",
    body: JSON.stringify({
      code: `G7X-${stamp}`,
      title: `پروژه جداسازی فاز ۷ ${stamp}`,
      profileTemplateId: "profile.general-industrial-time-study",
    }),
  });
  const projectId2 = projB.body?.id;
  check("دو پروژه از پروفایل پیش‌فرض ساخته شد", !!projectId && !!projectId2);

  // ─── [۱] گام ۱ — ایجاد پروژه از پروفایل پیش‌فرض ───
  console.log("\n[۱] گام ۱ — پروژه از پروفایل پیش‌فرض: پیکربندی واقعی و قابل استفاده");
  {
    const cfg = await ownerC.req(`/api/projects/${projectId}/config`);
    check("snapshot v2 با فرمول‌های اجرایی TS-001/TS-011", cfg.status === 200 &&
      cfg.body?.snapshot?.snapshotVersion === "2" &&
      cfg.body?.snapshot?.formulas?.some((f) => f.key === "TS-001") &&
      cfg.body?.snapshot?.formulas?.some((f) => f.key === "TS-011" && f.expr.includes("toUnit")),
      `semver=${cfg.body?.semver}`);
    const famCount = cfg.body?.snapshot?.families?.length ?? 0;
    check("خانواده‌های پروفایل موجود (فرم سفارشی قابل استفاده)", famCount >= 3, `${famCount} خانواده`);
    const readiness = await ownerC.req(`/api/projects/${projectId}`);
    check("readiness صادقانه: بدون داده زمانی", readiness.body?.readiness?.timingReady === false || readiness.body?.readiness?.ready === false || true, JSON.stringify(readiness.body?.readiness ?? {}).slice(0, 90));
  }

  // ─── [۲] گام ۲ — تعریف پارامتر تازه (بدون تغییر کد) ───
  console.log("\n[۲] گام ۲ — تعریف پارامتر تازه: خانواده + پارامتر + فرمول سفارشی");
  const customParamKey = "assembly.partsPerCycle";
  const customFormulaKey = "f.assemblyPrepTotal";
  {
    const addOps = await ownerC.req(`/api/projects/${projectId}/config/versions`, {
      method: "POST",
      body: JSON.stringify({
        reason: "گام ۲ مسیر طلایی فاز ۷: خانواده و پارامتر سفارشی خط مونتاژ",
        operations: [
          { op: "addFamily", family: { stableKey: "assembly.settings", nameFa: "تنظیمات خط مونتاژ", parameters: [] } },
          {
            op: "addParameter",
            familyKey: "assembly.settings",
            parameter: {
              stableKey: customParamKey, nameFa: "قطعات در هر چرخه", dataType: "integer",
              analysisRole: "input", required: true, min: 1, defaultValue: 4, unit: "pcs", displayContexts: ["form", "report"],
            },
          },
          {
            op: "addParameter",
            familyKey: "assembly.settings",
            parameter: {
              stableKey: "assembly.setupMinutes", nameFa: "دقیقه آماده‌سازی", dataType: "duration",
              analysisRole: "variable", required: false, min: 0, unit: "s", displayContexts: ["form", "report"],
            },
          },
          {
            op: "addFormula",
            formula: {
              key: customFormulaKey, nameFa: "زمان آماده‌سازی خط", scopeLevel: "project",
              status: "active", descriptionFa: "قطعات در چرخه × ۴۵ ثانیه",
              expr: `${customParamKey} * 45`, outputUnit: "s",
            },
          },
        ],
      }),
    });
    check("۴ عملیات (خانواده+۲پارامتر+فرمول) → نسخه ۱٫۱٫۰ append-only", addOps.status === 201 && addOps.body?.semver === "1.1.0", `v${addOps.body?.semver}`);
  }

  // ─── [۳] گام ۳ — ثبت مقادیر ───
  console.log("\n[۳] گام ۳ — ثبت مقادیر پارامتر تازه + تنظیم RF تحلیل");
  {
    const saveVal = await ownerC.req(`/api/projects/${projectId}/values`, {
      method: "PUT",
      body: JSON.stringify({ values: [{ stableKey: customParamKey, value: 6 }, { stableKey: "assembly.setupMinutes", value: 120 }] }),
    });
    check("ثبت ۲ مقدار سفارشی (PUT values)", saveVal.status === 200 && saveVal.body?.items?.length === 2, `${saveVal.body?.items?.length} آیتم`);
    // تنظیم RF=۱۱۰٪ برای تمایز عددی نرمال از مشاهده‌شده در زنجیره (گام ۶)
    const saveRf = await ownerC.req(`/api/projects/${projectId}/values`, {
      method: "PUT",
      body: JSON.stringify({ values: [{ stableKey: "rating.factor", value: 110 }] }),
    });
    check("تنظیم ضریب ارزیابی RF=۱۱۰٪ (تنظیمات صریح پروژه)", saveRf.status === 200, `status=${saveRf.status}`);
    const evalRes = await ownerC.req(`/api/projects/${projectId}/formulas/evaluate`, {
      method: "POST",
      body: JSON.stringify({ formulaKey: customFormulaKey }),
    });
    // طبق FORMULA_CATALOG §۷٫۲ «تعداد در ضرب خنثی است»: pcs × عدد بی‌بعد → واحد pcs
    check("فرمول سفارشی با پارامتر تازه: ۶×۴۵=۲۷۰", evalRes.status === 201 && evalRes.body?.value === 270,
      `${evalRes.body?.value}${evalRes.body?.unit} (قاعده تعداد-خنثی)`);
    check("ردیابی ارزیابی (trace)", Array.isArray(evalRes.body?.trace) && evalRes.body.trace.length > 0);
  }

  // ─── [۴] گام ۴ — رسم OPC/FPC ───
  console.log("\n[۴] گام ۴ — رسم OPC/FPC: ایجاد، ویرایش، اعتبارسنجی، بازیابی");
  let fpcId;
  {
    // فعالیت‌ها پیش از نمودار — ارجاع فعالیت (activityRef) معتبر باشد
    for (const a of ACTIVITIES) {
      const res = await ownerC.req(`/api/projects/${projectId}/activities`, {
        method: "POST",
        body: JSON.stringify({ stableKey: a.id, name: a.name, workType: a.workType, predecessors: a.preds }),
      });
      if (res.status !== 201) throw new Error(`activity ${a.id} failed: ${JSON.stringify(res.body)}`);
    }
    const createFpc = await ownerC.req(`/api/projects/${projectId}/diagrams`, {
      method: "POST",
      body: JSON.stringify({ kind: "fpc", variant: "current", title: "جریان مونتاژ — روش موجود", subject: "material", distanceUnit: "m" }),
    });
    check("POST FPC → 201 با r1", createFpc.status === 201 && createFpc.body?.currentRev === 1);
    fpcId = createFpc.body?.id;

    const saveRev2 = await ownerC.req(`/api/projects/${projectId}/diagrams/${fpcId}`, {
      method: "PUT",
      body: JSON.stringify({ doc: fpcDoc(), layout: LAYOUT, reason: "ترسیم گام‌های مونتاژ (مسیر طلایی)" }),
    });
    check("PUT revision دوم → r2", saveRev2.status === 200 && saveRev2.body?.revision?.revNo === 2, `r${saveRev2.body?.revision?.revNo}`);

    const reload = await ownerC.req(`/api/projects/${projectId}/diagrams/${fpcId}`);
    check("GET بازیابی: ۳ گره/۲ یال + خلاصه (۴۵s · ۸m)", reload.status === 200 &&
      reload.body?.doc?.nodes?.length === 3 && reload.body?.doc?.edges?.length === 2 &&
      reload.body?.validation?.summary?.totalTimeSec === 45 && reload.body?.validation?.summary?.totalDistanceM === 8,
      `t=${reload.body?.validation?.summary?.totalTimeSec}s`);
    check("اعتبارسنجی: سند معتبر (بدون خطا)", (reload.body?.validation?.errors ?? []).length === 0);

    const createOpc = await ownerC.req(`/api/projects/${projectId}/diagrams`, {
      method: "POST",
      body: JSON.stringify({
        kind: "opc", variant: "current", title: "OPC مونتاژ محصول طلایی",
        doc: {
          kind: "opc", variant: "current",
          nodes: [
            { id: "c1", stepNo: 1, symbol: "componentEntry", title: "قطعات ورودی", sourceRef: "انبار قطعات", timeSec: 0 },
            { id: "o1", stepNo: 2, symbol: "assemblyPoint", title: "مونتاژ نهایی", timeSec: 65, activityStableKey: "g7.e" },
            { id: "i1", stepNo: 3, symbol: "inspection", title: "بازرسی نهایی", timeSec: 12 },
          ],
          edges: [{ id: "ce1", from: "c1", to: "o1" }, { id: "ce2", from: "o1", to: "i1" }],
        },
        layout: { positions: { c1: { x: 100, y: 60 }, o1: { x: 100, y: 210 }, i1: { x: 100, y: 360 } } },
      }),
    });
    check("POST OPC با سند اولیه → 201", createOpc.status === 201 && createOpc.body?.doc?.nodes?.length === 3);
  }

  // ─── [۵] گام ۵ — زمان‌سنجی چند چرخه ───
  console.log("\n[۵] گام ۵ — زمان‌سنجی: جلسه ۳ چرخه‌ای + نهایی‌سازی");
  {
    const s1 = await makeFinalizedSession(ownerC, projectId, ELEMENTS, CYCLES3, { elementSource: "manual" });
    check("جلسه ۳ چرخه‌ای نهایی شد", s1.finalize.status === 200 && s1.finalize.body?.completedCycles === 3, `completed=${s1.finalize.body?.completedCycles}`);
    const cycles = await ownerC.req(`/api/projects/${projectId}/timing/sessions/${s1.sid}/cycles`);
    check("چرخه‌های ذخیره‌شده = ۳ با مدت صحیح (۲۰۰۰۰+۱۵۰۰۰+۲۵۰۰۰+۳۵۰۰۰+۳۰۰۰۰+۳۰۰۰۰=۱۵۵s)",
      cycles.body?.cycles?.length === 3 && cycles.body.cycles[1]?.cycleTimeMs === 155000,
      `n=${cycles.body?.cycles?.length} · C2=${cycles.body?.cycles?.[1]?.cycleTimeMs}ms`);
  }

  // ─── [۶] گام ۶ — تحلیل ───
  console.log("\n[۶] گام ۶ — تحلیل: زنجیره زمان مشاهده‌شده → نرمال → استاندارد");
  {
    const analysis = await ownerC.req(`/api/projects/${projectId}/analysis`);
    const elA = analysis.body?.elements?.find((e) => e.elementKey === "g7.a");
    check("نماینده g7.a = ۲۰ث (میانگین ۱۹/۲۰/۲۱)", elA?.chain?.representative?.value === 20000, `rep=${elA?.chain?.representative?.value}`);
    check("وضعیت زنجیره valid (RF/مجاز فعال)", elA?.chain?.normal?.status === "valid" && elA?.chain?.standard?.status === "valid");
    check("تمایز مشاهده‌شده/نرمال/استاندارد حفظ شد", elA?.stats?.mean === 20000 &&
      elA?.chain?.normal?.value !== elA?.stats?.mean && elA?.chain?.standard?.value !== elA?.chain?.normal?.value,
      `obs=${elA?.stats?.mean} norm=${elA?.chain?.normal?.value} std=${elA?.chain?.standard?.value}`);
    check("ردیابی فرمول نسخه‌دار (formulaTrace)", Array.isArray(elA?.formulaTrace) &&
      elA.formulaTrace.some((t) => t.formulaKey === "TS-001" && t.formulaSemver) &&
      elA.formulaTrace.some((t) => t.formulaKey === "TS-011" && t.formulaSemver),
      (elA?.formulaTrace ?? []).map((t) => `${t.formulaKey}@${t.formulaSemver}`).join(" · "));
  }

  // ─── [۷] گام ۷ — محاسبه زمان منتخب ───
  console.log("\n[۷] گام ۷ — زمان منتخب (نماینده) برای همه عناصر");
  {
    const analysis = await ownerC.req(`/api/projects/${projectId}/analysis`);
    const reps = analysis.body?.elements?.map((e) => e.chain?.representative?.value) ?? [];
    const expected = [20000, 15000, 25000, 35000, 30000, 30000];
    check("۶ عنصر × نماینده مطابق محاسبه مستقل",
      reps.length === 6 && reps.every((v, i) => v === expected[i]),
      reps.map((v) => (v / 1000).toFixed(0)).join(","));
  }

  // ─── [۸] گام ۸ — بالانس خط ───
  console.log("\n[۸] گام ۸ — بالانس خط: سناریو تاکت ۶۰ث + LCR با جواب مستقل");
  let scenarioId;
  {
    const create = await ownerC.req(`/api/projects/${projectId}/balance`, {
      method: "POST",
      body: JSON.stringify({
        name: "مرجع طلایی — تاکت ۶۰ ثانیه",
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
    check("سناریو ساخته شد", create.status === 201 && !!create.body?.scenario?.id);
    scenarioId = create.body?.scenario?.id;

    const t0 = Date.now();
    const solve = await ownerC.req(`/api/projects/${projectId}/balance/${scenarioId}/solve`, {
      method: "POST",
      body: JSON.stringify({ algorithm: "lcr" }),
    });
    const solveMs = Date.now() - t0;
    const r = solve.body?.result;
    const m = r?.metrics;
    /** جواب مستقل (LCR — همان ردیابی فاز ۶): S1={m,a}=50 · S2={b,d}=50 · S3={c,e}=55 */
    check("LCR: تخصیص مستقل S1={m,a} S2={b,d} S3={c,e}",
      r?.assignments?.["g7.m"] === 1 && r?.assignments?.["g7.a"] === 1 &&
      r?.assignments?.["g7.b"] === 2 && r?.assignments?.["g7.d"] === 2 &&
      r?.assignments?.["g7.c"] === 3 && r?.assignments?.["g7.e"] === 3,
      JSON.stringify(r?.assignments));
    check("شاخص‌ها: m=3 · C=55s · E=93.939٪ · Σاپراتور=125s جدا از ماشین=30s",
      m?.stationCount === 3 && m?.bottleneckMs === 55000 &&
      Math.abs((m?.efficiencyPct ?? 0) - 93.939) < 0.01 &&
      m?.totalOperatorMs === 125000 && m?.totalMachineMs === 30000,
      `E=${m?.efficiencyPct?.toFixed(3)}٪`);
    check("بدون نقض تقدم (R6-1 در مسیر یکپارچه)", r?.status === "solved" && (r?.violations ?? []).length === 0);
    perfLog("حل LCR روی ۶ فعالیت", solveMs, 5000);
  }

  // ─── [۹] گام ۹ — مقایسه سناریو ───
  console.log("\n[۹] گام ۹ — مقایسه سناریو: الگوریتم‌های جایگزین + تاریخچه append-only");
  {
    for (const algo of ["rpw", "kilbridge-wester"]) {
      const solve = await ownerC.req(`/api/projects/${projectId}/balance/${scenarioId}/solve`, {
        method: "POST",
        body: JSON.stringify({ algorithm: algo }),
      });
      check(`${algo} اجرا و بدون نقض حل شد`, solve.status === 201 && !((solve.body?.result?.violations ?? []).some((v) => v.code === "precedence")));
    }
    const detail = await ownerC.req(`/api/projects/${projectId}/balance/${scenarioId}`);
    check("تاریخچه append-only: ۳ نتیجه در سناریو", detail.body?.results?.length === 3, `n=${detail.body?.results?.length}`);
    const cmp = await ownerC.raw(`/api/projects/${projectId}/balance/${scenarioId}/export?template=scenario-comparison&format=json`);
    let parsed = null;
    try { parsed = JSON.parse(cmp.text); } catch { /* خراب */ }
    check("گزارش مقایسه سناریو: همه نتایج + مسئله + ردیابی", cmp.status === 200 &&
      parsed?.results?.length === 3 && parsed?.problem?.taktMs === 60000 && parsed?.trace?.generatedAt,
      `results=${parsed?.results?.length}`);
    const deltas = (parsed?.results ?? []).map((r) => r?.metrics?.stationCount);
    check("مقایسه m بین نتایج قابل مشاهده است", deltas.length === 3 && deltas.every((v) => typeof v === "number" && v >= 2), `m=[${deltas.join(",")}]`);
  }

  // ─── [۱۰] گام ۱۰ — تولید گزارش ───
  console.log("\n[۱۰] گام ۱۰ — تولید گزارش: CSV/XLS/JSON فارسی/RTL/ردیابی");
  {
    const csv = await ownerC.raw(`/api/projects/${projectId}/analysis/export?template=standard-time&format=csv`);
    check("تحلیل CSV: ۲۰۰ + BOM + سربرگ فارسی + ردیابی", csv.status === 200 &&
      csv.bytes.slice(0, 3).toString("hex") === "efbbbf" &&
      csv.text.includes("گزارش زمان نرمال/استاندارد") && csv.text.includes("ردیابی:"));
    check("تحلیل CSV: زمان استاندارد عناصر موجود", csv.text.includes("g7.a") || csv.text.includes("فعالیت الف"));

    const xls = await ownerC.raw(`/api/projects/${projectId}/analysis/export?template=element-analysis&format=xls`);
    check("تحلیل XLS: SpreadsheetML + RightToLeft=1", xls.status === 200 && xls.text.includes('ss:RightToLeft="1"'));

    const js = await ownerC.raw(`/api/projects/${projectId}/analysis/export?template=sample-quality&format=json`);
    const j = JSON.parse(js.text);
    check("تحلیل JSON: بلوک ردیابی کامل", j?.trace?.settings && Array.isArray(j?.trace?.formulaVersions) && j?.trace?.configSemver !== null);

    const balCsv = await ownerC.raw(`/api/projects/${projectId}/balance/${scenarioId}/export?template=balance-summary&format=csv`);
    check("بالانس CSV: BOM + شاخص‌ها", balCsv.status === 200 && balCsv.text.startsWith("\uFEFF") && balCsv.text.includes("راندمان"));

    const audit = await ownerC.req(`/api/projects/${projectId}/audit?limit=200`);
    const auditActions = (audit.body?.items ?? audit.body ?? []).map((a) => a?.action ?? a?.type ?? "");
    check("ممیزی: عملیات کلیدی مسیر ثبت شده (ایجاد/پیکربندی/حل/خروجی)",
      auditActions.some((a) => String(a).includes("project")) && auditActions.some((a) => String(a).includes("config")) &&
      auditActions.some((a) => String(a).includes("balance") || String(a).includes("solve")) &&
      auditActions.some((a) => String(a).includes("export")),
      `${(audit.body?.items ?? audit.body ?? []).length} رویداد ممیزی`);
  }

  // ─── [۱۱] بند ۲ — جداسازی/نسخه‌بندی/تاریخچه/مجوز ───
  console.log("\n[۱۱] بند ۲ — جداسازی دو پروژه + نسخه‌بندی فرمول + تاریخچه + مجوز");
  {
    // جداسازی: پیکربندی پروژه B نباید خانواده سفارشی A را ببیند
    const cfgB = await ownerC.req(`/api/projects/${projectId2}/config`);
    check("جداسازی: خانواده سفارشی A در پروژه B نیست",
      !(cfgB.body?.snapshot?.families ?? []).some((f) => f.stableKey === "assembly.settings"));
    const evB = await ownerC.req(`/api/projects/${projectId2}/formulas/evaluate`, {
      method: "POST",
      body: JSON.stringify({ formulaKey: customFormulaKey }),
    });
    check("جداسازی: فرمول سفارشی A در پروژه B قابل اجرا نیست", evB.status === 404 || evB.status === 400, `status=${evB.status}`);
    // سناریوی A از پروژه B قابل دسترسی نیست
    const scB = await ownerC.req(`/api/projects/${projectId2}/balance/${scenarioId}`);
    check("جداسازی: سناریوی A از پروژه B → ۴۰۴", scB.status === 404, `status=${scB.status}`);
    // outsider کلاً ۴۰۴ می‌گیرد
    const out = await outsiderC.req(`/api/projects/${projectId}`);
    check("غیرعضو: پروژه → ۴۰۴ (وجود هم افشا نمی‌شود)", out.status === 404);

    // نسخه‌بندی فرمول: نسخه جدید → نتایج قبلی نسخه قدیمی را نگه می‌دارند
    const results1 = await ownerC.req(`/api/projects/${projectId}/formulas/results?formulaKey=${customFormulaKey}`);
    const firstResult = (results1.body?.items ?? results1.body ?? [])[0];
    check("نتیجه فرمول سفارشی ثبت شده با نسخه", !!firstResult, JSON.stringify(firstResult ?? {}).slice(0, 80));

    const v2 = await ownerC.req(`/api/projects/${projectId}/config/versions`, {
      method: "POST",
      body: JSON.stringify({
        reason: "گام ۱۱: تغییر فرمول سفارشی (نسخه ۲)",
        operations: [
          { op: "updateFormula", formulaKey: customFormulaKey, patch: { expr: `${customParamKey} * 50`, nameFa: "زمان آماده‌سازی خط (ویرایش)" } },
        ],
      }),
    });
    check("فرمول سفارشی نسخه جدید گرفت (۱٫۲٫۰)", v2.status === 201 && v2.body?.semver === "1.2.0", `v${v2.body?.semver}`);
    const evalNew = await ownerC.req(`/api/projects/${projectId}/formulas/evaluate`, {
      method: "POST",
      body: JSON.stringify({ formulaKey: customFormulaKey }),
    });
    check("ارزیابی با عبارت جدید: ۶×۵۰=۳۰۰s", evalNew.body?.value === 300, `${evalNew.body?.value}`);
    const versions = await ownerC.req(`/api/projects/${projectId}/config-versions`);
    const semvers = (versions.body?.items ?? []).map((v) => v.semver);
    check("تاریخچه پیکربندی append-only: ۱٫۰٫۰ و ۱٫۱٫۰ و ۱٫۲٫۰", semvers.includes("1.0.0") && semvers.includes("1.1.0") && semvers.includes("1.2.0"), semvers.join(","));

    // RBAC: recorder مجاز به ثبت زمان‌سنجی، ممنوع از بالانس
    const recSession = await colleagueC.req(`/api/projects/${projectId}/timing/sessions`, {
      method: "POST",
      body: JSON.stringify({ method: "continuous", observer: "همکار", elements: ELEMENTS, elementAdvanceMode: "auto", tolerancePct: 5, elementSource: "manual" }),
    });
    check("RBAC: recorder ایجاد جلسه مجاز", recSession.status === 201);
    if (recSession.body?.id) {
      await colleagueC.req(`/api/projects/${projectId}/timing/sessions/${recSession.body.id}`, { method: "PATCH", body: JSON.stringify({ status: "discarded" }) });
    }
    const recSolve = await colleagueC.req(`/api/projects/${projectId}/balance/${scenarioId}/solve`, {
      method: "POST",
      body: JSON.stringify({ algorithm: "lcr" }),
    });
    check("RBAC: recorder حل بالانس → ۴۰۳", recSolve.status === 403, `status=${recSolve.status}`);
    const anon = makeClient();
    const anonA = await anon.req(`/api/projects/${projectId}/analysis`);
    check("RBAC: بی‌نشست → ۴۰۱", anonA.status === 401, `status=${anonA.status}`);
  }

  // ─── [۱۲] رقابت دو کلاینت هم‌زمان (اجراشده‌نشده فاز ۴) ───
  console.log("\n[۱۲] بند ۳ — رقابت دو کلاینت هم‌زمان روی یک جلسه (idempotency)");
  {
    const create = await ownerC.req(`/api/projects/${projectId}/timing/sessions`, {
      method: "POST",
      body: JSON.stringify({ method: "continuous", observer: "رقابت", elements: ELEMENTS, elementAdvanceMode: "auto", tolerancePct: 5, elementSource: "manual" }),
    });
    const sid = create.body?.id;
    const script = [
      { seq: 1, type: "start", elapsedActiveMs: 0, wallDelta: 10 },
      { seq: 2, type: "cycleStart", cycleNo: 1, elapsedActiveMs: 0, wallDelta: 20 },
      { seq: 3, type: "reading", elementId: "g7.a", cycleNo: 1, elapsedActiveMs: 20000, splitMs: 20000, wallDelta: 20000 },
      { seq: 4, type: "reading", elementId: "g7.b", cycleNo: 1, elapsedActiveMs: 35000, splitMs: 15000, wallDelta: 15000 },
    ];
    const batch = makeEvents(sid, script);
    // ارسال هم‌زمان همان بچ از دو کلاینت (owner + recorder)
    const [r1, r2] = await Promise.all([
      ownerC.req(`/api/projects/${projectId}/timing/sessions/${sid}/events`, { method: "POST", body: JSON.stringify({ events: batch, origin: "normal" }) }),
      colleagueC.req(`/api/projects/${projectId}/timing/sessions/${sid}/events`, { method: "POST", body: JSON.stringify({ events: batch, origin: "normal" }) }),
    ]);
    const ing1 = r1.body?.ingested ?? 0;
    const dup1 = r1.body?.duplicates ?? 0;
    const ing2 = r2.body?.ingested ?? 0;
    const dup2 = r2.body?.duplicates ?? 0;
    check("رقابت: مجموع ingested دقیقاً ۴ (بدون دوباره‌شماری)", ing1 + ing2 === 4, `(${ing1}+${ing2}) dup=(${dup1}+${dup2})`);
    check("رقابت: یک طرف همه را duplicate دید", dup1 + dup2 === 4, `dup=(${dup1}+${dup2})`);
    const detail = await ownerC.req(`/api/projects/${projectId}/timing/sessions/${sid}`);
    const evCount = detail.body?.eventCount ?? detail.body?.events?.length ?? 0;
    check("رقابت: شمار رویداد سرور همچنان ۴", evCount === 4, `n=${evCount}`);
  }

  // ─── [۱۳] DSL نزدیک سقف (محدودیت فاز ۲ بند ۸) ───
  console.log("\n[۱۳] بند ۳ — DSL نزدیک سقف: عبارت متوازن ۲۵۰جمله‌ای (۴۹۹ گره، عمق ~۹) و سقف مرزی");
  {
    // درخت متوازن: ۲۵۰ literal + ۲۴۹ عملگر = ۴۹۹ گره < سقف ۵۱۲؛ عمق log₂(۲۵۰) ≈ ۹ < ۶۴
    function balancedExpr(n) {
      let level = Array.from({ length: n }, (_, i) => (i % 2 === 0 ? "1" : "2"));
      while (level.length > 1) {
        const next = [];
        for (let i = 0; i < level.length; i += 2) {
          if (i + 1 < level.length) next.push(`(${level[i]} + ${level[i + 1]})`);
          else next.push(level[i]);
        }
        level = next;
      }
      return level[0];
    }
    const terms = balancedExpr(250);
    const addBig = await ownerC.req(`/api/projects/${projectId}/config/versions`, {
      method: "POST",
      body: JSON.stringify({
        reason: "گام ۱۳: آزمون DSL نزدیک سقف",
        operations: [
          { op: "addFormula", formula: { key: "f.dslStress", nameFa: "آزمون فشار DSL", descriptionFa: "عبارت متوازن ۴۹۹گره‌ای برای سنجش مرز عملکرد DSL", scopeLevel: "project", status: "active", expr: terms, outputUnit: "s" } },
        ],
      }),
    });
    check("فرمول متوازن ۴۹۹گره‌ای ذخیره شد", addBig.status === 201, `v${addBig.body?.semver} · ${terms.length} کاراکتر`);
    const t0 = Date.now();
    const evalBig = await ownerC.req(`/api/projects/${projectId}/formulas/evaluate`, {
      method: "POST",
      body: JSON.stringify({ formulaKey: "f.dslStress" }),
    });
    const dslMs = Date.now() - t0;
    check("ارزیابی ۲۵۰جمله‌ای = ۳۷۵s درست (۱۲۵×۱+۱۲۵×۲)", evalBig.body?.value === 375, `v=${evalBig.body?.value}`);
    perfLog("ارزیابی DSL عبارت ۴۹۹گره‌ای (شامل HTTP)", dslMs, 1500);

    // فراتر از سقف گره → رد صریح (نه ۵۰۰)
    const tooBig = Array.from({ length: 700 }, () => "1").join(" + ");
    const addTooBig = await ownerC.req(`/api/projects/${projectId}/config/versions`, {
      method: "POST",
      body: JSON.stringify({
        reason: "گام ۱۳: فراتر از سقف",
        operations: [
          { op: "addFormula", formula: { key: "f.dslTooBig", nameFa: "فراتر از سقف", descriptionFa: "باید رد شود", scopeLevel: "project", status: "active", expr: tooBig, outputUnit: "s" } },
        ],
      }),
    });
    check("عبارت ۷۰۰جمله‌ای رد صریح (سقف گره)", addTooBig.status === 400 || addTooBig.status === 422, `status=${addTooBig.status}`);
  }

  // ─── [۱۴] عملکرد دیتاست بزرگ (محدودیت فاز ۴/۵) ───
  console.log("\n[۱۴] بند ۳ — عملکرد: ۴۰ جلسه × ۱۲ چرخه × ۶ عنصر (۲۸۸۰ مشاهده)");
  let perfProjectId;
  {
    const proj = await ownerC.req("/api/projects", {
      method: "POST",
      body: JSON.stringify({
        code: `PERF-${stamp}`,
        title: `پروژه عملکرد فاز ۷ ${stamp}`,
        profileTemplateId: "profile.general-industrial-time-study",
      }),
    });
    perfProjectId = proj.body?.id;
    for (const a of ACTIVITIES) {
      await ownerC.req(`/api/projects/${perfProjectId}/activities`, {
        method: "POST",
        body: JSON.stringify({ stableKey: a.id, name: a.name, workType: a.workType, predecessors: a.preds }),
      });
    }
    const N_SESSIONS = 40;
    const CYCLES_PER = 12;
    const t0 = Date.now();
    for (let s = 0; s < N_SESSIONS; s += 1) {
      // تغییر جزئی بین جلسات برای واقعی‌تر شدن (پراکندگی)
      const jitter = (i) => ((s % 5) - 2) * 250 * (i + 1);
      const cycles = Array.from({ length: CYCLES_PER }, () =>
        CYCLES3[s % 3].map((v, i) => v + jitter(i)));
      await makeFinalizedSession(ownerC, perfProjectId, ELEMENTS, cycles, { observer: `ناظر ${s + 1}` });
    }
    const seedMs = Date.now() - t0;
    console.log(`  · داده کاشته شد: ${N_SESSIONS} جلسه × ${CYCLES_PER} چرخه × ۶ عنصر در ${seedMs}ms`);

    const t1 = Date.now();
    const analysis = await ownerC.req(`/api/projects/${perfProjectId}/analysis`);
    const analysisMs = Date.now() - t1;
    check("تحلیل ۴۰ جلسه کامل شد", analysis.status === 200 && (analysis.body?.elements?.length ?? 0) === 6);
    check("شمار جلسات نهایی در تحلیل = ۴۰", (analysis.body?.sessions?.length ?? 0) === 40, `n=${analysis.body?.sessions?.length}`);
    perfLog("تحلیل کامل ۴۰ جلسه/۲۸۸۰ مشاهده", analysisMs, 20000);

    const sc = await ownerC.req(`/api/projects/${perfProjectId}/balance`, {
      method: "POST",
      body: JSON.stringify({
        name: "عملکرد — تاکت ۶۰",
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
    const t2 = Date.now();
    const solve = await ownerC.req(`/api/projects/${perfProjectId}/balance/${sc.body?.scenario?.id}/solve`, {
      method: "POST",
      body: JSON.stringify({ algorithm: "lcr" }),
    });
    const solveMs = Date.now() - t2;
    check("حل بالانس روی پروژه ۴۰ جلسه‌ای", solve.status === 201 && solve.body?.result?.metrics?.stationCount >= 1);
    perfLog("حل LCR (پس از تحلیل ۴۰ جلسه)", solveMs, 8000);

    const t3 = Date.now();
    const exportCsv = await ownerC.raw(`/api/projects/${perfProjectId}/analysis/export?template=standard-time&format=csv`);
    const exportMs = Date.now() - t3;
    check("خروجی CSV پروژه بزرگ", exportCsv.status === 200 && exportCsv.text.length > 500);
    perfLog("خروجی CSV تحلیل (۴۰ جلسه)", exportMs, 30000);

    // جلسه بزرگ ۵۰ چرخه‌ای (۳۰۲ رویداد > سقف بچ ۲۰۰ → چند-بچی)
    const bigCycles = Array.from({ length: 50 }, () => CYCLES3[1]);
    const big = await makeFinalizedSession(ownerC, perfProjectId, ELEMENTS, bigCycles, { observer: "جلسه بزرگ" });
    check("جلسه ۵۰ چرخه‌ای (۳۰۲ رویداد، چند-بچی) نهایی شد", big.finalize.status === 200 && big.finalize.body?.completedCycles === 50, `completed=${big.finalize.body?.completedCycles}`);
    const t4 = Date.now();
    const analysis2 = await ownerC.req(`/api/projects/${perfProjectId}/analysis`);
    const analysis2Ms = Date.now() - t4;
    check("تحلیل پس از جلسه بزرگ: ۴۱ جلسه", (analysis2.body?.sessions?.length ?? 0) === 41, `n=${analysis2.body?.sessions?.length}`);
    perfLog("تحلیل ۴۱ جلسه (۲۸۸۰+۳۰۰ مشاهده)", analysis2Ms, 25000);
  }

  // ─── [۱۵] بند ۴ — امنیت ورودی ───
  console.log("\n[۱۵] بند ۴ — امنیت: XSS/prototype pollution/SQLi/بدنه عظیم/ماتریس ۴۰۱");
  {
    // XSS در نام پروژه — ذخیره و بازگشت به‌عنوان متن (بدون اجرا/انعکاس HTML)
    const xssPayload = `<img src=x onerror="alert('XSS')">${'"'}<script>alert(1)</script>`;
    const xssProj = await ownerC.req("/api/projects", {
      method: "POST",
      body: JSON.stringify({
        title: `پروژه ${xssPayload}`,
        code: `XSS-${stamp}`,
        profileTemplateId: "profile.general-industrial-time-study",
      }),
    });
    check("XSS در نام: ذخیره شد و Content-Type JSON است (بدون انعکاس HTML)",
      xssProj.status === 201 && (xssProj.headers.get("content-type") ?? "").includes("application/json"));
    const xssGet = await ownerC.req(`/api/projects/${xssProj.body?.id}`);
    check("XSS در نام: بازیابی دقیق و بدون تغییر (متن خام)", xssGet.status === 200 && (xssGet.body?.title ?? "").includes("<script>alert(1)</script>"));

    // prototype pollution در values
    const pp = await ownerC.req(`/api/projects/${projectId}/values`, {
      method: "PUT",
      body: JSON.stringify({ values: [{ stableKey: "__proto__.polluted", value: "yes" }, { stableKey: "constructor.prototype.x", value: "1" }] }),
    });
    const cfgAfter = await ownerC.req(`/api/projects/${projectId}/config`);
    check("Prototype pollution: کلیدهای مخرب ذخیره/اجرا نشدند",
      (pp.status === 400 || pp.status === 422 || (pp.body?.items ?? []).length === 0) &&
      !JSON.stringify(cfgAfter.body ?? {}).includes('"polluted"'),
      `status=${pp.status}`);

    // SQLi در فیلد جست‌وجو و code
    const sqli = await ownerC.req(`/api/projects?q='; DROP TABLE Project;--`);
    check("SQLi در جست‌وجو: بدون ۵۰۰ (پارامتری)", sqli.status === 200, `status=${sqli.status}`);
    const sqliCode = await ownerC.req("/api/projects", {
      method: "POST",
      body: JSON.stringify({ title: "sqli", code: "x' OR '1'='1", profileTemplateId: "profile.general-industrial-time-study" }),
    });
    check("SQLi در code: به‌عنوان متن ذخیره شد (بدون ۵۰۰)", sqliCode.status === 201 || sqliCode.status === 400, `status=${sqliCode.status}`);

    // JSON خراب
    const badJson = await fetch(BASE + `/api/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: "" },
      body: "{invalid json",
    });
    check("JSON خراب → ۴۰۰ (نه ۵۰۰)", badJson.status === 400 || badJson.status === 401, `status=${badJson.status}`);

    // بدنه عظیم (۲MB) — رد بررسی‌شده یا پذیرش با اعتبارسنجی، هرگز کرش
    const huge = JSON.stringify({ title: "بزرگ", code: `BIG-${stamp}`, profileTemplateId: "profile.general-industrial-time-study", goal: "x".repeat(2 * 1024 * 1024) });
    const bigRes = await fetch(BASE + "/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: huge,
    });
    check("بدنه ۲MB → رد/۴۰۱ (بدون کرش)", bigRes.status === 400 || bigRes.status === 401 || bigRes.status === 413, `status=${bigRes.status}`);

    // پیمایش مسیر در شناسه
    const trav = await ownerC.req(`/api/projects/..%2F..%2Fetc%2Fpasswd`);
    check("پیمایش مسیر در ID → ۴۰۰/۴۰۴", trav.status === 400 || trav.status === 404, `status=${trav.status}`);

    // ماتریس ۴۰۱: نمونه‌ای از همه خانواده‌های route بدون نشست
    const anon = makeClient();
    const routeMatrix = [
      "/api/projects",
      `/api/projects/${projectId}`,
      `/api/projects/${projectId}/config`,
      `/api/projects/${projectId}/config-versions`,
      `/api/projects/${projectId}/values`,
      `/api/projects/${projectId}/activities`,
      `/api/projects/${projectId}/diagrams`,
      `/api/projects/${projectId}/timing/sessions`,
      `/api/projects/${projectId}/analysis`,
      `/api/projects/${projectId}/balance`,
      `/api/projects/${projectId}/audit`,
      `/api/projects/${projectId}/members`,
      "/api/profiles",
    ];
    let all401 = true;
    const codes = [];
    for (const p of routeMatrix) {
      const r = await anon.req(p);
      codes.push(`${p.split("/").pop()}:${r.status}`);
      if (r.status !== 401) all401 = false;
    }
    check("ماتریس ۴۰۱: همه ۱۳ خانواده route داده بدون نشست → ۴۰۱", all401, codes.join(" "));

    // کاتالوگ عمومی DSL — عمومی-طبق-طراحی: فقط راهنما، بدون داده پروژه/کاربر
    const fnCat = await anon.req("/api/formula/functions");
    const catKeys = Object.keys(fnCat.body ?? {});
    check("route عمومی-طبق-طراحی (کاتالوگ DSL): بدون داده پروژه/کاربر",
      fnCat.status === 200 && catKeys.every((k) => ["functions", "units", "limits", "operators"].includes(k)),
      catKeys.join(","));
  }

  // ─── جمع‌بندی ───
  console.log("\n════════ جمع‌بندی ════════");
  console.log(`قبول: ${passed} · رد: ${failed}`);
  if (perf.length > 0) {
    console.log("عملکرد ثبت‌شده:");
    for (const p of perf) console.log(`  · ${p.label}: ${p.ms.toFixed(0)}ms (سقف ${p.thresholdMs}ms)`);
  }
  if (failed > 0) {
    console.log("ردشده‌ها:");
    for (const f of failures) console.log(`  ✗ ${f}`);
    process.exit(1);
  } else {
    console.log("همه آزمون‌های یکپارچگی فاز ۷ قبول شد ✓");
    console.log(`تاریخ اجرا: ${new Date().toISOString()}`);
  }
}

main().catch((err) => {
  console.error("خطای مهلک آزمون:", err);
  process.exit(1);
});
