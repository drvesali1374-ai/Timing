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
import { instantiateSnapshot } from "../src/modules/profiles/domain/profile";

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
        contentJson: JSON.stringify(def.content),
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
        contentJson: JSON.stringify(def.content),
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
    return;
  }
  const defaultTemplate = PROFILE_DEFINITIONS.find((d) => d.isDefault) ?? PROFILE_DEFINITIONS[0];
  const snapshot = instantiateSnapshot(defaultTemplate, {
    excludedFamilies: [],
    parameterOverrides: [],
  });

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
  console.log(`[seed] demo project created: DEMO-101 (isDemo=true, owner=${DEMO_EMAIL})`);
}

async function main() {
  await seedProfiles();
  const demoUser = await seedDemoUser();
  await seedDemoProject(demoUser.id);
  console.log("[seed] done ✓");
}

main()
  .catch((err) => {
    console.error("[seed] failed:", err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
