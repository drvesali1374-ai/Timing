/**
 * Seed فاز ۱ — اجرای idempotent:
 *  ۱) همگام‌سازی ۷ الگوی پروفایل روش‌شناختی از تعریف‌های کد
 *  ۲) کاربر نمونه (demo@timing.local / demo1234)
 *  ۳) یک پروژه آموزشی ایزوله (isDemo=true) با پیکربندی instantiate شده از پروفایل پیش‌فرض
 *
 * اجرا: `bun run seed`
 * قاعده: پروژه نمونه مالکیتش با کاربر نمونه است؛ در فهرست پروژه‌های کاربران واقعی
 * ظاهر نمی‌شود (جداسازی مالکیت + isDemo — DATA_DICTIONARY §۴-۵).
 */
import { PrismaClient } from "@prisma/client";
import { scryptSync, randomBytes } from "node:crypto";
import { randomUUID } from "node:crypto";

const db = new PrismaClient();

// همان ساختار تعریف پروفایل — برای جلوگیری از pull-in مسیر TS در اسکریپت seed،
// از مسیر ماژول با alias استفاده می‌کنیم (bun از tsconfig paths پشتیبانی می‌کند)
import { PROFILE_DEFINITIONS } from "../src/modules/profiles/definitions";
import { instantiateSnapshot, buildV2Content } from "../src/modules/profiles/domain/profile";
import { ManualClock } from "../src/shared/timing/clock";
import { ChronoEngine } from "../src/shared/timing/engine";
import { deriveSession } from "../src/shared/timing/derive";
import type { ChronoEvent, TimingElementRef } from "../src/shared/timing/types";

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const key = scryptSync(password, salt, 64, { N: 16384 }).toString("hex");
  return `scrypt$16384$${salt}$${key}`;
}

function uuidv7(): string {
  const ts = Date.now();
  const tsBuf = Buffer.alloc(6);
  tsBuf.writeUIntBE(ts, 0, 6);
  const rand = randomBytes(10);
  rand[0] = (rand[0] & 0x0f) | 0x70;
  rand[2] = (rand[2] & 0x3f) | 0x80;
  const hex = Buffer.concat([tsBuf, rand]).toString("hex");
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20, 32)].join("-");
}

const DEMO_EMAIL = "demo@timing.local";
const DEMO_PASSWORD = "demo1234";

async function seedProfiles() {
  for (const def of PROFILE_DEFINITIONS) {
    const contentV2 = buildV2Content(def);
    await db.profileTemplate.upsert({
      where: { id: def.id },
      update: {
        semver: def.semver,
        nameFa: def.nameFa,
        description: def.description,
        scopeOfUse: def.scopeOfUse,
        sourceType: def.source.type,
        sourceName: def.source.name,
        sourceVersion: def.source.version,
        sourceUrl: def.source.url ?? null,
        assumptionsJson: JSON.stringify(def.assumptions),
        limitationsJson: JSON.stringify(def.limitations),
        licenseNote: def.licenseNote,
        contentJson: JSON.stringify(contentV2),
        isDefault: def.isDefault ?? false,
        isActive: true,
      },
      create: {
        id: def.id,
        semver: def.semver,
        nameFa: def.nameFa,
        description: def.description,
        scopeOfUse: def.scopeOfUse,
        sourceType: def.source.type,
        sourceName: def.source.name,
        sourceVersion: def.source.version,
        sourceUrl: def.source.url ?? null,
        assumptionsJson: JSON.stringify(def.assumptions),
        limitationsJson: JSON.stringify(def.limitations),
        licenseNote: def.licenseNote,
        contentJson: JSON.stringify(contentV2),
        isDefault: def.isDefault ?? false,
        isActive: true,
      },
    });
  }
  const count = await db.profileTemplate.count();
  console.log(`[seed] profile templates: ${count} (پیش‌فرض: ${PROFILE_DEFINITIONS.find((d) => d.isDefault)?.id})`);
}

async function seedDemoUser() {
  const existing = await db.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (existing) {
    console.log(`[seed] demo user exists: ${DEMO_EMAIL}`);
    return existing;
  }
  const user = await db.user.create({
    data: {
      id: uuidv7(),
      email: DEMO_EMAIL,
      name: "کاربر نمونه (آموزشی)",
      passwordHash: hashPassword(DEMO_PASSWORD),
      authProvider: "credentials",
    },
  });
  console.log(`[seed] demo user created: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  return user;
}

async function seedDemoProject(demoUserId: string) {
  const existingDemoProject = await db.project.findFirst({
    where: { isDemo: true, createdById: demoUserId },
  });
  if (existingDemoProject) {
    console.log(`[seed] demo project exists: ${existingDemoProject.code}`);
    await seedDemoActivities(existingDemoProject.id, demoUserId);
    return;
  }
  const defaultTemplate = PROFILE_DEFINITIONS.find((d) => d.isDefault) ?? PROFILE_DEFINITIONS[0];
  const snapshot = instantiateSnapshot(
    { id: defaultTemplate.id, semver: defaultTemplate.semver, content: buildV2Content(defaultTemplate) },
    { excludedFamilies: [], parameterOverrides: [] },
  );

  const projectId = uuidv7();
  const configVersionId = uuidv7();

  await db.$transaction(async (tx) => {
    await tx.project.create({
      data: {
        id: projectId,
        code: "DEMO-101",
        title: "پروژه آموزشی: خط مونتاژ رادیاتور (نمونه)",
        goal: "آشنایی با گردش کار پلتفرم: ایجاد پروژه از پروفایل، پیکربندی پایه و مشاهده ساختار — این پروژه آموزشی است و وارد نتایج پروژه‌های واقعی نمی‌شود.",
        location: "کارخانه نمونه — سالن ۲",
        department: "مونتاژ",
        line: "خط مونتاژ A",
        station: "ایستگاه ۳ (نصب درب)",
        product: "رادیاتور مدل R-200",
        process: "مونتاژ نهایی",
        responsible: "کاربر نمونه",
        shift: "شیفت ۱",
        notes: "این پروژه به‌عنوان نمونه آموزشی ایزوله شده است (isDemo=true) و متعلق به کاربر نمونه است.",
        status: "active",
        isDemo: true,
        profileTemplateId: defaultTemplate.id,
        profileTemplateVersion: defaultTemplate.semver,
        profileSnapshotId: configVersionId,
        createdById: demoUserId,
      },
    });
    await tx.projectMembership.create({
      data: { id: uuidv7(), projectId, userId: demoUserId, role: "owner" },
    });
    await tx.configVersion.create({
      data: {
        id: configVersionId,
        projectId,
        semver: "1.0.0",
        snapshotJson: JSON.stringify(snapshot),
        reason: `ایجاد پروژه آموزشی از پروفایل «${defaultTemplate.nameFa}» نسخه ${defaultTemplate.semver}`,
        profileTemplateId: defaultTemplate.id,
        profileTemplateVersion: defaultTemplate.semver,
        createdBy: demoUserId,
      },
    });
    await tx.project.update({
      where: { id: projectId },
      data: { currentConfigVersionId: configVersionId },
    });
    await tx.auditLog.create({
      data: {
        id: uuidv7(),
        userId: demoUserId,
        action: "project.created",
        entityType: "Project",
        entityId: projectId,
        projectId,
        afterJson: JSON.stringify({ code: "DEMO-101", isDemo: true, title: "پروژه آموزشی: خط مونتاژ رادیاتور (نمونه)" }),
      },
    });
    await tx.auditLog.create({
      data: {
        id: uuidv7(),
        userId: demoUserId,
        action: "config.version-created",
        entityType: "ConfigVersion",
        entityId: configVersionId,
        projectId,
        afterJson: JSON.stringify({ semver: "1.0.0", reason: `از پروفایل ${defaultTemplate.nameFa}` }),
      },
    });
  });
  await seedDemoActivities(projectId, demoUserId);
  console.log(`[seed] demo project created: DEMO-101 (isDemo=true, owner=${DEMO_EMAIL})`);
}

async function seedDemoActivities(projectId: string, demoUserId: string) {
  // فعالیت‌های نمونه آموزشی (مدل B5) — فقط برای پروژه isDemo؛ با داده واقعی مخلوط نمی‌شود
  const existingActivities = await db.activity.count({ where: { projectId } });
  if (existingActivities > 0) {
    console.log(`[seed] demo activities exist: ${existingActivities}`);
    return;
  }
  const demoActivities: Array<{ stableKey: string; name: string; workType: string; description: string; order: number }> = [
    { stableKey: "el.fetch-housing", name: "برداشتن بدنه از جایگاه", workType: "operatorManual", description: "برداشتن بدنه رادیاتور از پالت و قرار دادن روی فیکسچر.", order: 1 },
    { stableKey: "el.insert-core", name: "جای‌گذاری هسته در بدنه", workType: "operatorManual", description: "هدایت هسته داخل بدنه با کنترل هم‌محوری.", order: 2 },
    { stableKey: "el.tighten-bolts", name: "پیش‌بستن پیچ‌ها با گوشی بادی", workType: "operatorManual", description: "پیش‌بستن ۴ پیچ M6 با گوشی بادی (تنظیم گشتاور).", order: 3 },
    { stableKey: "el.press-test", name: "آزمون نشتی (ماشین)", workType: "machineAuto", description: "چرخه خودکار آزمون نشتی هوای فشرده توسط دستگاه.", order: 4 },
    { stableKey: "el.wait-press", name: "انتظار اپراتور در حین آزمون", workType: "waiting", description: "زمان انتظار تا پایان چرخه آزمون — کاندید بهبود.", order: 5 },
    { stableKey: "el.final-inspect", name: "بازرسی نهایی چشمی", workType: "inspection", description: "کنترل چشمی درزها و برچسب، تفکیک مغایرت.", order: 6 },
  ];
  for (const act of demoActivities) {
    await db.activity.create({
      data: {
        id: uuidv7(),
        projectId,
        stableKey: act.stableKey,
        name: act.name,
        description: act.description,
        workType: act.workType,
        sourceOfTime: "measured",
        order: act.order,
        archived: false,
        createdBy: demoUserId,
      },
    });
  }
  console.log(`[seed] demo activities: ${demoActivities.length} عنصر نمونه ثبت شد`);
}

// ─────────────── فاز ۵: جلسات نمونه نهایی‌شده برای پروژه isDemo ───────────────
// داده نمونه آموزشی — فقط پروژه isDemo؛ با داده واقعی مخلوط نمی‌شود (قاعده بخش D).
// مسیر تولید: همان هسته واقعی (ChronoEngine + ManualClock + deriveSession) — بدون جعل.

async function seedDemoTimingSessions(projectId: string, demoUserId: string) {
  const existing = await db.timingSession.count({ where: { projectId } });
  if (existing > 0) {
    console.log(`[seed] demo timing sessions exist: ${existing}`);
    return;
  }

  const demoActs = await db.activity.findMany({ where: { projectId }, orderBy: { order: "asc" } });
  if (demoActs.length === 0) return;

  const elements: TimingElementRef[] = demoActs.map((a, i) => ({
    key: a.stableKey,
    name: a.name,
    activityStableKey: a.stableKey,
    order: i + 1,
  }));

  // سناریوی نمونه ۱: پیوسته — ۸ چرخه با پراکندگی واقع‌گرایانه + یک مشاهده پرت + یک وقفه
  const baseCycle: Record<string, number> = {
    "el.fetch-housing": 4100,
    "el.insert-core": 6200,
    "el.tighten-bolts": 8300,
    "el.press-test": 12000,
    "el.wait-press": 12000,
    "el.final-inspect": 3100,
  };
  const jitter = (base: number, pct: number, rnd: () => number) => Math.round(base * (1 + (rnd() * 2 - 1) * pct));

  // مولد شبه‌تصادفی قطعی (seed ثابت) — داده نمونه بازتولیدپذیر
  let seedState = 42;
  const rnd = () => {
    seedState = (seedState * 1664525 + 1013904223) % 4294967296;
    return seedState / 4294967296;
  };

  const buildSessionEvents = (sessionNo: number, cycles: number, opts: { outlierAt?: number; pauseAt?: number }): ChronoEvent[] => {
    const clock = new ManualClock(0, Date.UTC(2026, 9, 31, 6, sessionNo * 2, 0));
    let idc = 0;
    const idGen = () => `demo${sessionNo}-${String((idc += 1)).padStart(4, "0")}`;
    const engine = new ChronoEngine({ clock, sessionId: "demo", method: "continuous", elements, idGen });
    engine.start();
    for (let c = 1; c <= cycles; c += 1) {
      engine.cycleStart();
      for (const el of elements) {
        const isOutlier = opts.outlierAt === c && el.key === "el.tighten-bolts";
        const ms = isOutlier ? baseCycle[el.key] * 2 : jitter(baseCycle[el.key], 0.08, rnd);
        clock.advance(ms);
        engine.recordReading(el.key);
      }
      if (opts.pauseAt === c) {
        engine.pause("کمبود قطعه — انتظار برای تأمین");
        clock.advance(45_000);
        engine.resume();
      }
    }
    engine.stop("پایان جلسه نمونه");
    return [...engine.events()];
  };

  const sessionsSpec = [
    { no: 1, cycles: 8, opts: { outlierAt: 6, pauseAt: 4 }, observer: "مهندس مطالعه کار (نمونه)" },
    { no: 2, cycles: 7, opts: {}, observer: "مهندس مطالعه کار (نمونه)" },
    { no: 3, cycles: 6, opts: {}, observer: "کارشناس دوم (نمونه)" },
  ];

  for (const spec of sessionsSpec) {
    const sessionId = uuidv7();
    const events = buildSessionEvents(spec.no, spec.cycles, spec.opts);
    const derived = deriveSession(events, elements, { method: "continuous", tolerancePct: 5 });

    await db.timingSession.create({
      data: {
        id: sessionId,
        projectId,
        method: "continuous",
        status: "finalized",
        observer: spec.observer,
        elementsJson: JSON.stringify(elements),
        elementAdvanceMode: "manual",
        tolerancePct: 5,
        elementSource: "activities",
        startedAtWall: derived.startedAtWall ? new Date(derived.startedAtWall) : null,
        endedAtWall: derived.endedAtWall ? new Date(derived.endedAtWall) : null,
        integrityFlagsJson: derived.flags.length > 0 ? JSON.stringify(derived.flags) : null,
        notes: "جلسه نمونه آموزشی (isDemo) — از هسته واقعی ChronoEngine با ManualClock قطعی تولید شد؛ داده آموزشی است.",
        createdBy: demoUserId,
      },
    });

    // رویدادها — append-only با clientEventId یکتا
    for (const ev of events) {
      await db.timingEvent.create({
        data: {
          id: uuidv7(),
          sessionId,
          clientEventId: ev.clientEventId,
          seq: ev.seq,
          type: ev.type,
          elementId: ev.elementId ?? null,
          cycleNo: ev.cycleNo,
          elapsedActiveMs: ev.elapsedActiveMs,
          splitMs: ev.splitMs ?? null,
          wallClock: new Date(ev.wallClock),
          note: ev.note ?? null,
          interruptionReason: ev.interruptionReason ?? null,
          correctionOf: ev.correctionOf ?? null,
          correctedValueMs: ev.correctedValueMs ?? null,
          correctionReason: ev.correctionReason ?? null,
          integrityJson: ev.integrity && ev.integrity.length > 0 ? JSON.stringify(ev.integrity) : null,
          origin: "normal",
          receivedBy: demoUserId,
        },
      });
    }

    // رویداد نهایی‌سازی (تولید سرور — قرارداد فاز ۴)
    await db.timingEvent.create({
      data: {
        id: uuidv7(),
        sessionId,
        clientEventId: `finalize-${uuidv7()}`,
        seq: events.length + 1,
        type: "finalize",
        elementId: null,
        cycleNo: derived.currentCycleNo,
        elapsedActiveMs: derived.activeMs,
        splitMs: null,
        wallClock: new Date(),
        note: null,
        interruptionReason: null,
        correctionOf: null,
        correctedValueMs: null,
        correctionReason: null,
        integrityJson: null,
        origin: "normal",
        receivedBy: demoUserId,
      },
    });

    // چرخه‌های مشتق — ورودی پایدار تحلیل فاز ۵
    for (const cyc of derived.cycles) {
      await db.timingCycle.create({
        data: {
          id: uuidv7(),
          sessionId,
          seq: cyc.seq,
          status: cyc.status,
          startedAtEventId: cyc.startedAtEventId,
          endedAtEventId: cyc.endedAtEventId ?? null,
          startedElapsedMs: cyc.startedElapsedMs,
          endedElapsedMs: cyc.endedElapsedMs ?? null,
          cycleTimeMs: cyc.cycleTimeMs ?? null,
          elementsSumMs: cyc.elementsSumMs,
          deviationPct: cyc.deviationPct ?? null,
          elementsJson: JSON.stringify(cyc.elements),
          interruptionsJson: JSON.stringify(cyc.interruptions),
          flagsJson: cyc.flags.length > 0 ? JSON.stringify(cyc.flags) : null,
        },
      });
    }
    console.log(`[seed] demo timing session ${spec.no}: ${spec.cycles} چرخه · ${events.length} رویداد`);
  }
}

// ══════════ مثال آموزشی یکپارچه (دستورالعمل ۸٫۳ — ADR-017) ══════════
// «خط مونتاژ پنل»: ایستگاه‌ها + فعالیت‌های متصل + برگه ثبت دستی نهایی‌شده با وقفه «سایر».
// تمام مسیر جدید (بدون کرنومتر) را با داده واقعی قابل پیگیری نمایش می‌دهد.

async function seedTutorialProject(demoUserId: string) {
  const existing = await db.project.findFirst({ where: { code: "DEMO-102", isDemo: true } });
  if (existing) {
    console.log("[seed] tutorial project exists: DEMO-102");
    return;
  }
  const defaultTemplate = PROFILE_DEFINITIONS.find((d) => d.isDefault) ?? PROFILE_DEFINITIONS[0];
  const snapshot = instantiateSnapshot(
    { id: defaultTemplate.id, semver: defaultTemplate.semver, content: buildV2Content(defaultTemplate) },
    { excludedFamilies: [], parameterOverrides: [] },
  );

  const projectId = uuidv7();
  const configVersionId = uuidv7();

  await db.$transaction(async (tx) => {
    await tx.project.create({
      data: {
        id: projectId,
        code: "DEMO-102",
        title: "مثال آموزشی: خط مونتاژ پنل (از ابتدا تا گزارش)",
        goal: "راهنمای قدم‌به‌قدم زنده — کاربر تازه‌کار با همین مثال کل مسیر (ایستگاه‌ها ← فعالیت‌ها ← ثبت دستی زمان ← تحلیل ← گزارش) را دنبال می‌کند.",
        location: "کارخانه نمونه — سالن ۱",
        department: "مونتاژ",
        line: "خط مونتاژ پنل",
        product: "پنل کنترل صنعتی مدل P-100",
        process: "مونتاژ دستی",
        responsible: "کاربر نمونه",
        shift: "صبح (۸ تا ۱۶)",
        notes: "پروژه آموزشی ایزوله (isDemo=true) — مثال کامل دستورالعمل بخش ۸٫۳.",
        status: "active",
        isDemo: true,
        profileTemplateId: defaultTemplate.id,
        profileTemplateVersion: defaultTemplate.semver,
        profileSnapshotId: configVersionId,
        createdById: demoUserId,
      },
    });
    await tx.projectMembership.create({ data: { id: uuidv7(), projectId, userId: demoUserId, role: "owner" } });
    await tx.configVersion.create({
      data: {
        id: configVersionId,
        projectId,
        semver: "1.0.0",
        snapshotJson: JSON.stringify(snapshot),
        reason: `مثال آموزشی از پروفایل «${defaultTemplate.nameFa}»`,
        profileTemplateId: defaultTemplate.id,
        profileTemplateVersion: defaultTemplate.semver,
        createdBy: demoUserId,
      },
    });
    await tx.project.update({ where: { id: projectId }, data: { currentConfigVersionId: configVersionId } });
    await tx.auditLog.create({
      data: {
        id: uuidv7(),
        userId: demoUserId,
        action: "project.created",
        entityType: "Project",
        entityId: projectId,
        projectId,
        afterJson: JSON.stringify({ code: "DEMO-102", isDemo: true }),
      },
    });
  });

  // ایستگاه‌های خط به ترتیب جریان کار (۸٫۳)
  const stationNames = ["آماده‌سازی قطعات", "مونتاژ", "بازرسی", "بسته‌بندی"];
  const stations: Array<{ id: string; name: string }> = [];
  for (let i = 0; i < stationNames.length; i += 1) {
    const id = uuidv7();
    await db.workStation.create({
      data: { id, projectId, name: stationNames[i], orderIndex: i + 1, createdBy: demoUserId },
    });
    stations.push({ id, name: stationNames[i] });
  }

  // فعالیت‌ها با شناسه خودکار، متصل به ایستگاه‌ها (۸٫۳)
  interface TutAct { id: string; stableKey: string; name: string; stationIdx: number; workType?: string }
  const acts: TutAct[] = [];
  const actDefs = [
    { name: "برداشتن قطعه از جعبه", stationIdx: 0 },
    { name: "جای‌گذاری قطعه در محل", stationIdx: 1 },
    { name: "نصب پیچ", stationIdx: 1 },
    { name: "کنترل اتصال", stationIdx: 1, workType: "inspection" },
    { name: "بازرسی نهایی", stationIdx: 2, workType: "inspection" },
    { name: "بسته‌بندی", stationIdx: 3 },
  ];
  let order = 0;
  for (const def of actDefs) {
    const id = uuidv7();
    order += 1;
    const stableKey = `act-${order}`;
    await db.activity.create({
      data: {
        id,
        projectId,
        stableKey,
        name: def.name,
        workType: def.workType ?? "operatorManual",
        stationId: stations[def.stationIdx].id,
        order,
        createdBy: demoUserId,
      },
    });
    acts.push({ id, stableKey, name: def.name, stationIdx: def.stationIdx });
  }

  // برگه ثبت دستی نهایی‌شده — زمان‌های نمونه (۵ نمونه × ۵ فعالیت داده‌دار، جدول ۵٫۳)
  const sheetId = uuidv7();
  await db.manualSheet.create({
    data: {
      id: sheetId,
      projectId,
      title: "اندازه‌گیری خط مونتاژ پنل — نمونه آموزشی",
      status: "finalized",
      note: "زمان‌ها با کرنومتر مستقل اندازه‌گیری و دستی ثبت شده‌اند (۵ نمونه هر فعالیت).",
      sampleCount: 5,
      createdBy: demoUserId,
    },
  });
  // داده آموزشی — الگوی واقع‌گرا با پراکندگی کوچک (ثانیه)
  const times: Record<string, number[]> = {
    "برداشتن قطعه از جعبه": [4.2, 4.5, 4.1, 4.3, 4.4],
    "جای‌گذاری قطعه در محل": [7.1, 7.3, 6.9, 7.0, 7.2],
    "نصب پیچ": [12.1, 12.5, 12.3, 12.2, 12.6],
    "کنترل اتصال": [6.2, 6.0, 6.5, 6.1, 6.3],
    "بازرسی نهایی": [9.8, 10.1, 9.9, 10.0, 10.2],
  };
  for (const act of acts) {
    const arr = times[act.name];
    if (!arr) continue;
    for (let s = 0; s < arr.length; s += 1) {
      await db.manualObservation.create({
        data: {
          id: uuidv7(),
          sheetId,
          activityId: act.id,
          sampleIndex: s + 1,
          durationMs: Math.round(arr[s] * 1000),
          source: "manual",
          recordedBy: demoUserId,
        },
      });
    }
  }
  // وقفه نمونه ۱: علت متداول با مدت (۵٫۵)
  await db.manualInterruption.create({
    data: {
      id: uuidv7(),
      sheetId,
      activityId: acts.find((a) => a.name === "نصب پیچ")!.id,
      reason: "material-shortage",
      reasonOther: null,
      durationMs: 45000,
      note: "در نمونه ۳، قطعه از قفسه موجود نبود.",
      sampleIndex: 3,
      recordedBy: demoUserId,
    },
  });
  // وقفه نمونه ۲: «سایر» با علت دستی + مدت نامشخص (الزام ۵٫۵)
  await db.manualInterruption.create({
    data: {
      id: uuidv7(),
      sheetId,
      activityId: acts.find((a) => a.name === "بازرسی نهایی")!.id,
      reason: "other",
      reasonOther: "انتظار برای تأیید سرپرست کیفیت",
      durationMs: null,
      note: "مدت دقیق ثبت نشده بود — نامشخص صادقانه ثبت می‌شود.",
      sampleIndex: null,
      recordedBy: demoUserId,
    },
  });
  await db.auditLog.create({
    data: {
      id: uuidv7(),
      userId: demoUserId,
      action: "manual.sheet-finalized",
      entityType: "ManualSheet",
      entityId: sheetId,
      projectId,
      afterJson: JSON.stringify({ title: "اندازه‌گیری خط مونتاژ پنل — نمونه آموزشی", observations: 25, interruptions: 2 }),
    },
  });
  console.log("[seed] tutorial project created: DEMO-102 (stations=4, activities=6, sheet finalized با ۲ وقفه)");
}

async function main() {
  await seedProfiles();
  const demoUser = await seedDemoUser();
  const demoProject = await db.project.findFirst({ where: { isDemo: true, createdById: demoUser.id } });
  await seedDemoProject(demoUser.id);
  if (demoProject) {
    await seedDemoTimingSessions(demoProject.id, demoUser.id);
  }
  await seedTutorialProject(demoUser.id);
  console.log("[seed] done ✓");
}

main()
  .catch((err) => {
    console.error("[seed] failed:", err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
