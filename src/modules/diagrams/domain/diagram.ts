/**
 * دامنه ماژول نمودارها — قواعد معنایی مستقل از نمایش (فاز ۳ — B6/ENGINE_CONTRACTS §۲).
 * هسته محاسباتی (نوع‌ها/اعتبارسنجی/چیدمان/SVG) در shared/diagrams است (هسته مشترک — الگوی ADR-011).
 * اینجا: قواعد سرویس — وضعیت‌ها، گذارهای مجاز، اعتبارسنجی ورودی سمت سرور.
 */

import { z } from "zod";
import { ApiError } from "@/shared/errors";
import {
  DIAGRAM_LIMITS,
  isDiagramSymbolFor,
  type DiagramDoc,
  type DiagramKind,
  type DiagramVariant,
  type FpcSubject,
} from "@/shared/diagrams/types";

export const DIAGRAM_STATUSES = ["draft", "confirmed", "archived"] as const;
export type DiagramStatus = (typeof DIAGRAM_STATUSES)[number];

export const DIAGRAM_STATUS_LABELS_FA: Record<DiagramStatus, string> = {
  draft: "پیش‌نویس",
  confirmed: "تأییدشده",
  archived: "بایگانی",
};

export const DIAGRAM_VARIANT_LABELS_FA: Record<DiagramVariant, string> = {
  current: "روش موجود",
  proposed: "روش پیشنهادی",
};

export const DIAGRAM_KIND_LABELS_FA: Record<DiagramKind, string> = {
  opc: "نمودار عملیات فرایند (OPC)",
  fpc: "نمودار جریان فرایند (FPC)",
};

export function isDiagramStatus(v: unknown): v is DiagramStatus {
  return typeof v === "string" && (DIAGRAM_STATUSES as readonly string[]).includes(v);
}

// ─────────────────────── اعتبارسنجی سند نمودار (سمت سرور) ───────────────────────

const pointSchema = z.object({ x: z.number().finite(), y: z.number().finite() });

const nodeSchema = z
  .object({
    id: z.string().min(1).max(64),
    stepNo: z.number().int().nullable().optional(),
    symbol: z.string().min(1).max(32),
    title: z.string().min(1).max(DIAGRAM_LIMITS.maxTitleLen),
    description: z.string().max(DIAGRAM_LIMITS.maxDescriptionLen).nullable().optional(),
    timeSec: z.number().finite().nullable().optional(),
    distanceM: z.number().finite().nullable().optional(),
    quantity: z.number().finite().nullable().optional(),
    location: z.string().max(120).nullable().optional(),
    origin: z.string().max(120).nullable().optional(),
    destination: z.string().max(120).nullable().optional(),
    sourceRef: z.string().max(120).nullable().optional(),
    note: z.string().max(1000).nullable().optional(),
    colorKey: z.string().max(32).nullable().optional(),
    activityStableKey: z.string().max(120).nullable().optional(),
    customAttrs: z
      .array(z.object({ key: z.string().max(60), value: z.string().max(200) }))
      .max(DIAGRAM_LIMITS.maxCustomAttrs)
      .nullable()
      .optional(),
  })
  .strict();

const edgeSchema = z
  .object({
    id: z.string().min(1).max(64),
    from: z.string().min(1).max(64),
    to: z.string().min(1).max(64),
    label: z.string().max(120).nullable().optional(),
  })
  .strict();

const docSchema = z
  .object({
    kind: z.enum(["opc", "fpc"]),
    variant: z.enum(["current", "proposed"]),
    subject: z.enum(["material", "person", "equipment"]).nullable().optional(),
    distanceUnit: z.string().max(8).optional(),
    nodes: z.array(nodeSchema).max(DIAGRAM_LIMITS.maxNodes),
    edges: z.array(edgeSchema).max(DIAGRAM_LIMITS.maxEdges),
  })
  .strict();

export const layoutSchema = z
  .object({
    positions: z.record(z.string().max(64), pointSchema),
  })
  .strict();

/**
 * اعتبارسنجی کامل ورودی سند نمودار — خطای ۴۰۰ با پیام فارسی.
 * نماد باید در فهرست بسته نوع نمودار باشد (قید ۱ قرارداد).
 */
export function assertDiagramDoc(input: unknown): DiagramDoc {
  const parsed = docSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw ApiError.badRequest(`ساختار نمودار نامعتبر است: ${first?.path.join(".") ?? ""} — ${first?.message ?? ""}`);
  }
  const doc = parsed.data;
  // نماد بسته
  for (const node of doc.nodes) {
    if (!isDiagramSymbolFor(doc.kind, node.symbol)) {
      throw ApiError.badRequest(`نماد «${node.symbol}» در فهرست بسته نمادهای ${doc.kind.toUpperCase()} نیست.`);
    }
  }
  // موضوع FPC
  if (doc.kind === "fpc" && !doc.subject) {
    throw ApiError.badRequest("نمودار FPC باید موضوع مطالعه (ماده/فرد/تجهیزات) داشته باشد.");
  }
  if (doc.kind === "opc" && doc.subject) {
    throw ApiError.badRequest("نمودار OPC موضوع مطالعه ندارد (مخصوص FPC است).");
  }
  return doc as DiagramDoc;
}

export function assertLayout(input: unknown): { positions: Record<string, { x: number; y: number }> } {
  const parsed = layoutSchema.safeParse(input);
  if (!parsed.success) {
    throw ApiError.badRequest("ساختار چیدمان نامعتبر است (مختصات گره‌ها).");
  }
  return parsed.data;
}

/** نوع سند برای ایجاد — فیلدهای بالای سند */
export const createMetaSchema = z
  .object({
    kind: z.enum(["opc", "fpc"]),
    variant: z.enum(["current", "proposed"]).default("current"),
    title: z.string().min(1).max(160),
    description: z.string().max(2000).nullable().optional(),
    subject: z.enum(["material", "person", "equipment"]).nullable().optional(),
    distanceUnit: z.string().max(8).optional(),
    /** برای variant=proposed: نمودار فعلی مرجع مقایسه */
    variantOfId: z.string().max(64).nullable().optional(),
    /** سند اولیه (اختیاری) + چیدمان اولیه */
    doc: docSchema.optional(),
    layout: layoutSchema.optional(),
  })
  .strict();

export type CreateMetaInput = z.infer<typeof createMetaSchema>;

export const saveRevisionSchema = z
  .object({
    doc: docSchema,
    layout: layoutSchema,
    reason: z.string().max(300).nullable().optional(),
    appliedSuggestions: z
      .array(z.object({ id: z.string().max(80), version: z.string().max(32), title: z.string().max(160) }))
      .max(100)
      .optional(),
    origin: z.enum(["normal", "offline-synced"]).default("normal"),
    clientOpId: z.string().max(64).nullable().optional(),
  })
  .strict();

export type SaveRevisionInput = z.infer<typeof saveRevisionSchema>;

export const confirmSchema = z
  .object({
    confirmed: z.boolean(),
  })
  .strict();

export type DiagramSummaryDto = {
  id: string;
  kind: DiagramKind;
  variant: DiagramVariant;
  title: string;
  description: string | null;
  subject: FpcSubject | null;
  distanceUnit: string | null;
  status: DiagramStatus;
  currentRev: number;
  variantOfId: string | null;
  createdBy: string;
  createdByName?: string | null;
  createdAt: string;
  updatedAt: string;
  revisionCount?: number;
};

export type DiagramDetailDto = DiagramSummaryDto & {
  doc: DiagramDoc;
  layout: { positions: Record<string, { x: number; y: number }> };
  validation: {
    valid: boolean;
    errorCount: number;
    warningCount: number;
    summary: { counts: Record<string, number>; totalTimeSec: number; totalDistanceM: number; nodeCount: number; edgeCount: number };
  };
};

export type DiagramRevisionDto = {
  id: string;
  revNo: number;
  reason: string | null;
  origin: string;
  clientOpId: string | null;
  appliedSuggestions: Array<{ id: string; version: string; title: string }>;
  createdByName: string | null;
  createdAt: string;
};
