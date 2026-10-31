/**
 * فهرست پروفایل‌های روش‌شناختی نسخه‌دار — منبع کد-محور برای seed به ProfileTemplate.
 *
 * مشخصات: docs/PROFILES.md §۱ و §۵ (سازوکار «انتخاب در ایجاد پروژه»)
 * با اسکریپت seed به‌صورت idempotent بر اساس id+semver با پایگاه داده همگام می‌شوند و
 * هنگام ایجاد پروژه مطابق ADR-005 به‌صورت کپی مستقل (ProfileSnapshot) در پروژه ثبت می‌شوند.
 */

import type { ProfileDefinition } from "@/modules/profiles/domain/profile";

import { generalIndustrialTimeStudy } from "./general-industrial-time-study";
import { continuousTiming } from "./continuous-timing";
import { snapbackTiming } from "./snapback-timing";
import { manualMachine } from "./manual-machine";
import { leanStandardWork } from "./lean-standard-work";
import { fpcFlow } from "./fpc-flow";
import { serviceOperations } from "./service-operations";

/** همه پروفایل‌های نسخه‌دار؛ پروفایل پیش‌فرض (isDefault) اولین عضو است. */
export const PROFILE_DEFINITIONS: ProfileDefinition[] = [
  generalIndustrialTimeStudy,
  continuousTiming,
  snapbackTiming,
  manualMachine,
  leanStandardWork,
  fpcFlow,
  serviceOperations,
];

export {
  generalIndustrialTimeStudy,
  continuousTiming,
  snapbackTiming,
  manualMachine,
  leanStandardWork,
  fpcFlow,
  serviceOperations,
};
