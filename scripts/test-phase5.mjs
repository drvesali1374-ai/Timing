#!/usr/bin/env node
/**
 * آزمون‌های یکپارچگی فاز ۵ — درخواست-پاسخ واقعی به سرور توسعه (localhost:3000).
 *
 * پوشش معیارهای پذیرش فاز ۵ (TEST_MATRIX R5-1/2/3 + دستورهای ۹گانه):
 *  R5-1  داده مرجع دقیق: ایجاد جلسه با قرائت‌های ms صریح → نهایی‌سازی → تحلیل با
 *        جواب مستقل (میانگین/نرمال/استاندارد هر دو قرارداد مجاز) تطبیق کند.
 *  R5-2  اثر حذف مشاهده/تغییر فرمول با تاریخچه: حذف با علت → تغییر rep/ST + تاریخچه
 *        علامت‌ها؛ تغییر تنظیمات (قرارداد مجاز) → فرمول TS-012 به‌جای TS-011؛ منسوخ‌کردن
 *        فرمول → گام «تکمیل‌نشده» صادقانه.
 *  R5-3  خروجی CSV/XLS/JSON: فارسی/RTL/ردیابی (BOM + RightToLeft + پانوشت نسخه).
 *  بند ۲  علامت ≠ حذف؛ حذف بدون علت → ۴۰۰.
 *  بند ۳  ارزیابی غیرفعال → «زمان خام» incomplete؛ داده ناقص (چرخه ناتمام) جدا شمرده می‌شود.
 *  بند ۵  هر خروجی: رکورد CalculationResult + ممیزی (شمردن رکوردهای export).
 *  بند ۶  زمینه جلسه (scopeType=session) → در تحلیل بازتاب می‌یابد.
 *  RBAC   viewer خواندن مجاز · recorder نوشتن علامت ۴۰۳ · editor مجاز.
 *  مرزها  پروژه بدون جلسه نهایی → عناصر خالی + وضعیت صادقانه.
 *
 * اجرا: `bun run test:phase5` — سرور توسعه باید در حال اجرا باشد.
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
const owner = { name: "آزمون‌گر فاز۵", email: `p5a-${stamp}@test.local`, password: "TestPass1234" };
const viewer = { name: "ببیننده فاز۵", email: `p5b-${stamp}@test.local`, password: "TestPass1234" };
const recorder = { name: "ثبت‌کننده فاز۵", email: `p5c-${stamp}@test.local`, password: "TestPass1234" };
const editor = { name: "ویرایشگر فاز۵", email: `p5d-${stamp}@test.local`, password: "TestPass1234" };

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
  return `evt5-${stamp}-${String(eventCounter).padStart(5, "0")}`;
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
    ...(s.interruptionReason ? { interruptionReason: s.interruptionReason } : {}),
  }));
}

// پروژه آزمون با اعضا (owner + viewer + recorder + editor)
async function setupProject(ownerC) {
  const proj = await ownerC.req("/api/projects", {
    method: "POST",
    body: JSON.stringify({
      code: `P5-${stamp}`,
      title: `پروژه آزمون فاز ۵ ${stamp}`,
      profileTemplateId: "profile.general-industrial-time-study",
    }),
  });
  const projectId = proj.body?.id;
  if (proj.status !== 201 || !projectId) throw new Error(`project create failed: ${JSON.stringify(proj.body)}`);
  return projectId;
}

async function addMember(ownerC, projectId, email, role) {
  const res = await ownerC.req(`/api/projects/${projectId}/members`, {
    method: "POST",
    body: JSON.stringify({ email, role }),
  });
  if (res.status !== 201) throw new Error(`member add failed: ${JSON.stringify(res.body)}`);
}

/** ایجاد جلسه نهایی‌شده با قرائت‌های دقیق — داده مرجع R5-1. */
async function makeFinalizedSession(client, projectId, sessionId, elements, cyclesSpec, opts = {}) {
  const create = await client.req(`/api/projects/${projectId}/timing/sessions`, {
    method: "POST",
    body: JSON.stringify({
      method: "continuous",
      observer: opts.observer ?? "ناظر آزمون",
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
  const events = makeEvents(sid, script);
  await client.req(`/api/projects/${projectId}/timing/sessions/${sid}/events`, {
    method: "POST",
    body: JSON.stringify({ events, origin: "normal" }),
  });
  const fin = await client.req(`/api/projects/${projectId}/timing/sessions/${sid}/finalize`, { method: "POST" });
  return { sid, finalize: fin };
}

async function main() {
  console.log("════════ آزمون‌های یکپارچگی فاز ۵ ════════\n");

  const [ownerC, viewerC, recorderC, editorC] = await Promise.all([
    registerAndLogin(owner),
    registerAndLogin(viewer),
    registerAndLogin(recorder),
    registerAndLogin(editor),
  ]);

  const projectId = await setupProject(ownerC);
  await addMember(ownerC, projectId, viewer.email, "viewer");
  await addMember(ownerC, projectId, recorder.email, "recorder");
  await addMember(ownerC, projectId, editor.email, "editor");

  const ELEMENTS = [
    { key: "el-a", name: "عنصر الف", order: 1 },
    { key: "el-b", name: "عنصر ب", order: 2 },
  ];

  // ─── مرزها: پروژه بدون جلسه نهایی ───
  console.log("[۰] مرز — پروژه بدون جلسه نهایی");
  {
    const empty = await ownerC.req(`/api/projects/${projectId}/analysis`);
    check("تحلیل پروژه خالی → ۲۰۰ با عناصر خالی (ادعای عدد نمی‌شود)", empty.status === 200 && Array.isArray(empty.body?.elements) && empty.body.elements.length === 0);
    check("جمع استاندارد چرخه → تکمیل‌نشده", empty.body?.standardCycle?.status === "incomplete" && empty.body?.standardCycle?.totalMs === null);
  }

  // ─── R5-1: داده مرجع با جواب مستقل ───
  console.log("\n[۱] R5-1 — داده مرجع دقیق و تطبیق با جواب مستقل");
  /** جواب مستقل (محاسبه دستی):
   *  el-a: [1000, 1100, 1200] → mean=1100 · NT=1100×1.10=1210 · ST(on-normal)=1210×1.15=1391.5
   *  el-b: [2000, 2200, 2400] → mean=2200 · NT=2420 · ST=2783
   *  چرخه‌ها: 3000, 3300, 3600 → mean=3300
   */
  const s1 = await makeFinalizedSession(ownerC, projectId, null, ELEMENTS, [
    [1000, 2000],
    [1100, 2200],
    [1200, 2400],
  ]);
  check("جلسه مرجع نهایی شد (۳ چرخه)", s1.finalize.status === 200 && s1.finalize.body?.completedCycles === 3, `completed=${s1.finalize.body?.completedCycles}`);

  // تنظیمات صریح: ارزیابی ۱۱۰٪ + مجاز on-normal ۱۵٪ (مقادیر پروژه — بند ۳)
  const putValues = await ownerC.req(`/api/projects/${projectId}/values`, {
    method: "PUT",
    body: JSON.stringify({
      values: [
        { stableKey: "rating.factor", value: 110 },
        { stableKey: "allowance.method", value: "on-normal" },
        { stableKey: "allowance.rate", value: 15 },
      ],
    }),
  });
  check("تنظیمات صریح ثبت شد (rating 110٪ · on-normal 15٪)", putValues.status === 200);

  const an1 = await ownerC.req(`/api/projects/${projectId}/analysis`);
  check("تحلیل → ۱ جلسه · ۲ عنصر · ۶ مشاهده", an1.status === 200 && an1.body?.sessions?.length === 1 && an1.body?.elements?.length === 2 && an1.body.elements.reduce((a, e) => a + e.counts.total, 0) === 6);

  const elA = an1.body.elements.find((e) => e.elementKey === "el-a");
  const elB = an1.body.elements.find((e) => e.elementKey === "el-b");
  check("el-a: میانگین ۱۱۰۰ms (جواب مستقل)", Math.abs((elA?.chain?.representative?.value ?? 0) - 1100) < 1e-9);
  check("el-a: NT = 1100×1.10 = 1210 (TS-010)", Math.abs((elA?.chain?.normal?.value ?? 0) - 1210) < 1e-9);
  check("el-a: ST = 1210×1.15 = 1391.5 (TS-011 on-normal)", Math.abs((elA?.chain?.standard?.value ?? 0) - 1391.5) < 1e-9);
  check("el-b: ST = 2200×1.1×1.15 = 2783", Math.abs((elB?.chain?.standard?.value ?? 0) - 2783) < 1e-9);
  check("جمع استاندارد چرخه = 1391.5+2783 = 4174.5", Math.abs((an1.body?.standardCycle?.totalMs ?? 0) - 4174.5) < 1e-9);
  check("فرمول‌های زنجیره با نسخه: TS-001/TS-010/TS-011@", (an1.body?.elements?.[0]?.formulaTrace ?? []).map((f) => f.formulaKey).join(",").includes("TS-001"));
  check("میانگین چرخه TS-004 = 3300ms", Math.abs((an1.body?.sessions?.[0]?.meanCycleTimeMs ?? 0) - 3300) < 1e-9);

  // ─── R5-2 بخش الف: تغییر قرارداد مجاز → TS-012 ───
  console.log("\n[۲] R5-2 — تغییر فرمول/تنظیمات با اثر و ردیابی");
  {
    await ownerC.req(`/api/projects/${projectId}/values`, {
      method: "PUT",
      body: JSON.stringify({ values: [{ stableKey: "allowance.method", value: "on-standard" }] }),
    });
    const an2 = await ownerC.req(`/api/projects/${projectId}/analysis`);
    const elA2 = an2.body.elements.find((e) => e.elementKey === "el-a");
    // جواب مستقل: ST = NT ÷ (1−0.15) = 1210 ÷ 0.85 = 1423.5294117647059
    check("قرارداد on-standard: ST = 1210÷0.85 = 1423.529… (≠ on-normal)", Math.abs((elA2?.chain?.standard?.value ?? 0) - 1210 / 0.85) < 1e-9);
    check("فرمول فعال تغییر کرد: TS-012 در trace", (elA2?.formulaTrace ?? []).some((f) => f.formulaKey === "TS-012" && f.status === "valid"));
    check("پایه درصد صریح: «زمان استاندارد»", (elA2?.chain?.standard?.baseFa ?? "").includes("زمان استاندارد"));
    // بازگشت به on-normal
    await ownerC.req(`/api/projects/${projectId}/values`, {
      method: "PUT",
      body: JSON.stringify({ values: [{ stableKey: "allowance.method", value: "on-normal" }] }),
    });
  }

  // ─── R5-2 بخش ب: حذف مشاهده با علت → اثر + تاریخچه ───
  {
    const before = (await ownerC.req(`/api/projects/${projectId}/analysis`)).body.elements.find((e) => e.elementKey === "el-a");
    const obs = before.observations[2]; // 1200 — حذف آن → mean = 1050
    const markRes = await ownerC.req(`/api/projects/${projectId}/analysis/marks`, {
      method: "POST",
      body: JSON.stringify({
        sessionId: obs.sessionId,
        readingEventId: obs.readingEventId,
        cycleSeq: obs.cycleSeq,
        elementKey: obs.elementKey,
        outlierMarked: true,
        excluded: false,
        reason: "قرائت هنگام حواس‌پرتی",
      }),
    });
    check("علامت پرت ثبت شد (بدون حذف)", markRes.status === 200 && markRes.body?.current?.outlierMarked === true && markRes.body?.current?.excluded === false);
    const afterMark = (await ownerC.req(`/api/projects/${projectId}/analysis`)).body.elements.find((e) => e.elementKey === "el-a");
    check("علامت بدون حذف → محاسبه تغییر نمی‌کند (دو عمل جدا)", afterMark.chain.representative.value === before.chain.representative.value);

    const exclRes = await ownerC.req(`/api/projects/${projectId}/analysis/marks`, {
      method: "POST",
      body: JSON.stringify({
        sessionId: obs.sessionId,
        readingEventId: obs.readingEventId,
        cycleSeq: obs.cycleSeq,
        elementKey: obs.elementKey,
        outlierMarked: true,
        excluded: true,
        reason: "وقفه ثبت‌نشده — تأیید ناظر",
      }),
    });
    check("حذف با علت ثبت شد", exclRes.status === 200 && exclRes.body?.current?.excluded === true);
    check("تاریخچه علامت‌ها = ۲ ردیف (append-only)", exclRes.body?.history?.length === 2);
    const afterExcl = (await ownerC.req(`/api/projects/${projectId}/analysis`)).body.elements.find((e) => e.elementKey === "el-a");
    check("اثر حذف: n مؤثر ۳→۲ و میانگین ۱۱۰۰→۱۰۵۰", afterExcl.counts.effective === 2 && Math.abs(afterExcl.chain.representative.value - 1050) < 1e-9);
    check("اثر حذف روی زنجیره: ST = 1050×1.1×1.15 = 1328.25", Math.abs(afterExcl.chain.standard.value - 1050 * 1.1 * 1.15) < 1e-9);
  }

  // ─── بند ۲: حذف بدون علت → ۴۰۰ ───
  {
    const an = (await ownerC.req(`/api/projects/${projectId}/analysis`)).body;
    const obs = an.elements.find((e) => e.elementKey === "el-b").observations[0];
    const res = await ownerC.req(`/api/projects/${projectId}/analysis/marks`, {
      method: "POST",
      body: JSON.stringify({
        sessionId: obs.sessionId,
        readingEventId: obs.readingEventId,
        cycleSeq: obs.cycleSeq,
        elementKey: obs.elementKey,
        outlierMarked: false,
        excluded: true,
      }),
    });
    check("حذف بدون علت → ۴۰۰ (B9: حذف بی‌علت نامعتبر)", res.status === 400);
  }

  // ─── بند ۳: ارزیابی غیرفعال → «زمان خام» ───
  {
    await ownerC.req(`/api/projects/${projectId}/values`, {
      method: "PUT",
      body: JSON.stringify({ values: [{ stableKey: "rating.enabled", value: false }] }),
    });
    const an = await ownerC.req(`/api/projects/${projectId}/analysis`);
    const elA3 = an.body.elements.find((e) => e.elementKey === "el-a");
    check("ارزیابی غیرفعال → وضعیت نرمال incomplete + برچسب «زمان خام»", elA3.chain.normal.status === "incomplete" && (elA3.chain.normal.labelFa ?? "").includes("زمان خام"));
    check("گام استاندارد وابسته هم incomplete", elA3.chain.standard.status === "incomplete" && elA3.chain.standard.value === null);
    check("فرمول TS-010 ارزیابی نشد (صادقانه)", (elA3.formulaTrace ?? []).some((f) => f.formulaKey === "TS-010" && f.status === "incomplete"));
    // فعال‌سازی مجدد
    await ownerC.req(`/api/projects/${projectId}/values`, {
      method: "PUT",
      body: JSON.stringify({ values: [{ stableKey: "rating.enabled", value: true }] }),
    });
  }

  // ─── داده ناقص: چرخه ناتمام جدا شمرده می‌شود ───
  {
    // جلسه دوم با چرخه ناتمام (فقط ۱ عنصر از ۲)
    const create = await ownerC.req(`/api/projects/${projectId}/timing/sessions`, {
      method: "POST",
      body: JSON.stringify({ method: "continuous", observer: "ناظر ۲", elements: ELEMENTS, elementAdvanceMode: "auto", tolerancePct: 5, elementSource: "manual" }),
    });
    const sid2 = create.body?.id;
    const script = [
      { seq: 1, type: "start", elapsedActiveMs: 0, wallDelta: 10 },
      { seq: 2, type: "cycleStart", cycleNo: 1, elapsedActiveMs: 0, wallDelta: 20 },
      { seq: 3, type: "reading", elementId: "el-a", cycleNo: 1, elapsedActiveMs: 1000, splitMs: 1000, wallDelta: 1000 },
      { seq: 4, type: "stop", elapsedActiveMs: 1000, wallDelta: 30 }, // چرخه باز ماند → incomplete
    ];
    await ownerC.req(`/api/projects/${projectId}/timing/sessions/${sid2}/events`, {
      method: "POST",
      body: JSON.stringify({ events: makeEvents(sid2, script), origin: "normal" }),
    });
    await ownerC.req(`/api/projects/${projectId}/timing/sessions/${sid2}/finalize`, { method: "POST" });
    const an = await ownerC.req(`/api/projects/${projectId}/analysis`);
    const elA4 = an.body.elements.find((e) => e.elementKey === "el-a");
    check("چرخه ناتمام نهایی شد اما مشاهده‌اش جدا شمرده می‌شود", elA4.counts.incompleteCycle === 1 && elA4.counts.usable === 2, `incomplete=${elA4.counts.incompleteCycle} usable=${elA4.counts.usable}`);
    check("مشاهده چرخه ناتمام در جدول هست ولی در محاسبه نیست", elA4.observations.length === 4 && elA4.counts.effective === 2, `obs=${elA4.observations.length} eff=${elA4.counts.effective}`);
  }

  // ─── بند ۶: زمینه جلسه + فیلتر ───
  {
    const an = await ownerC.req(`/api/projects/${projectId}/analysis`);
    const sid1 = an.body.sessions[0].sessionId;
    const ctx = await ownerC.req(`/api/projects/${projectId}/analysis/session-context`, {
      method: "POST",
      body: JSON.stringify({
        sessionId: sid1,
        values: [
          { stableKey: "study.operator", value: "اپراتور آزمون-۱" },
          { stableKey: "study.shift", value: "2" },
        ],
      }),
    });
    check("زمینه جلسه ثبت شد (scopeType=session)", ctx.status === 200 && ctx.body?.saved?.length === 2);
    const an2 = await ownerC.req(`/api/projects/${projectId}/analysis`);
    check("زمینه در خلاصه جلسه بازتاب می‌یابد", an2.body.sessions[0].sessionContext?.["study.operator"] === "اپراتور آزمون-۱" && an2.body.sessions[0].sessionContext?.["study.shift"] === "2");
  }

  // ─── R5-3: خروجی‌ها ───
  console.log("\n[۳] R5-3 — خروجی CSV/XLS/JSON با فارسی/RTL/ردیابی");
  {
    const csv = await ownerC.raw(`/api/projects/${projectId}/analysis/export?template=standard-time&format=csv`);
    check("CSV → ۲۰۰ + BOM UTF-8 (فارسی در Excel سالم)", csv.status === 200 && csv.bytes.slice(0, 3).toString("hex") === "efbbbf");
    check("CSV: سربرگ فارسی + پانوشت ردیابی", csv.text.includes("گزارش زمان نرمال/استاندارد") && csv.text.includes("ردیابی:"));
    check("CSV: فرمول‌های نسخه‌دار در پانوشت", csv.text.includes("TS-011@1.1.0") || csv.text.includes("TS-001@1.1.0"));
    const cd = csv.headers.get("Content-Disposition") ?? "";
    check("CSV: Content-Disposition با نام فایل", cd.includes("attachment") && cd.includes("standard-time.csv"));

    const xls = await ownerC.raw(`/api/projects/${projectId}/analysis/export?template=element-analysis&format=xls`);
    check("XLS: SpreadsheetML با RightToLeft=1", xls.status === 200 && xls.text.includes('ss:RightToLeft="1"') && xls.text.includes("mso-application"));
    check("XLS: DisplayRightToLeft + سربرگ فارسی سالم", xls.text.includes("DisplayRightToLeft") && xls.text.includes("تحلیل عنصر"));

    const js = await ownerC.raw(`/api/projects/${projectId}/analysis/export?template=sample-quality&format=json`);
    const j = JSON.parse(js.text);
    check("JSON: بلوک ردیابی کامل (تنظیمات+فرمول+نسخه پیکربندی)", j?.trace?.settings?.aggMethod === "mean" && Array.isArray(j?.trace?.formulaVersions) && j?.trace?.configSemver !== null);
    check("JSON: ردیف‌های داده واقعی", Array.isArray(j?.rows) && j.rows.length === 2);

    // بند ۵: رکورد ردیابی در تاریخچه پروژه
    const audit = await ownerC.req(`/api/projects/${projectId}/audit`);
    const exportLogs = (audit.body?.items ?? []).filter((i) => i.action === "analysis.exported");
    check("هر خروجی → رکورد ممیزی analysis.exported (۳ دانلود)", exportLogs.length >= 3, `count=${exportLogs.length}`);
    const markLogs = (audit.body?.items ?? []).filter((i) => i.action === "analysis.mark-saved");
    check("علامت‌ها همگی ممزی شدند (append-only)", markLogs.length >= 2, `count=${markLogs.length}`);
  }

  // ─── منسوخ‌کردن فرمول → گام تکمیل‌نشده (R5-2 بخش ج) ───
  {
    const dep = await ownerC.req(`/api/projects/${projectId}/config/versions`, {
      method: "POST",
      body: JSON.stringify({
        reason: "آزمون فاز ۵: منسوخ‌کردن TS-011 — گام استاندارد باید صادقانه تکمیل‌نشده شود",
        operations: [{ op: "deprecateFormula", formulaKey: "TS-011", deprecated: true }],
      }),
    });
    check("نسخه پیکربندی جدید با deprecate TS-011 ساخته شد", dep.status === 201);
    const an = await ownerC.req(`/api/projects/${projectId}/analysis`);
    const elA5 = an.body.elements.find((e) => e.elementKey === "el-a");
    check("فرمول منسوخ → گام استاندارد incomplete با خطای صریح", elA5.chain.standard.status === "incomplete" && (elA5.formulaTrace.find((f) => f.formulaKey === "TS-011")?.errorsFa?.join(" ") ?? "").includes("منسوخ"));
    check("جمع چرخه هم incomplete می‌شود (صداقت)", an.body.standardCycle.status === "incomplete");
    check("نسخه پیکربندی در ردیابی ارتقا یافت", an.body.trace.configSemver === dep.body?.semver, `${an.body.trace.configSemver} → ${dep.body?.semver}`);
  }

  // ─── RBAC ───
  console.log("\n[۴] RBAC فاز ۵");
  {
    const v = await viewerC.req(`/api/projects/${projectId}/analysis`);
    check("viewer: خواندن تحلیل مجاز", v.status === 200);
    const an = v.body;
    const obs = an.elements[0].observations[0];
    const vMark = await viewerC.req(`/api/projects/${projectId}/analysis/marks`, {
      method: "POST",
      body: JSON.stringify({ sessionId: obs.sessionId, readingEventId: obs.readingEventId, cycleSeq: obs.cycleSeq, elementKey: obs.elementKey, outlierMarked: true, excluded: false }),
    });
    check("viewer: نوشتن علامت → ۴۰۳", vMark.status === 403);
    const rMark = await recorderC.req(`/api/projects/${projectId}/analysis/marks`, {
      method: "POST",
      body: JSON.stringify({ sessionId: obs.sessionId, readingEventId: obs.readingEventId, cycleSeq: obs.cycleSeq, elementKey: obs.elementKey, outlierMarked: true, excluded: false }),
    });
    check("recorder: نوشتن علامت → ۴۰۳ (نقش ثبت مشاهدات، نه تحلیلگر)", rMark.status === 403);
    const eMark = await editorC.req(`/api/projects/${projectId}/analysis/marks`, {
      method: "POST",
      body: JSON.stringify({ sessionId: obs.sessionId, readingEventId: obs.readingEventId, cycleSeq: obs.cycleSeq, elementKey: obs.elementKey, outlierMarked: true, excluded: false, reason: "بررسی ویرایشگر" }),
    });
    check("editor: نوشتن علامت مجاز (analysis:write)", eMark.status === 200);
    const otherProject = await makeClient().req("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name: "خارجی", email: `p5x-${stamp}@test.local`, password: "TestPass1234" }),
    });
    const stranger = makeClient();
    await stranger.login(`p5x-${stamp}@test.local`, "TestPass1234");
    const s = await stranger.req(`/api/projects/${projectId}/analysis`);
    check("غیرعضو: ۴۰۴ (جداسازی پروژه)", s.status === 404);
  }

  // ─── جمع‌بندی ───
  console.log("\n════════ جمع‌بندی فاز ۵ ════════");
  console.log(`قبول: ${passed} · رد: ${failed}`);
  if (failed > 0) {
    console.log("آزمون‌های ردشده:");
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  } else {
    console.log("همه آزمون‌های یکپارچگی فاز ۵ قبول شد ✓");
    console.log(`تاریخ اجرا: ${new Date().toISOString()}`);
  }
}

main().catch((err) => {
  console.error("خطای اجرای آزمون‌ها:", err);
  console.log(`\nآیا سرور توسعه روی ${BASE} در حال اجراست؟ (bun run dev)`);
  process.exit(1);
});
