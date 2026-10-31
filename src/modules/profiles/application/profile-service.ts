/**
 * لایه Application ماژول پروفایل‌ها — خواندن الگوها + همگام‌سازی از تعریف‌های کد
 * + ساخت snapshot مستقل برای ایجاد پروژه (نقطه ورود پروژه‌ها به این ماژول).
 */
import { db } from "@/lib/db";
import { ApiError } from "@/shared/errors";
import { getLogger } from "@/shared/logger";
import type {
  ProfileDetailDto,
  ProfileSummaryDto,
} from "@/shared/contracts/api";
import type { ProfileComponentsInput } from "@/shared/validation/project";
import type { ProfileSnapshot, ProfileDefinition } from "../domain/profile";
import { instantiateSnapshot } from "../domain/profile";
import { PROFILE_DEFINITIONS } from "../definitions";

const log = getLogger("profiles");

export interface ProfileTemplateRow {
  id: string;
  semver: string;
  nameFa: string;
  description: string;
  scopeOfUse: string;
  sourceType: string;
  sourceName: string;
  sourceVersion: string;
  sourceUrl: string | null;
  assumptionsJson: string;
  limitationsJson: string;
  licenseNote: string | null;
  contentJson: string;
  isDefault: boolean;
  isActive: boolean;
}

/** همگام‌سازی idempotent تعریف‌های کد → ProfileTemplate (بر اساس id). */
export async function ensureProfileTemplatesSeeded(): Promise<number> {
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
  return db.profileTemplate.count();
}

function parseContent(row: ProfileTemplateRow) {
  try {
    return JSON.parse(row.contentJson);
  } catch {
    throw ApiError.internal();
  }
}

function countContent(content: ReturnType<typeof parseContent>) {
  const families: Array<{ parameters: unknown[] }> = content?.families ?? [];
  return {
    familyCount: families.length,
    parameterCount: families.reduce((acc, f) => acc + (f.parameters?.length ?? 0), 0),
    formulaCount: content?.formulas?.length ?? 0,
  };
}

function toSummary(row: ProfileTemplateRow): ProfileSummaryDto {
  const counts = countContent(parseContent(row));
  return {
    id: row.id,
    semver: row.semver,
    nameFa: row.nameFa,
    description: row.description,
    scopeOfUse: row.scopeOfUse,
    source: {
      type: row.sourceType,
      name: row.sourceName,
      version: row.sourceVersion,
      url: row.sourceUrl,
    },
    isDefault: row.isDefault,
    ...counts,
  };
}

/** فهرست الگوها — اگر جدول خالی بود یک‌بار از تعریف‌ها همگام می‌شود (تاب‌آوری dev). */
export async function listProfiles(): Promise<ProfileSummaryDto[]> {
  let rows = await db.profileTemplate.findMany({
    where: { isActive: true },
    orderBy: [{ isDefault: "desc" }, { nameFa: "asc" }],
  });
  if (rows.length === 0) {
    log.warn("profile templates empty — syncing from code definitions");
    await ensureProfileTemplatesSeeded();
    rows = await db.profileTemplate.findMany({
      where: { isActive: true },
      orderBy: [{ isDefault: "desc" }, { nameFa: "asc" }],
    });
  }
  return rows.map(toSummary);
}

export async function getProfileDetail(id: string): Promise<ProfileDetailDto> {
  const row = await db.profileTemplate.findUnique({ where: { id } });
  if (!row || !row.isActive) throw ApiError.notFound("پروفایل یافت نشد.");
  const content = parseContent(row);
  return {
    ...toSummary(row),
    assumptions: safeParseArray(row.assumptionsJson),
    limitations: safeParseArray(row.limitationsJson),
    licenseNote: row.licenseNote,
    content,
  };
}

function safeParseArray(json: string): string[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export async function getProfileTemplateById(id: string): Promise<ProfileTemplateRow | null> {
  return db.profileTemplate.findUnique({ where: { id } });
}

export async function getProfileTemplateNames(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const rows = await db.profileTemplate.findMany({
    where: { id: { in: ids } },
    select: { id: true, nameFa: true },
  });
  return new Map(rows.map((r) => [r.id, r.nameFa]));
}

/** ساخت snapshot مستقل از الگو بر اساس اجزای انتخابی کاربر (پل به ماژول پروژه‌ها). */
export function instantiateProfileSnapshot(
  template: ProfileTemplateRow,
  components: ProfileComponentsInput,
): ProfileSnapshot {
  const def = {
    id: template.id,
    semver: template.semver,
    content: parseContent(template) as ProfileDefinition["content"],
  };
  return instantiateSnapshot(def, {
    excludedFamilies: components.excludedFamilies ?? [],
    parameterOverrides: components.parameterOverrides ?? [],
  });
}

/** پیش‌فرض معتبر برای فرم ایجاد پروژه (A2: پروفایل از پیش انتخاب‌شده). */
export async function getDefaultProfileId(): Promise<string> {
  const row = await db.profileTemplate.findFirst({ where: { isDefault: true, isActive: true } });
  return row?.id ?? PROFILE_DEFINITIONS[0]?.id ?? "";
}
