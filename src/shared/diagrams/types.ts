/**
 * هسته مشترک خالص مدل نمودار OPC/FPC (فاز ۳ — ADR-007 / ENGINE_CONTRACTS §۲).
 *
 * قواعد قرارداد:
 *  ۱. نمادها از فهرست بسته انتخاب می‌شوند (OPC: عملیات/بازرسی/ورود جزء/نقطه مونتاژ؛
 *     FPC: عملیات/حمل/بازرسی/تأخیر/انبارش) — واژه‌نامه در docs/DIAGRAM_GUIDE_FA.md.
 *  ۲. هر گره حداکثر یک activityRef (stableKey فعالیت پروژه) دارد — ارجاع، نه کپی.
 *  ۳. مدل معنایی (DiagramDoc) از چیدمان (DiagramLayout) جدا است؛ اعتبارسنجی مستقل از چیدمان.
 *  ۴. جهت منطقی جریان مستقل از RTL صفحه تعیین می‌شود (پیکان همیشه مبدأ→مقصد).
 *  ۵. خالص و قطعی: بدون DOM/DB/زمان سیستم — آزمون‌پذیر (الگوی ADR-011 هسته فرمول).
 */

// ─────────────────────── نمادها (فهرست بسته) ───────────────────────

/** نمادهای OPC — نمودار عملیات فرایند (توالی مونتاژ/عملیات/بازرسی + ورود اجزا) */
export const OPC_SYMBOLS = ["operation", "inspection", "componentEntry", "assemblyPoint"] as const;
export type OpcSymbol = (typeof OPC_SYMBOLS)[number];

/** نمادهای FPC — نمودار جریان فرایند (میراث پنج‌نمادی ASME/Grimshaw) */
export const FPC_SYMBOLS = ["operation", "transport", "inspection", "delay", "storage"] as const;
export type FpcSymbol = (typeof FPC_SYMBOLS)[number];

export type DiagramSymbol = OpcSymbol | FpcSymbol;

export type DiagramKind = "opc" | "fpc";
export type DiagramVariant = "current" | "proposed";
export type FpcSubject = "material" | "person" | "equipment";

export const OPC_SYMBOL_LABELS_FA: Record<OpcSymbol, string> = {
  operation: "عملیات",
  inspection: "بازرسی",
  componentEntry: "ورود جزء",
  assemblyPoint: "نقطه مونتاژ",
};

export const FPC_SYMBOL_LABELS_FA: Record<FpcSymbol, string> = {
  operation: "عملیات",
  transport: "حمل",
  inspection: "بازرسی",
  delay: "تأخیر",
  storage: "انبارش",
};

export const FPC_SUBJECT_LABELS_FA: Record<FpcSubject, string> = {
  material: "ماده",
  person: "فرد",
  equipment: "تجهیزات",
};

export function symbolLabelFa(kind: DiagramKind, symbol: DiagramSymbol): string {
  return kind === "opc"
    ? OPC_SYMBOL_LABELS_FA[symbol as OpcSymbol] ?? symbol
    : FPC_SYMBOL_LABELS_FA[symbol as FpcSymbol] ?? symbol;
}

export function isOpcSymbol(v: unknown): v is OpcSymbol {
  return typeof v === "string" && (OPC_SYMBOLS as readonly string[]).includes(v);
}

export function isFpcSymbol(v: unknown): v is FpcSymbol {
  return typeof v === "string" && (FPC_SYMBOLS as readonly string[]).includes(v);
}

export function isDiagramSymbolFor(kind: DiagramKind, v: unknown): v is DiagramSymbol {
  return kind === "opc" ? isOpcSymbol(v) : isFpcSymbol(v);
}

// ─────────────────────── گره و یال ───────────────────────

export interface DiagramNode {
  /** شناسه یکتا در سند (مثل n1) — شناسه تکراری خطای اعتبارسنجی است */
  id: string;
  /** شماره گام (نمایش/مرتب‌سازی — ناسازگاری با توالی هشدار است) */
  stepNo: number | null;
  symbol: DiagramSymbol;
  title: string;
  description?: string;
  /** زمان گام بر حسب ثانیه (SI) — نمایش تبدیلی لایه UI است */
  timeSec?: number | null;
  /** مسافت گام بر حسب متر — عمدتاً حمل FPC */
  distanceM?: number | null;
  /** OPC — کمیت/تعداد */
  quantity?: number | null;
  /** FPC — مکان/مبدأ/مقصد */
  location?: string | null;
  origin?: string | null;
  destination?: string | null;
  /** OPC componentEntry — نام جزء/منبع ورودی */
  sourceRef?: string | null;
  /** یادداشت آزاد */
  note?: string | null;
  /** رنگ برچسب سفارشی (کلید پالت) */
  colorKey?: string | null;
  /** ارجاع به فعالیت پروژه (stableKey) — حداکثر یک ارجاع، بدون کپی داده */
  activityStableKey?: string | null;
  /** ویژگی‌های سفارشی سبک برای نمایش */
  customAttrs?: Array<{ key: string; value: string }> | null;
}

export interface DiagramEdge {
  id: string;
  from: string;
  to: string;
  label?: string | null;
}

// ─────────────────────── سند معنایی ───────────────────────

export interface DiagramDoc {
  kind: DiagramKind;
  variant: DiagramVariant;
  /** فقط FPC — موضوع مطالعه الزامی است */
  subject?: FpcSubject | null;
  /** واحد مسافت نمایشی (پیش‌فرض m) — ذخیره بر حسب متر است */
  distanceUnit?: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

// ─────────────────────── چیدمان (جدا از مدل معنایی) ───────────────────────

export interface Point {
  x: number;
  y: number;
}

/** مختصات گره‌ها — مالک: لایه نمایش/ویرایشگر؛ اعتبارسنجی به آن وابسته نیست */
export interface DiagramLayout {
  positions: Record<string, Point>;
}

// ─────────────────────── ساخت سند خالی/گام جدید ───────────────────────

export function emptyDoc(kind: DiagramKind, variant: DiagramVariant = "current"): DiagramDoc {
  return kind === "fpc"
    ? { kind, variant, subject: null, distanceUnit: "m", nodes: [], edges: [] }
    : { kind, variant, nodes: [], edges: [] };
}

let idCounter = 0;
/** شناسه گره موقتِ قطعی برای آزمون — در UI با uuid جایگزین می‌شود */
export function nextNodeId(prefix = "n"): string {
  idCounter += 1;
  return `${prefix}${idCounter}`;
}

/** حالت معتبر پایه گام جدید (خنثی) — اعتبارسنجی کامل با validateDiagram */
export function makeNode(kind: DiagramKind, id: string, symbol: DiagramSymbol, title: string): DiagramNode {
  return kind === "fpc"
    ? { id, stepNo: null, symbol, title, timeSec: null, distanceM: null, location: null, origin: null, destination: null }
    : { id, stepNo: null, symbol, title, timeSec: null, quantity: null, sourceRef: null };
}

// ─────────────────────── سقف‌های ایمنی ───────────────────────

export const DIAGRAM_LIMITS = {
  maxNodes: 400,
  maxEdges: 600,
  maxTitleLen: 120,
  maxDescriptionLen: 2000,
  maxCustomAttrs: 20,
} as const;
