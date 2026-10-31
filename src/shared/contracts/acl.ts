/**
 * منبع حقیقت کنترل دسترسی (ADR-009) — تنها جدول نقش/عملیات که UI و سرور
 * هر دو از آن می‌خوانند. افزودن نقش یا عملیات جدید = افزودن به همین فایل
 * (نقش‌ها قابل توسعه‌اند — دستور فاز ۱ بند ۳).
 *
 * نقش‌ها (پروژه‌محور):
 *  - owner: مالک پروژه — همه عملیات
 *  - editor: پیکربندی/داده — ویرایش و تکثیر
 *  - recorder: ثبت‌کننده مشاهدات (عملیات مشاهدات در فاز ۴ فعال می‌شود)
 *  - viewer: فقط خواندن/گزارش
 */

export const PROJECT_ROLES = ["owner", "editor", "recorder", "viewer"] as const;
export type ProjectRole = (typeof PROJECT_ROLES)[number];

export const PROJECT_ROLE_LABELS_FA: Record<ProjectRole, string> = {
  owner: "مالک",
  editor: "ویرایشگر",
  recorder: "ثبت‌کننده",
  viewer: "ببیننده",
};

export const PROJECT_ACTIONS = [
  "project:read",
  "project:update",
  "project:archive",
  "project:duplicate",
  "project:manage-members",
  "config:read",
  "audit:read",
] as const;
export type ProjectAction = (typeof PROJECT_ACTIONS)[number];

export const ROLE_PERMISSIONS: Record<ProjectRole, readonly ProjectAction[]> = {
  owner: [
    "project:read",
    "project:update",
    "project:archive",
    "project:duplicate",
    "project:manage-members",
    "config:read",
    "audit:read",
  ],
  editor: ["project:read", "project:update", "project:duplicate", "config:read", "audit:read"],
  // recorder: در فاز ۴ عملیات «observations:write» به این فهرست اضافه می‌شود
  recorder: ["project:read", "config:read"],
  viewer: ["project:read", "config:read"],
};

export function isProjectRole(value: unknown): value is ProjectRole {
  return typeof value === "string" && (PROJECT_ROLES as readonly string[]).includes(value);
}

export function roleCan(role: ProjectRole, action: ProjectAction): boolean {
  const perms = ROLE_PERMISSIONS[role];
  return Array.isArray(perms) && perms.includes(action);
}

/** نقشی که در عضویت قابل تخصیص است (owner فقط از طریق ایجاد پروژه/انتقال مالکیت). */
export const ASSIGNABLE_ROLES: readonly ProjectRole[] = ["editor", "recorder", "viewer"];
