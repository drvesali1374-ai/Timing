#!/usr/bin/env node
/**
 * آزمون اتصال چهارجهته گره‌های نمودار (بند ۸.۲ مأموریت UX/RTL).
 *
 *  H-1  ذخیره و بازیابی محل اتصال: هر چهار ضلع (بالا/پایین/چپ/راست) به‌عنوان مبدأ و مقصد
 *  H-2  سازگاری نمودارهای قدیمی: یال بدون fromHandle/toHandle پذیرفته و دست‌نخورده برگردانده می‌شود
 *  H-3  مقدار ضلع نامعتبر → ۴۰۰ (اعتبارسنجی سرور)
 *  H-4  بازیابی revision قبلی — محل اتصال‌ها دقیقاً همان revision برمی‌گردد
 *  H-5  ترکیب‌های متقاطع: راست→چپ · چپ→راست · بالا→پایین · پایین→بالا · راست→بالا · چپ→پایین
 *
 * اجرا: `node scripts/test-handles.mjs` — سرور توسعه باید در حال اجرا باشد.
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
const owner = { name: "آزمون‌گر اتصال چهارسویه", email: `hx-${stamp}@test.local`, password: "TestPass1234" };

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

async function main() {
  console.log("════════ آزمون اتصال چهارجهته گره‌ها (بند ۸.۲) ════════");
  const client = await registerAndLogin(owner);

  const projRes = await client.req("/api/projects", {
    method: "POST",
    body: JSON.stringify({
      title: `پروژه آزمون اتصال ${stamp}`,
      code: `HX${stamp.toString(36).toUpperCase()}`,
      goal: "آزمون اتصال چهارجهته",
      profileTemplateId: "profile.fpc-flow",
      profileComponents: {},
    }),
  });
  if (projRes.status !== 201) throw new Error(`create project failed: ${projRes.status}`);
  const projectId = projRes.body.id;
  console.log(`پروژه ساخته شد: ${projectId}`);

  // ── نمودار FPC با ۴ گره برای ترکیب‌های متقاطع ──
  const createRes = await client.req(`/api/projects/${projectId}/diagrams`, {
    method: "POST",
    body: JSON.stringify({
      kind: "fpc",
      variant: "current",
      title: "نمودار آزمون اتصال چهارسویه",
      subject: "material",
      distanceUnit: "m",
    }),
  });
  if (createRes.status !== 201) throw new Error(`create diagram failed: ${createRes.status} ${JSON.stringify(createRes.body)}`);
  const diagramId = createRes.body.id;
  console.log(`نمودار ساخته شد: ${diagramId}`);

  const nodes = (i) => [
    { id: `a${i}`, stepNo: 1, symbol: "operation", title: "گام الف", timeSec: 5 },
    { id: `b${i}`, stepNo: 2, symbol: "transport", title: "گام ب", timeSec: 6, distanceM: 3 },
    { id: `c${i}`, stepNo: 3, symbol: "inspection", title: "گام پ", timeSec: 4 },
    { id: `d${i}`, stepNo: 4, symbol: "storage", title: "گام ت" },
  ];
  const layout = (i) => ({
    positions: {
      [`a${i}`]: { x: 300, y: 80 },
      [`b${i}`]: { x: 80, y: 230 },
      [`c${i}`]: { x: 520, y: 230 },
      [`d${i}`]: { x: 300, y: 400 },
    },
  });

  // ═══ [۱] H-1/H-5: هر چهار ضلع، هر دو نقش، ترکیب‌های متقاطع ═══
  console.log("\n[۱] ذخیره اتصال از هر چهار ضلع (ترکیب‌های متقاطع)");
  const i = 1;
  const docV1 = {
    kind: "fpc",
    variant: "current",
    subject: "material",
    distanceUnit: "m",
    nodes: nodes(i),
    edges: [
      // راست → چپ
      { id: "e-rtol", from: `a${i}`, to: `b${i}`, fromHandle: "right", toHandle: "left" },
      // چپ → راست
      { id: "e-ltor", from: `a${i}`, to: `c${i}`, fromHandle: "left", toHandle: "right" },
      // پایین → بالا
      { id: "e-btot", from: `a${i}`, to: `d${i}`, fromHandle: "bottom", toHandle: "top" },
      // بالا → پایین
      { id: "e-ttob", from: `b${i}`, to: `c${i}`, fromHandle: "top", toHandle: "bottom" },
      // راست → بالا (کراس ترکیبی)
      { id: "e-rtot", from: `b${i}`, to: `d${i}`, fromHandle: "right", toHandle: "top" },
      // چپ → پایین (کراس ترکیبی)
      { id: "e-ltob", from: `c${i}`, to: `d${i}`, fromHandle: "left", toHandle: "bottom" },
    ],
  };
  const saveV1 = await client.req(`/api/projects/${projectId}/diagrams/${diagramId}`, {
    method: "PUT",
    body: JSON.stringify({ doc: docV1, layout: layout(i), reason: "ذخیره اتصال چهارسویه" }),
  });
  check("ذخیره revision با ۶ یال چهارسویه → موفق", saveV1.status === 200, `status ${saveV1.status}`);

  const getV1 = await client.req(`/api/projects/${projectId}/diagrams/${diagramId}`);
  const savedEdges = getV1.body?.doc?.edges ?? [];
  const byId = Object.fromEntries(savedEdges.map((e) => [e.id, e]));
  check("راست→چپ ذخیره و بازیابی شد", byId["e-rtol"]?.fromHandle === "right" && byId["e-rtol"]?.toHandle === "left");
  check("چپ→راست ذخیره و بازیابی شد", byId["e-ltor"]?.fromHandle === "left" && byId["e-ltor"]?.toHandle === "right");
  check("پایین→بالا ذخیره و بازیابی شد", byId["e-btot"]?.fromHandle === "bottom" && byId["e-btot"]?.toHandle === "top");
  check("بالا→پایین ذخیره و بازیابی شد", byId["e-ttob"]?.fromHandle === "top" && byId["e-ttob"]?.toHandle === "bottom");
  check("راست→بالا (کراس) ذخیره و بازیابی شد", byId["e-rtot"]?.fromHandle === "right" && byId["e-rtot"]?.toHandle === "top");
  check("چپ→پایین (کراس) ذخیره و بازیابی شد", byId["e-ltob"]?.fromHandle === "left" && byId["e-ltob"]?.toHandle === "bottom");
  const revAfterV1 = getV1.body?.currentRev;
  check("شماره revision جلو رفت", typeof revAfterV1 === "number" && revAfterV1 >= 2, `rev ${revAfterV1}`);

  // ═══ [۲] H-2: سازگاری نمودار قدیمی بدون Handle ═══
  console.log("\n[۲] سازگاری — یال قدیمی بدون ضلع اتصال");
  const j = 2;
  const docLegacy = {
    kind: "fpc",
    variant: "current",
    subject: "material",
    distanceUnit: "m",
    nodes: nodes(j),
    edges: [
      { id: "legacy-1", from: `a${j}`, to: `b${j}` },
      { id: "legacy-2", from: `b${j}`, to: `c${j}`, label: "برچسب قدیمی" },
    ],
  };
  const saveLegacy = await client.req(`/api/projects/${projectId}/diagrams/${diagramId}`, {
    method: "PUT",
    body: JSON.stringify({ doc: docLegacy, layout: layout(j), reason: "بازگشت به یال قدیمی بدون Handle" }),
  });
  check("ذخیره یال‌های قدیمی (بدون Handle) → موفق", saveLegacy.status === 200, `status ${saveLegacy.status}`);

  const getLegacy = await client.req(`/api/projects/${projectId}/diagrams/${diagramId}`);
  const legacyEdges = getLegacy.body?.doc?.edges ?? [];
  const l1 = legacyEdges.find((e) => e.id === "legacy-1");
  const l2 = legacyEdges.find((e) => e.id === "legacy-2");
  check("یال قدیمی دست‌نخورده برگشت (بدون تزریق ضلع)", l1 && !("fromHandle" in l1) && !("toHandle" in l1) && l1.from === `a${j}`);
  check("برچسب یال قدیمی حفظ شد", l2?.label === "برچسب قدیمی");

  // ═══ [۳] H-3: ضلع نامعتبر رد می‌شود ═══
  console.log("\n[۳] اعتبارسنجی — ضلع نامعتبر");
  const k = 3;
  const docBad = {
    kind: "fpc",
    variant: "current",
    subject: "material",
    distanceUnit: "m",
    nodes: nodes(k),
    edges: [{ id: "bad-1", from: `a${k}`, to: `b${k}`, fromHandle: "diagonal" }],
  };
  const saveBad = await client.req(`/api/projects/${projectId}/diagrams/${diagramId}`, {
    method: "PUT",
    body: JSON.stringify({ doc: docBad, layout: layout(k), reason: "ضلع نامعتبر" }),
  });
  check("ضلع نامعتبر (diagonal) → ۴۰۰", saveBad.status === 400, `status ${saveBad.status}`);

  // ═══ [۴] H-4: بازیابی revision قبلی با Handle ═══
  console.log("\n[۴] بازیابی revision — محل اتصال‌ها دقیق برمی‌گردد");
  const revs = await client.req(`/api/projects/${projectId}/diagrams/${diagramId}/revisions`);
  const revList = revs.body?.items ?? [];
  const targetRev = revList.find((r) => r.revNo === revAfterV1) ?? null;
  check("revision چهارسویه در فهرست تاریخچه هست", !!targetRev, `rev ${revAfterV1}`);

  const restoreRes = await client.req(`/api/projects/${projectId}/diagrams/${diagramId}/restore`, {
    method: "POST",
    body: JSON.stringify({ revNo: revAfterV1 }),
  });
  check("بازیابی revision چهارسویه → موفق", restoreRes.status === 200, `status ${restoreRes.status}`);

  const getRestored = await client.req(`/api/projects/${projectId}/diagrams/${diagramId}`);
  const restoredEdges = getRestored.body?.doc?.edges ?? [];
  const r1 = restoredEdges.find((e) => e.id === "e-rtol");
  const r6 = restoredEdges.find((e) => e.id === "e-ltob");
  check("بعد از restore: راست→چپ دقیقاً برگشت", r1?.fromHandle === "right" && r1?.toHandle === "left");
  check("بعد از restore: چپ→پایین دقیقاً برگشت", r6?.fromHandle === "left" && r6?.toHandle === "bottom");

  // ═══ جمع‌بندی ═══
  console.log("\n════════ جمع‌بندی آزمون اتصال چهارجهته ════════");
  console.log(`قبول: ${passed} · رد: ${failed}`);
  if (failed > 0) {
    console.log("آزمون‌های ردشده:", failures.join(" | "));
    process.exit(1);
  }
  console.log("همه آزمون‌های اتصال چهارجهته قبول شد ✓");
}

main().catch((err) => {
  console.error("خطای اجرای آزمون:", err);
  process.exit(1);
});
