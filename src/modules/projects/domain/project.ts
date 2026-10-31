/**
 * دامنه ماژول پروژه‌ها — قواعد خالص و ناوردایی‌ها (بدون I/O).
 */
import { PROJECT_STATUSES, type ProjectReadinessDto, type ProjectStatus } from "@/shared/contracts/api";
import { ApiError } from "@/shared/errors";

export const PROJECT_STATUS_LABELS_FA: Record<ProjectStatus, string> = {
  active: "فعال",
  archived: "بایگانی‌شده",
  completed: "تکمیل‌شده",
};

export function assertProjectStatus(status: string): ProjectStatus {
  if (!(PROJECT_STATUSES as readonly string[]).includes(status)) {
    throw ApiError.badRequest("وضعیت پروژه نامعتبر است.");
  }
  return status as ProjectStatus;
}

export function isProjectStatus(status: string): status is ProjectStatus {
  return (PROJECT_STATUSES as readonly string[]).includes(status);
}

const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[\w.]+)?$/;

export function isValidSemver(v: string): boolean {
  return SEMVER_RE.test(v);
}

/** نسخه اولیه پیکربندی هر پروژه — ADR-005 (append-only از ۱٫۰٫۰) */
export const INITIAL_CONFIG_SEMVER = "1.0.0";

/**
 * محاسبه نشانگرهای آمادگی — честانه و مشتق‌شده از شمارنده‌های واقعی.
 * فاز ۱: activity/observation/standardTime همیشه صفرند (جدول‌شان در فازهای ۲/۴/۵
 * می‌آید)؛ بنابراین آمادگی اندازه‌گیری/تحلیل/تأیید تا آن فازها false می‌ماند —
 * نمایش صادقانه بدون وانمود به تکمیل (منشور C3-۱۲).
 */
export function computeReadiness(input: {
  hasConfigVersion: boolean;
  activityCount: number;
  observationCount: number;
  standardTimeResultCount: number;
  diagramCount: number;
}): ProjectReadinessDto {
  return {
    configReady: input.hasConfigVersion,
    diagramReady: input.diagramCount > 0, // فاز ۳ — نمودار OPC/FPC فعال
    measurementReady: input.activityCount > 0,
    analysisReady: input.observationCount > 0,
    approvalReady: input.standardTimeResultCount > 0,
  };
}

/** فیلدهای قابل جست‌وجوی متنی پروژه (B1) */
export const PROJECT_SEARCH_FIELDS = [
  "title",
  "code",
  "product",
  "line",
  "responsible",
  "department",
  "location",
] as const;
