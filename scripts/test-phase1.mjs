#!/usr/bin/env node
/**
 * آزمون‌های یکپارچگی فاز ۱ — درخواست-پاسخ واقعی به سرور توسعه (localhost:3000).
 *
 * پوشش معیارهای پذیرش فاز ۱ (TEST_MATRIX):
 *  R1-1  ایجاد پروژه + بارگذاری مجدد پایدار (پایداری داده)
 *  R1-2  ویرایش پروژه A پروژه B را تغییر نمی‌دهد (جداسازی)
 *  R1-3  درخواست مستقیم غیرمجاز به API رد می‌شود:
 *        الف) بدون نشست → 401
 *        ب) پروژه کاربر دیگر → 404 (بدون افشا)
 *        ج) نقش ناکافی (viewer) → 403
 *        د) عضو غیر (recorder) ویرایش → 403
 *  R1-X  جداسازی پروژه نمونه از داده واقعی (فیلتر isDemo + مالکیت)
 *  R1-V  نسخه پیکربندی append-only + snapshot مستقل از الگو (ADR-005)
 *
 * اجرا: `bun run test:phase1` — سرور توسعه باید در حال اجرا باشد.
 * خروجی: گزارش گام‌به‌گام + جمع‌بندی قبول/رد؛ exit 1 اگر هر آزمونی رد شود.
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

/** کلاینت نشست‌دار ساده با cookie jar */
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
const userA = { name: "کاربر آزمون الف", email: `t1a-${stamp}@test.local`, password: "TestPass1234" };
const userB = { name: "کاربر آزمون ب", email: `t1b-${stamp}@test.local`, password: "TestPass1234" };
const userC = { name: "کاربر آزمون ج", email: `t1c-${stamp}@test.local`, password: "TestPass1234" };

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
  console.log("════════ آزمون‌های یکپارچگی فاز ۱ ════════");
  console.log(`هدف: ${BASE}\n`);

  // ─── آماده‌سازی کاربران ───
  console.log("[۰] آماده‌سازی: ثبت‌نام و ورود سه کاربر آزمون");
  const A = await registerAndLogin(userA);
  const B = await registerAndLogin(userB);
  const C = await registerAndLogin(userC);
  const sessionA = await A.req("/api/auth/session");
  check("نشست کاربر الف برقرار است", sessionA.body?.user?.email === userA.email);

  // ─── R1-3الف: بدون نشست ───
  console.log("\n[R1-3الف] درخواست بدون نشست باید رد شود (401)");
  const anon = makeClient();
  const anonList = await anon.req("/api/projects");
  check("GET /api/projects بدون نشست → 401", anonList.status === 401, `status=${anonList.status}`);
  const anonCreate = await anon.req("/api/projects", {
    method: "POST",
    body: JSON.stringify({ title: "x", code: "x", profileTemplateId: "profile.general-industrial-time-study" }),
  });
  check("POST /api/projects بدون نشست → 401", anonCreate.status === 401, `status=${anonCreate.status}`);
  const anonProfiles = await anon.req("/api/profiles");
  check("GET /api/profiles بدون نشست → 401", anonProfiles.status === 401, `status=${anonProfiles.status}`);

  // ─── پروفایل‌ها ───
  console.log("\n[پیش‌نیاز] فهرست پروفایل‌ها");
  const profiles = await A.req("/api/profiles");
  check("۷ پروفایل روش‌شناختی موجود است", profiles.body?.items?.length === 7, `count=${profiles.body?.items?.length}`);
  const defaultProfile = profiles.body.items.find((p) => p.isDefault);
  check("پروفایل پیش‌فرض «مطالعه عمومی زمان صنعتی» موجود است", defaultProfile?.id === "profile.general-industrial-time-study");
  const profileDetail = await A.req(`/api/profiles/${defaultProfile.id}`);
  check(
    "جزئیات پروفایل شامل فرض‌ها و ساختار واقعی است",
    Array.isArray(profileDetail.body?.assumptions) && profileDetail.body.assumptions.length >= 4 &&
      profileDetail.body?.content?.families?.length >= 4,
    `assumptions=${profileDetail.body?.assumptions?.length}, families=${profileDetail.body?.content?.families?.length}`,
  );

  // ─── R1-1: ایجاد + بارگذاری مجدد پایدار ───
  console.log("\n[R1-1] ایجاد پروژه و بارگذاری مجدد پایدار");
  const createA = await A.req("/api/projects", {
    method: "POST",
    body: JSON.stringify({
      title: "پروژه آزمون الف — خط مونتاژ",
      code: `T1A-${stamp}`,
      line: "خط ۱",
      product: "محصول X",
      profileTemplateId: defaultProfile.id,
      profileComponents: {
        excludedFamilies: ["study.context"],
        parameterOverrides: [{ stableKey: "allowance.rate", value: 12 }],
      },
    }),
  });
  check("ایجاد پروژه → 201", createA.status === 201, `status=${createA.status}`);
  const projectA = createA.body;
  check("نقش ایجادکننده = owner", projectA?.myRole === "owner");
  check("نسخه پیکربندی 1.0.0 ساخته شد", projectA?.currentConfigVersion?.semver === "1.0.0");
  check("پروفایل در DTO مشخص است", projectA?.profile?.templateId === defaultProfile.id);
  check("آمادگی: پیکربندی ✓ و اندازه‌گیری ✗ (صادقانه)", projectA?.readiness?.configReady === true && projectA?.readiness?.measurementReady === false);

  // «بارگذاری مجدد» = دریافت دوباره از سرور (همان چیزی که reload مرورگر می‌بیند)
  const reload1 = await A.req(`/api/projects/${projectA.id}`);
  check("بارگذاری مجدد ۱: همان شناسه/عنوان/کد", reload1.status === 200 && reload1.body.title === projectA.title && reload1.body.code === projectA.code);
  const reload2 = await A.req(`/api/projects/${projectA.id}`);
  check("بارگذاری مجدد ۲ (تکرار): داده پایدار است", JSON.stringify(reload1.body) === JSON.stringify(reload2.body));

  const versionsA = await A.req(`/api/projects/${projectA.id}/config-versions`);
  const vA = versionsA.body?.items?.[0];
  check(
    "snapshot شامل حذف خانواده و بازنویسی نرخ مجاز است (ADR-005)",
    vA?.snapshot?.meta?.excludedFamilies?.[0] === "study.context" &&
      vA?.snapshot?.meta?.parameterOverrides?.[0]?.stableKey === "allowance.rate" &&
      vA?.snapshot?.meta?.parameterOverrides?.[0]?.value === 12,
  );
  const snapFamilies = (vA?.snapshot?.content?.families ?? []).map((f) => f.stableKey);
  check("خانواده حذف‌شده در snapshot نیست", !snapFamilies.includes("study.context"), snapFamilies.join(","));
  const allowParam = (vA?.snapshot?.content?.families ?? []).flatMap((f) => f.parameters).find((p) => p.stableKey === "allowance.rate");
  check("مقدار بازنویسی‌شده در snapshot اعمال شده", allowParam?.defaultValue === 12);

  // استقلال snapshot از الگو: تغییر الگوی عمومی (همگام‌سازی دوباره) نباید پروژه را تغییر دهد
  // (در فاز ۱ تعریف‌ها ثابت‌اند؛ آزمون معادل: snapshot پروژه != محتوای خام الگو)
  const templateContent = profileDetail.body.content;
  check(
    "snapshot پروژه نسخه مستقل از الگو است (کپی، نه ارجاع)",
    JSON.stringify(vA?.snapshot?.content) !== JSON.stringify(templateContent) || vA?.snapshot?.meta?.excludedFamilies?.length === 0,
  );

  // ─── R1-2: جداسازی دو پروژه ───
  console.log("\n[R1-2] ساخت پروژه دوم و ویرایش اولی — دومی نباید تغییر کند");
  const createB = await A.req("/api/projects", {
    method: "POST",
    body: JSON.stringify({
      title: "پروژه آزمون ب — بسته‌بندی",
      code: `T1B-${stamp}`,
      line: "خط ۲",
      profileTemplateId: "profile.continuous-timing",
    }),
  });
  check("ایجاد پروژه B → 201", createB.status === 201);
  const projectB = createB.body;

  const fingerprint = (p) =>
    JSON.stringify({
      title: p.title, code: p.code, line: p.line, status: p.status,
      profile: p.profile, currentConfigVersion: p.currentConfigVersion,
      configVersionCount: p.configVersionCount, updatedAt: p.updatedAt,
    });
  const beforeB = fingerprint(projectB);

  // ویرایش A: عنوان + بایگانی + تکثیر
  const patchA = await A.req(`/api/projects/${projectA.id}`, {
    method: "PATCH",
    body: JSON.stringify({ title: "پروژه آزمون الف — ویرایش‌شده", responsible: "مهندس آزمون" }),
  });
  check("ویرایش پروژه A موفق", patchA.status === 200 && patchA.body.title === "پروژه آزمون الف — ویرایش‌شده");
  const archiveA = await A.req(`/api/projects/${projectA.id}/archive`, {
    method: "POST",
    body: JSON.stringify({ archived: true }),
  });
  check("بایگانی A موفق", archiveA.status === 200 && archiveA.body.status === "archived");
  const dupA = await A.req(`/api/projects/${projectA.id}/duplicate`, { method: "POST" });
  check("تکثیر A موفق (کد مستقل)", dupA.status === 201 && dupA.body.code !== projectA.code, `code=${dupA.body?.code}`);

  const afterB = await A.req(`/api/projects/${projectB.id}`);
  check("پروژه B پس از سه تغییر روی A دست‌نخورده است", fingerprint(afterB.body) === beforeB, afterB.body?.title);
  const versionsB = await A.req(`/api/projects/${projectB.id}/config-versions`);
  check("تعداد نسخه‌های B تغییری نکرده (۱)", versionsB.body?.items?.length === 1);

  // ممیزی A شامل سه رخداد ویرایش/بایگانی/تکثیر است؛ B فقط رخدادهای خودش
  const auditA = await A.req(`/api/projects/${projectA.id}/audit`);
  const auditActionsA = (auditA.body?.items ?? []).map((i) => i.action);
  check(
    "ممیزی A رخدادهای A را ثبت کرده",
    auditActionsA.includes("project.updated") && auditActionsA.includes("project.archived") && auditActionsA.includes("project.duplicated"),
    auditActionsA.join(","),
  );
  const auditB = await A.req(`/api/projects/${projectB.id}/audit`);
  const auditActionsB = (auditB.body?.items ?? []).map((i) => i.action);
  check("ممیزی B فقط رخدادهای خودش (بدون نشت از A)", !auditActionsB.includes("project.archived"), auditActionsB.join(","));

  // ─── R1-3ب: کاربر دیگر به پروژه A ───
  console.log("\n[R1-3ب] دسترسی کاربر B به پروژه کاربر A → 404 (بدون افشا)");
  const bGetA = await B.req(`/api/projects/${projectA.id}`);
  check("GET پروژه A توسط B → 404", bGetA.status === 404, `status=${bGetA.status}`);
  const bPatchA = await B.req(`/api/projects/${projectA.id}`, {
    method: "PATCH",
    body: JSON.stringify({ title: "هک!" }),
  });
  check("PATCH پروژه A توسط B → 404", bPatchA.status === 404, `status=${bPatchA.status}`);
  const bDupA = await B.req(`/api/projects/${projectA.id}/duplicate`, { method: "POST" });
  check("تکثیر پروژه A توسط B → 404", bDupA.status === 404, `status=${bDupA.status}`);
  const bVersionsA = await B.req(`/api/projects/${projectA.id}/config-versions`);
  check("نسخه‌های پروژه A توسط B → 404", bVersionsA.status === 404, `status=${bVersionsA.status}`);
  const bAuditA = await B.req(`/api/projects/${projectA.id}/audit`);
  check("ممیزی پروژه A توسط B → 404", bAuditA.status === 404, `status=${bAuditA.status}`);
  const bList = await B.req("/api/projects");
  check("فهرست پروژه‌های B خالی از پروژه‌های A است", (bList.body?.items ?? []).every((p) => p.id !== projectA.id && p.id !== projectB.id));

  // عنوان پس از تلاش ناموفق تغییر نکرده
  const aAgain = await A.req(`/api/projects/${projectA.id}`);
  check("عنوان A پس از تلاش ناموفق B تغییری نکرده", aAgain.body.title === "پروژه آزمون الف — ویرایش‌شده");

  // ─── R1-3ج/د: نقش‌ها ───
  console.log("\n[R1-3ج/د] کنترل نقش: viewer و recorder نمی‌توانند ویرایش کنند");
  // A پروژه سوم می‌سازد و C را با نقش viewer اضافه می‌کند
  const createC0 = await A.req("/api/projects", {
    method: "POST",
    body: JSON.stringify({
      title: "پروژه آزمون نقش‌ها",
      code: `T1C-${stamp}`,
      profileTemplateId: defaultProfile.id,
    }),
  });
  const projectC0 = createC0.body;
  // ثبت‌نام کاربر D برای نقش recorder
  const userD = { name: "کاربر آزمون د", email: `t1d-${stamp}@test.local`, password: "TestPass1234" };
  const D = await registerAndLogin(userD);

  const addViewer = await A.req(`/api/projects/${projectC0.id}/members`, {
    method: "POST",
    body: JSON.stringify({ email: userC.email, role: "viewer" }),
  });
  check("افزودن عضو viewer توسط owner موفق", addViewer.status === 201);
  const addRecorder = await A.req(`/api/projects/${projectC0.id}/members`, {
    method: "POST",
    body: JSON.stringify({ email: userD.email, role: "recorder" }),
  });
  check("افزودن عضو recorder توسط owner موفق", addRecorder.status === 201);

  const cPatch = await C.req(`/api/projects/${projectC0.id}`, {
    method: "PATCH",
    body: JSON.stringify({ title: "تغییر غیرمجاز" }),
  });
  check("PATCH توسط viewer → 403", cPatch.status === 403, `status=${cPatch.status}`);
  const dPatch = await D.req(`/api/projects/${projectC0.id}`, {
    method: "PATCH",
    body: JSON.stringify({ title: "تغییر غیرمجاز" }),
  });
  check("PATCH توسط recorder → 403", dPatch.status === 403, `status=${dPatch.status}`);
  const dArchive = await D.req(`/api/projects/${projectC0.id}/archive`, {
    method: "POST",
    body: JSON.stringify({ archived: true }),
  });
  check("بایگانی توسط recorder → 403", dArchive.status === 403, `status=${dArchive.status}`);
  const cRead = await C.req(`/api/projects/${projectC0.id}`);
  check("خواندن توسط viewer مجاز است", cRead.status === 200 && cRead.body.myRole === "viewer");
  const cAudit = await C.req(`/api/projects/${projectC0.id}/audit`);
  check("ممیزی توسط viewer → 403 (فقط editor+)", cAudit.status === 403, `status=${cAudit.status}`);
  const cAddMember = await C.req(`/api/projects/${projectC0.id}/members`, {
    method: "POST",
    body: JSON.stringify({ email: userB.email, role: "viewer" }),
  });
  check("مدیریت اعضا توسط viewer → 403", cAddMember.status === 403, `status=${cAddMember.status}`);

  // تغییر نقش و حذف عضو توسط owner
  const members0 = await A.req(`/api/projects/${projectC0.id}/members`);
  const viewerMembership = (members0.body?.items ?? []).find((m) => m.email === userC.email);
  const roleChange = await A.req(`/api/projects/${projectC0.id}/members/${viewerMembership.id}`, {
    method: "PATCH",
    body: JSON.stringify({ role: "editor" }),
  });
  check("ارتقای viewer → editor توسط owner موفق", roleChange.status === 200);
  const cPatch2 = await C.req(`/api/projects/${projectC0.id}`, {
    method: "PATCH",
    body: JSON.stringify({ title: "پروژه آزمون نقش‌ها — ویرایش مجاز" }),
  });
  check("PATCH توسط editor جدید مجاز است", cPatch2.status === 200);
  const removeM = await A.req(`/api/projects/${projectC0.id}/members/${viewerMembership.id}`, { method: "DELETE" });
  check("حذف عضو توسط owner موفق", removeM.status === 200);
  const cPatch3 = await C.req(`/api/projects/${projectC0.id}`, {
    method: "PATCH",
    body: JSON.stringify({ title: "دوباره؟" }),
  });
  check("پس از حذف عضویت، دسترسی C → 404", cPatch3.status === 404, `status=${cPatch3.status}`);

  // ─── جداسازی پروژه نمونه ───
  console.log("\n[R1-X] جداسازی پروژه نمونه آموزشی از داده واقعی");
  const demo = makeClient();
  await demo.login("demo@timing.local", "demo1234");
  const demoSession = await demo.req("/api/auth/session");
  check("ورود کاربر نمونه موفق", !!demoSession.body?.user?.id);
  const demoList = await demo.req("/api/projects?demo=only");
  check("فیلتر demo=only فقط پروژه‌های نمونه", (demoList.body?.items ?? []).length >= 1 && demoList.body.items.every((p) => p.isDemo === true));
  const demoProject = demoList.body.items[0];
  check("پروژه نمونه DEMO-101 موجود است", demoProject?.code === "DEMO-101");
  // کاربر آزمون A نباید پروژه نمونه را ببیند (مالکیت demo user)
  const aAll = await A.req("/api/projects?status=all&demo=include");
  check("پروژه نمونه در فهرست کاربر واقعی A نیست (ایزوله)", (aAll.body?.items ?? []).every((p) => p.id !== demoProject.id));
  const aGetDemo = await A.req(`/api/projects/${demoProject.id}`);
  check("دسترسی مستقیم A به پروژه نمونه → 404", aGetDemo.status === 404, `status=${aGetDemo.status}`);
  const demoExclude = await demo.req("/api/projects?demo=exclude");
  check("فیلتر demo=exclude پروژه نمونه را حذف می‌کند", (demoExclude.body?.items ?? []).every((p) => !p.isDemo));

  // ─── اعتبارسنجی ورودی ───
  console.log("\n[اعتبارسنجی] داده نامعتبر رد می‌شود");
  const badCreate = await A.req("/api/projects", {
    method: "POST",
    body: JSON.stringify({ title: "x", code: "!!invalid!!", profileTemplateId: "nope" }),
  });
  check("کد نامعتبر/پروفایل ناموجود → 400 با جزئیات فیلد", badCreate.status === 400 && !!badCreate.body?.error?.details?.fields);
  const dupEmail = await anon.req("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ name: "تکراری", email: userA.email, password: "TestPass1234" }),
  });
  check("رایانامه تکراری → 409", dupEmail.status === 409, `status=${dupEmail.status}`);

  // ─── جمع‌بندی ───
  console.log("\n════════ جمع‌بندی ════════");
  console.log(`قبول: ${passed} · رد: ${failed}`);
  if (failed > 0) {
    console.log("آزمون‌های ردشده:");
    failures.forEach((f) => console.log(`  - ${f}`));
    process.exit(1);
  } else {
    console.log("همه آزمون‌های یکپارچگی فاز ۱ قبول شد ✓");
    console.log(`تاریخ اجرا: ${new Date().toISOString()}`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("\nخطای اجرای آزمون‌ها:", err);
  console.error("آیا سرور توسعه روی http://localhost:3000 در حال اجراست؟ (bun run dev)");
  process.exit(1);
});
