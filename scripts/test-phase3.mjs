#!/usr/bin/env node
/**
 * آزمون‌های یکپارچگی فاز ۳ — درخواست-پاسخ واقعی به سرور توسعه (localhost:3000).
 *
 * پوشش معیارهای پذیرش فاز ۳ (TEST_MATRIX + سند جامع فاز سه):
 *  R3-1  ساخت OPC و FPC از ابتدا + ویرایش (revision جدید) + بارگذاری مجدد (GET) + خلاصه درست
 *  R3-2  اعتبارسنجی: اتصال نامعتبر شناسایی می‌شود + مرجع فعالیت ناموجود + نماد خارج از فهرست بسته
 *  R3-3  نسخه‌بندی: revisions append-only + بازیابی نسخه قبلی + تأیید (confirmed) و بازگشت به draft
 *  R3-4  مقایسه variant فعلی/پیشنهادی (دلتای شمارش/زمان/مسافت + گام‌های حذف/افزوده)
 *  R3-5  idempotency آفلاین: clientOpId تکراری → بدون دوباره‌شماری
 *  R3-6  RBAC: ۴۰۱ بی‌نشست · ۴۰۴ پروژه دیگران · ۴۰۳ viewer روی diagrams:write · read مجاز
 *  R3-7  B5: پیش‌نیاز فعالیت (ارجاع/خودارجاعی/چرخه) + ممیزی رویدادهای نمودار
 *
 * اجرا: `bun run test:phase3` — سرور توسعه باید در حال اجرا باشد.
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
const owner = { name: "آزمون‌گر فاز۳", email: `p3a-${stamp}@test.local`, password: "TestPass1234" };
const other = { name: "کاربر دیگر فاز۳", email: `p3b-${stamp}@test.local`, password: "TestPass1234" };
const viewer = { name: "ببیننده فاز۳", email: `p3c-${stamp}@test.local`, password: "TestPass1234" };

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
      title: `پروژه آزمون فاز۳ ${code}`,
      code,
      goal: "آزمون خودکار فاز ۳",
      profileTemplateId: "profile.fpc-flow",
      profileComponents: {},
    }),
  });
  if (res.status !== 201) throw new Error(`create project failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.id;
}

function fpcDoc(subject = "material") {
  return {
    kind: "fpc",
    variant: "current",
    subject,
    distanceUnit: "m",
    nodes: [
      { id: "n1", stepNo: 1, symbol: "operation", title: "برش ورق", timeSec: 12 },
      { id: "n2", stepNo: 2, symbol: "transport", title: "حمل به دستگاه جوش", timeSec: 20, distanceM: 15, origin: "میز برش", destination: "دستگاه جوش" },
      { id: "n3", stepNo: 3, symbol: "inspection", title: "کنترل ابعادی", timeSec: 8 },
    ],
    edges: [
      { id: "e1", from: "n1", to: "n2" },
      { id: "e2", from: "n2", to: "n3" },
    ],
  };
}

function opcDoc() {
  return {
    kind: "opc",
    variant: "current",
    nodes: [
      { id: "c1", stepNo: 1, symbol: "componentEntry", title: "بدنه فلزی", sourceRef: "انبار بدنه", timeSec: 0 },
      { id: "o1", stepNo: 2, symbol: "assemblyPoint", title: "مونتاژ بدنه", timeSec: 45 },
      { id: "o2", stepNo: 3, symbol: "operation", title: "پرچ‌کاری", timeSec: 30 },
      { id: "i1", stepNo: 4, symbol: "inspection", title: "کنترل نهایی", timeSec: 10 },
    ],
    edges: [
      { id: "ce1", from: "c1", to: "o1" },
      { id: "ce2", from: "o1", to: "o2" },
      { id: "ce3", from: "o2", to: "i1" },
    ],
  };
}

const LAYOUT = {
  positions: {
    n1: { x: 100, y: 60 }, n2: { x: 100, y: 210 }, n3: { x: 100, y: 360 },
    c1: { x: 100, y: 60 }, o1: { x: 100, y: 210 }, o2: { x: 100, y: 360 }, i1: { x: 100, y: 510 },
  },
};

async function main() {
  console.log("════════ آزمون‌های یکپارچگی فاز ۳ ════════");
  console.log(`هدف: ${BASE}\n`);

  console.log("[۰] آماده‌سازی کاربران و پروژه");
  const cOwner = await registerAndLogin(owner);
  const cOther = await registerAndLogin(other);
  const cViewer = await registerAndLogin(viewer);
  const projA = await createProject(cOwner, `P3-A-${stamp}`);
  const projB = await createProject(cOwner, `P3-B-${stamp}`);
  check("دو پروژه مستقل (پروفایل FPC) ساخته شد", !!projA && !!projB);

  // ─── R3-1: ساخت FPC و OPC از ابتدا + ویرایش + بارگذاری مجدد ───
  console.log("\n[۱] R3-1 — ساخت FPC/OPC از ابتدا، ویرایش (revision)، بارگذاری مجدد");
  const createFpc = await cOwner.req(`/api/projects/${projA}/diagrams`, {
    method: "POST",
    body: JSON.stringify({ kind: "fpc", variant: "current", title: "جریان برش — روش موجود", subject: "material", distanceUnit: "m" }),
  });
  check("POST FPC → 201 با revision اول (r1)", createFpc.status === 201 && createFpc.body.currentRev === 1, `rev ${createFpc.body?.currentRev}`);
  const fpcId = createFpc.body?.id;

  const saveRev2 = await cOwner.req(`/api/projects/${projA}/diagrams/${fpcId}`, {
    method: "PUT",
    body: JSON.stringify({
      doc: fpcDoc("material"),
      layout: LAYOUT,
      reason: "ترسیم گام‌های جریان برش",
    }),
  });
  check("PUT ذخیره revision دوم → r2", saveRev2.status === 200 && saveRev2.body.revision?.revNo === 2, `rev ${saveRev2.body?.revision?.revNo}`);

  const reload = await cOwner.req(`/api/projects/${projA}/diagrams/${fpcId}`);
  check(
    "GET بارگذاری مجدد → همان سند/چیدمان/خلاصه (بازیابی)",
    reload.status === 200 &&
      reload.body.doc.nodes.length === 3 &&
      reload.body.doc.edges.length === 2 &&
      reload.body.doc.nodes[1].distanceM === 15 &&
      reload.body.layout.positions.n2?.y === 210,
    `گره‌ها ${reload.body?.doc?.nodes?.length} · زمان کل ${reload.body?.validation?.summary?.totalTimeSec}s`,
  );
  check(
    "خلاصه: شمارش نمادها + مجموع زمان/مسافت",
    reload.body.validation.summary.counts.operation === 1 &&
      reload.body.validation.summary.counts.transport === 1 &&
      reload.body.validation.summary.counts.inspection === 1 &&
      reload.body.validation.summary.totalTimeSec === 40 &&
      reload.body.validation.summary.totalDistanceM === 15,
  );

  const createOpc = await cOwner.req(`/api/projects/${projA}/diagrams`, {
    method: "POST",
    body: JSON.stringify({
      kind: "opc",
      variant: "current",
      title: "مونتاژ محصول X",
      doc: opcDoc(),
      layout: LAYOUT,
    }),
  });
  check("POST OPC با سند اولیه → 201 (r1 با گره/یال)", createOpc.status === 201 && createOpc.body.doc.nodes.length === 4 && createOpc.body.doc.edges.length === 3);
  const opcId = createOpc.body?.id;

  // ─── R3-2: اعتبارسنجی — اتصال نامعتبر و مرجع ناموجود ───
  console.log("\n[۲] R3-2 — اعتبارسنجی: اتصال نامعتبر/مرجع فعالیت ناموجود/نماد بسته");
  const invalidDoc = fpcDoc("material");
  invalidDoc.edges.push({ id: "bad1", from: "n3", to: "nX" });
  const invalidSave = await cOwner.req(`/api/projects/${projA}/diagrams/${fpcId}`, {
    method: "PUT",
    body: JSON.stringify({ doc: invalidDoc, layout: LAYOUT, reason: "آزمون اتصال نامعتبر" }),
  });
  check(
    "ذخیره با یال به گره ناموجود → خطای invalid-connection",
    invalidSave.status === 200 && invalidSave.body.diagram.validation.errorCount >= 1,
    `خطاها ${invalidSave.body?.diagram?.validation?.errorCount}`,
  );
  const validateRes = await cOwner.req(`/api/projects/${projA}/diagrams/${fpcId}/validate`, { method: "POST", body: JSON.stringify({}) });
  check(
    "POST validate → گزارش با خطای اتصال نامعتبر",
    validateRes.status === 200 && validateRes.body.valid === false && validateRes.body.errors.some((e) => e.code === "invalid-connection"),
  );

  // بازگشت به سند سالم + مرجع فعالیت
  const actCreate = await cOwner.req(`/api/projects/${projA}/activities`, {
    method: "POST",
    body: JSON.stringify({ stableKey: "el.cut-sheet", name: "برش ورق", workType: "operatorManual" }),
  });
  check("ایجاد فعالیت برای ارجاع → 201", actCreate.status === 201);
  const acts = await cOwner.req(`/api/projects/${projA}/activities`);
  check("فعالیت‌های پروژه برای ارجاع موجودند", acts.status === 200 && acts.body.items.length > 0, `${acts.body?.items?.length} فعالیت`);
  const actKey = acts.body.items[0].stableKey;
  const goodDoc = fpcDoc("material");
  goodDoc.nodes[0].activityStableKey = actKey;
  const refSave = await cOwner.req(`/api/projects/${projA}/diagrams/${fpcId}`, {
    method: "PUT",
    body: JSON.stringify({ doc: goodDoc, layout: LAYOUT, reason: "اتصال گام به فعالیت (ارجاع)" }),
  });
  check("ذخیره با مرجع فعالیت موجود → معتبر", refSave.status === 200 && refSave.body.diagram.validation.valid === true);

  const badRefDoc = fpcDoc("material");
  badRefDoc.nodes[0].activityStableKey = "el.nonexistent";
  const badRef = await cOwner.req(`/api/projects/${projA}/diagrams/${fpcId}`, {
    method: "PUT",
    body: JSON.stringify({ doc: badRefDoc, layout: LAYOUT, reason: "مرجع ناموجود" }),
  });
  const badRefValidate = await cOwner.req(`/api/projects/${projA}/diagrams/${fpcId}/validate`, { method: "POST", body: JSON.stringify({}) });
  check(
    "مرجع فعالیت ناموجود → خطای unknown-activity",
    badRef.status === 200 &&
      badRef.body.diagram.validation.errorCount >= 1 &&
      badRefValidate.body.errors.some((e) => e.code === "unknown-activity"),
  );

  const badSymbol = await cOwner.req(`/api/projects/${projA}/diagrams`, {
    method: "POST",
    body: JSON.stringify({
      kind: "opc",
      title: "نماد نادرست",
      doc: { kind: "opc", variant: "current", nodes: [{ id: "x1", stepNo: 1, symbol: "storage", title: "انبار" }], edges: [] },
    }),
  });
  check("نماد FPC در سند OPC → 400 (فهرست بسته)", badSymbol.status === 400);

  const noSubject = await cOwner.req(`/api/projects/${projA}/diagrams`, {
    method: "POST",
    body: JSON.stringify({ kind: "fpc", title: "بدون موضوع" }),
  });
  check("FPC بدون موضوع مطالعه → 400", noSubject.status === 400);

  // ─── R3-3: نسخه‌بندی append-only + بازیابی + تأیید ───
  console.log("\n[۳] R3-3 — نسخه‌بندی: append-only + بازیابی + تأیید");
  const revisions = await cOwner.req(`/api/projects/${projA}/diagrams/${fpcId}/revisions`);
  check(
    "تاریخچه revisions append-only (r1..rN بدون حذف)",
    revisions.status === 200 && revisions.body.items.length >= 4 && revisions.body.items[0].revNo > revisions.body.items[revisions.body.items.length - 1].revNo,
    `${revisions.body?.items?.length} نسخه`,
  );

  const restore = await cOwner.req(`/api/projects/${projA}/diagrams/${fpcId}/restore`, {
    method: "POST",
    body: JSON.stringify({ revNo: 4 }),
  });
  check("بازیابی نسخه ۴ → revision جدید با همان محتوا", restore.status === 200 && restore.body.revision.revNo > 4 && restore.body.diagram.validation.valid === true, `r${restore.body?.revision?.revNo}`);

  const confirmOk = await cOwner.req(`/api/projects/${projA}/diagrams/${fpcId}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "confirmed" }),
  });
  check("تأیید نمودار سالم → confirmed", confirmOk.status === 200 && confirmOk.body.status === "confirmed");

  const editAfterConfirm = await cOwner.req(`/api/projects/${projA}/diagrams/${fpcId}`, {
    method: "PUT",
    body: JSON.stringify({ doc: fpcDoc("material"), layout: LAYOUT, reason: "ویرایش پس از تأیید" }),
  });
  check("ذخیره روی confirmed → revision جدید + بازگشت به draft (بازنویسی بی‌اجازه ممنوع)", editAfterConfirm.status === 200 && editAfterConfirm.body.diagram.status === "draft");

  // بازگرداندن به سند معتبر برای تأیید مجدد
  const goodDoc2 = fpcDoc("material");
  goodDoc2.nodes[0].activityStableKey = actKey;
  await cOwner.req(`/api/projects/${projA}/diagrams/${fpcId}`, {
    method: "PUT",
    body: JSON.stringify({ doc: goodDoc2, layout: LAYOUT, reason: "سند معتبر" }),
  });
  const confirmWithErrDoc = fpcDoc("material");
  confirmWithErrDoc.edges.push({ id: "bad2", from: "n3", to: "nZZ" });
  await cOwner.req(`/api/projects/${projA}/diagrams/${fpcId}`, {
    method: "PUT",
    body: JSON.stringify({ doc: confirmWithErrDoc, layout: LAYOUT, reason: "با خطا" }),
  });
  const confirmErr = await cOwner.req(`/api/projects/${projA}/diagrams/${fpcId}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "confirmed" }),
  });
  check("تأیید نمودارِ دارای خطا → 400", confirmErr.status === 400);

  // ─── R3-4: مقایسه variant ───
  console.log("\n[۴] R3-4 — مقایسه روش فعلی/پیشنهادی");
  // سند فعلی سالم با activityRef (بدون خطا برای مقایسه)
  await cOwner.req(`/api/projects/${projA}/diagrams/${fpcId}`, {
    method: "PUT",
    body: JSON.stringify({ doc: goodDoc2, layout: LAYOUT, reason: "نسخه پایه برای مقایسه" }),
  });
  const proposedDoc = {
    kind: "fpc",
    variant: "proposed",
    subject: "material",
    distanceUnit: "m",
    nodes: [
      { id: "p1", stepNo: 1, symbol: "operation", title: "برش ورق", timeSec: 10, activityStableKey: actKey },
      { id: "p2", stepNo: 2, symbol: "transport", title: "حمل به دستگاه جوش", timeSec: 20, distanceM: 8, origin: "میز برش", destination: "دستگاه جوش" },
      { id: "p3", stepNo: 3, symbol: "inspection", title: "کنترل ابعادی", timeSec: 8 },
      { id: "p4", stepNo: 4, symbol: "operation", title: "بسته‌بندی", timeSec: 6 },
    ],
    edges: [
      { id: "pe1", from: "p1", to: "p2" },
      { id: "pe2", from: "p2", to: "p3" },
      { id: "pe3", from: "p3", to: "p4" },
    ],
  };
  const createProposed = await cOwner.req(`/api/projects/${projA}/diagrams`, {
    method: "POST",
    body: JSON.stringify({
      kind: "fpc",
      variant: "proposed",
      title: "جریان برش — روش پیشنهادی",
      subject: "material",
      variantOfId: fpcId,
      doc: proposedDoc,
    }),
  });
  check("POST نسخه پیشنهادی با مرجع variantOfId → 201", createProposed.status === 201, `status ${createProposed.status}`);
  const proposedId = createProposed.body?.id;

  const compare = await cOwner.req(`/api/projects/${projA}/diagrams/${proposedId}/compare`);
  check(
    "GET compare → دلتاها: Δt +4s (گام بسته‌بندی افزوده) · Δd −7m (کاهش مسافت) · گام افزوده/تغییر زمان",
    compare.status === 200 &&
      compare.body.diff.totalTimeDeltaSec === 4 &&
      compare.body.diff.totalDistanceDeltaM === -7 &&
      compare.body.diff.countDelta.operation === 1 &&
      compare.body.diff.addedSteps.some((s) => s.title === "بسته‌بندی") &&
      compare.body.diff.changedSteps.some((s) => s.title === "برش ورق" && s.timeBefore === 12 && s.timeAfter === 10),
    `Δt ${compare.body?.diff?.totalTimeDeltaSec}s · Δd ${compare.body?.diff?.totalDistanceDeltaM}m`,
  );

  const badVariant = await cOwner.req(`/api/projects/${projA}/diagrams`, {
    method: "POST",
    body: JSON.stringify({ kind: "fpc", variant: "proposed", title: "مرجع نادرست", subject: "material", variantOfId: opcId }),
  });
  check("proposed با مرجع نوع متفاوت → 400", badVariant.status === 400);

  const compareOnCurrent = await cOwner.req(`/api/projects/${projA}/diagrams/${fpcId}/compare`);
  check("compare روی نمودار «فعلی» → 400 (فقط پیشنهادی)", compareOnCurrent.status === 400);

  // ─── R3-5: idempotency آفلاین ───
  console.log("\n[۵] R3-5 — idempotency: clientOpId تکراری دوباره‌شماری نمی‌کند");
  const idemDoc = fpcDoc("material");
  idemDoc.nodes[0].activityStableKey = actKey;
  const opId = `idem-${stamp}`;
  const before = await cOwner.req(`/api/projects/${projA}/diagrams/${fpcId}/revisions`);
  const countBefore = before.body.items.length;
  const first = await cOwner.req(`/api/projects/${projA}/diagrams/${fpcId}`, {
    method: "PUT",
    body: JSON.stringify({ doc: idemDoc, layout: LAYOUT, reason: "آفلاین", origin: "offline-synced", clientOpId: opId }),
  });
  const second = await cOwner.req(`/api/projects/${projA}/diagrams/${fpcId}`, {
    method: "PUT",
    body: JSON.stringify({ doc: idemDoc, layout: LAYOUT, reason: "آفلاین (retry)", origin: "offline-synced", clientOpId: opId }),
  });
  const after = await cOwner.req(`/api/projects/${projA}/diagrams/${fpcId}/revisions`);
  check(
    "retry با همان clientOpId → duplicate=true و فقط یک revision جدید",
    first.status === 200 &&
      second.status === 200 &&
      second.body.duplicate === true &&
      after.body.items.length === countBefore + 1,
    `${countBefore} → ${after.body?.items?.length}`,
  );

  // ─── R3-6: RBAC ───
  console.log("\n[۶] R3-6 — RBAC و مجوزسنجی سرور");
  const noAuth = await fetch(BASE + `/api/projects/${projA}/diagrams`);
  check("بدون نشست → 401", noAuth.status === 401);

  const otherView = await cOther.req(`/api/projects/${projA}/diagrams`);
  check("پروژه دیگران → 404", otherView.status === 404);

  // viewer عضو پروژه A
  await cOwner.req(`/api/projects/${projA}/members`, {
    method: "POST",
    body: JSON.stringify({ email: viewer.email, role: "viewer" }),
  });
  const viewerList = await cViewer.req(`/api/projects/${projA}/diagrams`);
  check("viewer: diagrams:read → فهرست مجاز", viewerList.status === 200 && Array.isArray(viewerList.body.items));
  const viewerWrite = await cViewer.req(`/api/projects/${projA}/diagrams`, {
    method: "POST",
    body: JSON.stringify({ kind: "fpc", title: "non", subject: "material" }),
  });
  check("viewer: diagrams:write → 403", viewerWrite.status === 403);
  const viewerSave = await cViewer.req(`/api/projects/${projA}/diagrams/${fpcId}`, {
    method: "PUT",
    body: JSON.stringify({ doc: fpcDoc(), layout: LAYOUT }),
  });
  check("viewer: ذخیره revision → 403", viewerSave.status === 403);
  const viewerConfirm = await cViewer.req(`/api/projects/${projA}/diagrams/${fpcId}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "confirmed" }),
  });
  check("viewer: تأیید → 403", viewerConfirm.status === 403);

  // ─── R3-7: جداسازی پروژه + B5 پیش‌نیاز + ممیزی ───
  console.log("\n[۷] R3-7 — جداسازی پروژه + پیش‌نیاز فعالیت (B5) + ممیزی");
  const listB = await cOwner.req(`/api/projects/${projB}/diagrams`);
  check("پروژه B فهرست مستقل (خالی)", listB.status === 200 && listB.body.items.length === 0);

  const pred1 = await cOwner.req(`/api/projects/${projB}/activities`, {
    method: "POST",
    body: JSON.stringify({ stableKey: "el.step-a", name: "گام A", workType: "operatorManual" }),
  });
  const pred2 = await cOwner.req(`/api/projects/${projB}/activities`, {
    method: "POST",
    body: JSON.stringify({ stableKey: "el.step-b", name: "گام B", workType: "operatorManual", predecessors: ["el.step-a"] }),
  });
  check("ایجاد فعالیت با پیش‌نیاز معتبر → 201", pred1.status === 201 && pred2.status === 201);

  const selfRef = await cOwner.req(`/api/projects/${projB}/activities`, {
    method: "POST",
    body: JSON.stringify({ stableKey: "el.step-c", name: "گام C", workType: "operatorManual", predecessors: ["el.step-c"] }),
  });
  check("پیش‌نیاز خودارجاعی → 400", selfRef.status === 400);

  const unknownPred = await cOwner.req(`/api/projects/${projB}/activities`, {
    method: "POST",
    body: JSON.stringify({ stableKey: "el.step-d", name: "گام D", workType: "operatorManual", predecessors: ["el.nope"] }),
  });
  check("پیش‌نیاز ناموجود → 400", unknownPred.status === 400);

  // چرخه: A→B موجود؛ B→A یعنی چرخه (با id واقعی فعالیت A)
  const cyc = await cOwner.req(`/api/projects/${projB}/activities/${pred1.body.id}`, {
    method: "PATCH",
    body: JSON.stringify({ predecessors: ["el.step-b"] }),
  });
  check("ایجاد چرخه تقدم → 400", cyc.status === 400, `status ${cyc.status}`);

  const audit = await cOwner.req(`/api/projects/${projA}/audit`);
  const auditActions = new Set((audit.body.items ?? []).map((a) => a.action));
  check(
    "ممیزی: رویدادهای نمودار ثبت شدند",
    audit.status === 200 && auditActions.has("diagram.created") && auditActions.has("diagram.revision-saved") && auditActions.has("diagram.confirmed"),
    [...auditActions].filter((a) => a.startsWith("diagram")).join("، "),
  );

  // بایگانی نمودار
  const arch = await cOwner.req(`/api/projects/${projA}/diagrams/${opcId}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "archived" }),
  });
  check("بایگانی نمودار → archived", arch.status === 200 && arch.body.status === "archived");
  const listAAfter = await cOwner.req(`/api/projects/${projA}/diagrams`);
  check("بایگانی‌شده در فهرست پیش‌فرض نیست", !listAAfter.body.items.some((d) => d.id === opcId));

  // ─── جمع‌بندی ───
  console.log("\n════════ جمع‌بندی فاز ۳ ════════");
  console.log(`قبول: ${passed} · رد: ${failed}`);
  if (failed > 0) {
    console.log("آزمون‌های ردشده:");
    for (const f of failures) console.log(`  ✗ ${f}`);
    process.exit(1);
  }
  console.log("همه آزمون‌های فاز ۳ قبول شد ✓");
  process.exit(0);
}

main().catch((e) => {
  console.error("خطای اجرای آزمون:", e);
  process.exit(1);
});
