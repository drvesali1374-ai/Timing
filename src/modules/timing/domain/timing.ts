/**
 * دامنه ماژول زمان‌سنجی — اعتبارسنجی zod + DTO + برچسب‌ها (فاز ۴).
 * هسته محاسباتی در shared/timing (خالص)؛ اینجا قراردادهای HTTP/DB اعتبارسنجی می‌شوند.
 */

import { z } from "zod";
import {
  CHRONO_EVENT_TYPES,
  INTEGRITY_FLAGS,
  TIMING_METHODS,
  type ChronoEvent,
  type IntegrityFlag,
  type TimingElementRef,
} from "@/shared/timing/types";

// ─────────────────────── برچسب‌های وضعیت ───────────────────────

export const SESSION_STATUS_VALUES = ["running", "paused", "stopped", "finalized"] as const;
export type SessionStatus = (typeof SESSION_STATUS_VALUES)[number];

export function isSessionStatus(v: unknown): v is SessionStatus {
  return typeof v === "string" && (SESSION_STATUS_VALUES as readonly string[]).includes(v);
}

export const SESSION_STATUS_LABELS_FA: Record<SessionStatus, string> = {
  running: "در حال ثبت",
  paused: "مکث",
  stopped: "پایان‌یافته",
  finalized: "نهایی‌شده",
};

export const ELEMENT_SOURCE_VALUES = ["activities", "diagram", "manual"] as const;
export type ElementSource = (typeof ELEMENT_SOURCE_VALUES)[number];

export const ELEMENT_SOURCE_LABELS_FA: Record<ElementSource, string> = {
  activities: "از فعالیت‌های پروژه",
  diagram: "از نمودار فرایندی",
  manual: "ورود دستی سریع",
};

export const ADVANCE_MODE_VALUES = ["manual", "auto"] as const;
export type AdvanceMode = (typeof ADVANCE_MODE_VALUES)[number];

export const ADVANCE_MODE_LABELS_FA: Record<AdvanceMode, string> = {
  manual: "دستی (انتخاب عنصر)",
  auto: "خودکار (پیش‌روی پس از ثبت)",
};

// ─────────────────────── اسکیمای ایجاد جلسه ───────────────────────

const elementRefSchema = z.object({
  key: z.string().min(1).max(80),
  name: z.string().min(1).max(160),
  activityStableKey: z.string().min(1).max(80).optional(),
  order: z.number().int().min(1),
});

export const createSessionSchema = z.object({
  method: z.enum(TIMING_METHODS),
  observer: z.string().min(1).max(120),
  elements: z.array(elementRefSchema).min(1).max(200),
  elementAdvanceMode: z.enum(ADVANCE_MODE_VALUES).default("manual"),
  tolerancePct: z.number().min(0).max(100).default(5),
  elementSource: z.enum(ELEMENT_SOURCE_VALUES).default("activities"),
  diagramRefId: z.string().min(1).optional(),
  diagramRefNote: z.string().max(300).optional(),
  notes: z.string().max(2_000).optional(),
});
export type CreateSessionInput = import("@/shared/contracts/timing").CreateTimingSessionInput;

// ─────────────────────── اسکیمای دریافت رویدادها (batch) ───────────────────────

const chronoEventInputSchema = z.object({
  clientEventId: z.string().min(8).max(64),
  seq: z.number().int().min(1),
  type: z.enum(CHRONO_EVENT_TYPES),
  elementId: z.string().min(1).max(80).optional(),
  cycleNo: z.number().int().min(0),
  elapsedActiveMs: z.number().min(0),
  splitMs: z.number().min(0).optional(),
  wallClock: z.string().datetime(),
  note: z.string().max(2_000).optional(),
  interruptionReason: z.string().max(200).optional(),
  correctionOf: z.string().min(8).max(64).optional(),
  correctedValueMs: z.number().min(0).optional(),
  correctionReason: z.string().max(500).optional(),
  integrity: z.array(z.enum(INTEGRITY_FLAGS)).optional(),
});

export const ingestEventsSchema = z.object({
  events: z.array(chronoEventInputSchema).min(1).max(200),
  origin: z.enum(["normal", "offline-synced"]).default("normal"),
});
export type IngestEventsInput = z.infer<typeof ingestEventsSchema>;

export const patchSessionSchema = z
  .object({
    notes: z.string().max(2_000).optional(),
  })
  .refine((v) => v.notes !== undefined, { message: "فقط notes قابل ویرایش است." });

// ─────────────────────── DTOها — قرارداد مشترک UI/API ───────────────────────
// انواع تبادل در shared/contracts/timing تعریف شده‌اند (قاعده مرزها: UI فقط shared).
export type {
  SessionStatusDto,
  ElementSourceDto,
  AdvanceModeDto,
  TimingSessionSummaryDto,
  TimingSessionDetailDto,
  TimingSessionDerivedDto,
  IngestResultDto,
  FinalizeResultDto,
} from "@/shared/contracts/timing";
export { SESSION_STATUS_LABELS_FA_DTO, ELEMENT_SOURCE_LABELS_FA_DTO } from "@/shared/contracts/timing";
