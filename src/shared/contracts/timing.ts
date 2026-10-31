/**
 * قراردادهای تبادل UI ↔ API — فاز ۴ (کرنومتر و ثبت مشاهدات).
 * سرور این شکل‌ها را تولید می‌کند و UI بدون آگاهی از Prisma از آن‌ها استفاده می‌کند.
 * منطق دامنه (zod/اعتبارسنجی) در modules/timing/domain است — اینجا فقط انواع قرارداد.
 */

import type {
  ChronoEvent,
  DerivedCycle,
  IntegrityFlag,
  InterruptionRecord,
  TimingElementRef,
  TimingMethod,
} from "@/shared/timing/types";

// ─────────────────────── وضعیت‌ها/برچسب‌ها ───────────────────────

export type SessionStatusDto = "running" | "paused" | "stopped" | "finalized";

export const SESSION_STATUS_LABELS_FA_DTO: Record<SessionStatusDto, string> = {
  running: "در حال ثبت",
  paused: "مکث",
  stopped: "پایان‌یافته",
  finalized: "نهایی‌شده",
};

export type ElementSourceDto = "activities" | "diagram" | "manual";

export const ELEMENT_SOURCE_LABELS_FA_DTO: Record<ElementSourceDto, string> = {
  activities: "از فعالیت‌های پروژه",
  diagram: "از نمودار فرایندی",
  manual: "ورود دستی سریع",
};

export type AdvanceModeDto = "manual" | "auto";

// ─────────────────────── DTOهای جلسه ───────────────────────

export interface TimingSessionSummaryDto {
  id: string;
  method: string;
  methodLabelFa: string;
  status: SessionStatusDto;
  statusLabelFa: string;
  observer: string;
  elementSource: ElementSourceDto;
  elementCount: number;
  tolerancePct: number;
  elementAdvanceMode: AdvanceModeDto;
  eventCount: number;
  cycleCount: number;
  completedCycles: number;
  flags: IntegrityFlag[];
  startedAtWall: string | null;
  endedAtWall: string | null;
  notes: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface TimingSessionDerivedDto {
  phase: string;
  currentCycleNo: number;
  cycles: DerivedCycle[];
  completedCycles: number;
  activeMs: number;
  pausedMs: number | null;
  eventCount: number;
  flags: IntegrityFlag[];
  interruptions: InterruptionRecord[];
  startedAtWall: string | null;
  endedAtWall: string | null;
}

export interface TimingSessionDetailDto extends TimingSessionSummaryDto {
  elements: TimingElementRef[];
  events: ChronoEvent[];
  derived: TimingSessionDerivedDto;
  finalized: boolean;
}

/** ورودی ایجاد جلسه (قرارداد UI → API). */
export interface CreateTimingSessionInput {
  method: TimingMethod;
  observer: string;
  elements: TimingElementRef[];
  elementAdvanceMode: AdvanceModeDto;
  tolerancePct: number;
  elementSource: ElementSourceDto;
  diagramRefId?: string;
  diagramRefNote?: string;
  notes?: string;
}

export interface IngestResultDto {
  ingested: number;
  duplicates: number;
  rejected: Array<{ clientEventId: string; reasonFa: string }>;
  eventCount: number;
  sessionStatus: SessionStatusDto;
  flags: IntegrityFlag[];
}

export interface FinalizeResultDto {
  sessionId: string;
  status: "finalized";
  cycles: number;
  completedCycles: number;
  suspectCycles: number;
  recoveredCycles: number;
  incompleteCycles: number;
  totalActiveMs: number;
}
