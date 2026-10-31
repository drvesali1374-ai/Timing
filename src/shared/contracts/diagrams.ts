/**
 * قراردادهای تبادل UI ↔ API — فاز ۳ (نمودارهای OPC/FPC).
 * سرور این شکل‌ها را تولید می‌کند و UI بدون آگاهی از Prisma از آن‌ها استفاده می‌کند.
 */

import type { DiagramDoc, DiagramKind, DiagramVariant, FpcSubject } from "@/shared/diagrams/types";

export type DiagramStatusDto = "draft" | "confirmed" | "archived";

export interface DiagramListItemDto {
  id: string;
  kind: DiagramKind;
  variant: DiagramVariant;
  title: string;
  description: string | null;
  subject: FpcSubject | null;
  distanceUnit: string | null;
  status: DiagramStatusDto;
  currentRev: number;
  variantOfId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface DiagramValidationSummaryDto {
  valid: boolean;
  errorCount: number;
  warningCount: number;
  summary: {
    counts: Record<string, number>;
    totalTimeSec: number;
    totalDistanceM: number;
    nodeCount: number;
    edgeCount: number;
  };
}

export interface DiagramDetailDto extends DiagramListItemDto {
  doc: DiagramDoc;
  layout: { positions: Record<string, { x: number; y: number }> };
  validation: DiagramValidationSummaryDto;
}

export interface DiagramRevisionDto {
  id: string;
  revNo: number;
  reason: string | null;
  origin: string;
  clientOpId: string | null;
  appliedSuggestions: Array<{ id: string; version: string; title: string }>;
  createdByName: string | null;
  createdAt: string;
}

export interface SaveRevisionResponseDto {
  diagram: DiagramDetailDto;
  revision: DiagramRevisionDto;
  duplicate: boolean;
}

export interface DiagramIssueDto {
  code: string;
  severity: "error" | "warning";
  nodeId?: string;
  edgeId?: string;
  messageFa: string;
}

export interface DiagramValidationReportDto {
  valid: boolean;
  errors: DiagramIssueDto[];
  warnings: DiagramIssueDto[];
  summary: {
    counts: Record<string, number>;
    totalTimeSec: number;
    totalDistanceM: number;
    nodeCount: number;
    edgeCount: number;
  };
  revision?: number;
}

export interface VariantCompareDto {
  current: DiagramListItemDto;
  proposed: DiagramListItemDto;
  diff: {
    current: { counts: Record<string, number>; totalTimeSec: number; totalDistanceM: number; nodeCount: number; edgeCount: number };
    proposed: { counts: Record<string, number>; totalTimeSec: number; totalDistanceM: number; nodeCount: number; edgeCount: number };
    countDelta: Record<string, number>;
    totalTimeDeltaSec: number;
    totalDistanceDeltaM: number;
    addedSteps: Array<{ title: string; symbol: string; symbolFa: string }>;
    removedSteps: Array<{ title: string; symbol: string; symbolFa: string }>;
    changedSteps: Array<{ title: string; timeBefore: number | null; timeAfter: number | null; distanceBefore: number | null; distanceAfter: number | null }>;
  };
}

// ── برچسب‌های فارسی ───────────────────────────────────────────

export const DIAGRAM_KIND_LABELS_FA: Record<DiagramKind, string> = {
  opc: "نمودار عملیات فرایند (OPC)",
  fpc: "نمودار جریان فرایند (FPC)",
};

export const DIAGRAM_KIND_SHORT_FA: Record<DiagramKind, string> = {
  opc: "OPC",
  fpc: "FPC",
};

export const DIAGRAM_VARIANT_LABELS_FA: Record<DiagramVariant, string> = {
  current: "روش موجود",
  proposed: "روش پیشنهادی",
};

export const DIAGRAM_STATUS_LABELS_FA: Record<DiagramStatusDto, string> = {
  draft: "پیش‌نویس",
  confirmed: "تأییدشده",
  archived: "بایگانی",
};

export const FPC_SUBJECT_OPTIONS_FA: Array<{ value: FpcSubject; labelFa: string }> = [
  { value: "material", labelFa: "ماده" },
  { value: "person", labelFa: "فرد" },
  { value: "equipment", labelFa: "تجهیزات" },
];
