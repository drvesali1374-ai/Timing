/**
 * پارسر متن → پیش‌نویس گام‌های نمودار (بند ۸ دستور فاز ۳ — B7 سناریو ۱).
 * خالص و قطعی: قواعد واژه‌گانه فارسی + استخراج عدد/واحد؛ بدون مدل زبانی.
 * خروجی: گام‌های پیشنهادی + پرسش‌های تکمیلی (فرم هدایت‌شده) + یادداشت‌ها.
 */

import type { DiagramKind, DiagramSymbol, FpcSubject } from "@/shared/diagrams/types";

export interface DraftStep {
  symbol: DiagramSymbol;
  title: string;
  timeSec: number | null;
  distanceM: number | null;
  origin: string | null;
  destination: string | null;
  note: string | null;
  /** خط مبدأ (۱- مبنا) برای ردیابی پیشنهاد */
  sourceLine: number;
  /** کلیدواژه‌های متناقض یافت‌شده (اگر خالی نباشد، نوع قطعی نیست) */
  ambiguity: string[];
}

export interface AssistantQuestion {
  id: string;
  kind: "subject" | "step-type" | "distance" | "time" | "rephrase" | "confirm";
  messageFa: string;
  /** برای step-type: خط و عنوان */
  line?: number;
  title?: string;
  options?: string[];
}

export interface DraftResult {
  steps: DraftStep[];
  questions: AssistantQuestion[];
  notes: string[];
}

// ─────────────────────── واژه‌گانه طبقه‌بندی ───────────────────────

const KEYWORDS: Array<{ symbol: DiagramSymbol; words: string[] }> = [
  { symbol: "transport", words: ["حمل", "انتقال", "جابه‌جایی", "جابجایی", "حمل‌ونقل", "حمل و نقل", "ارسال", "برده می‌شود", "برده میشود", "می‌برد", "میبرد", "پر کردن", "تخلیه", "بارگیری"] },
  { symbol: "inspection", words: ["بازرسی", "کنترل کیفیت", "کنترل ابعاد", "بررسی", "آزمون", "تست", "سنجش", "کنترل", "معاینه", "آزمایش"] },
  { symbol: "delay", words: ["تأخیر", "تاخیر", "انتظار", "منتظر", "مکث", "صف", "بلاتکلیفی", "معطل"] },
  { symbol: "storage", words: ["انبار کردن", "انبارش", "ذخیره", "نگهداری در انبار", "موجودی انبار", "ستون انبار"] },
];

function classifyLine(text: string): { symbol: DiagramSymbol; ambiguity: string[] } {
  const hits: Array<{ symbol: DiagramSymbol; word: string; index: number }> = [];
  for (const { symbol, words } of KEYWORDS) {
    for (const w of words) {
      const i = text.indexOf(w);
      if (i >= 0) hits.push({ symbol, word: w, index: i });
    }
  }
  if (hits.length === 0) return { symbol: "operation", ambiguity: [] };
  const distinct = [...new Set(hits.map((h) => h.symbol))];
  if (distinct.length === 1) return { symbol: distinct[0], ambiguity: [] };
  // چندپهلو: اولویت حمل (جابه‌جایی صریح) > تأخیر > انبارش > بازرسی؛
  // «حمل از/به انبار» حمل است (نقطه انبارش را گام جدا نشان می‌دهد)؛ هر چندپهلو، پرسش نوع تولید می‌کند.
  const priority: DiagramSymbol[] = ["transport", "delay", "storage", "inspection"];
  const symbol = priority.find((p) => distinct.includes(p)) ?? distinct[0];
  return { symbol, ambiguity: hits.filter((h) => h.symbol !== symbol).map((h) => h.word) };
}

// ─────────────────────── استخراج عدد/واحد ───────────────────────

/** نویسه‌های فارسی/عربی → لاتین + جداکننده اعشار فارسی ٫ → نقطه */
export function normalizeDigits(input: string): string {
  const fa = "۰۱۲۳۴۵۶۷۸۹";
  const ar = "٠١٢٣٤٥٦٧٨٩";
  return input
    .replace(/[۰-۹٠-٩]/g, (ch) => {
      const i = fa.indexOf(ch);
      if (i >= 0) return String(i);
      return String(ar.indexOf(ch));
    })
    .replace(/٫/g, ".");
}

const TIME_UNITS: Array<{ re: RegExp; factor: number }> = [
  { re: /ساعت|ساعته|hours?|h\b/, factor: 3600 },
  { re: /دقیقه|دقیقه‌ای|دق|minutes?|min\b/, factor: 60 },
  { re: /ثانیه|ثانیه‌ای|seconds?|sec\b|s\b/, factor: 1 },
];

const DISTANCE_UNITS: Array<{ re: RegExp; factor: number }> = [
  { re: /کیلومتر|کیلومتری|kilometers?|km\b/, factor: 1000 },
  { re: /سانتی‌متر|سانتی متر|سانتیمتر|centimeters?|cm\b/, factor: 0.01 },
  { re: /میلی‌متر|میلی متر|میلی‌متری|millimeters?|mm\b/, factor: 0.001 },
  { re: /فوت|feet|foot|ft\b/, factor: 0.3048 },
  { re: /یارد|yard|yd\b/, factor: 0.9144 },
  { re: /متر|متری|meters?|m\b/, factor: 1 },
];

function extractQuantity(text: string, units: Array<{ re: RegExp; factor: number }>): { value: number; unitWord: string } | null {
  const norm = normalizeDigits(text);
  // الگو: عدد (اعشاری با . یا ،) + واحد
  const numRe = /(\d+(?:[.,]\d+)?)\s*/g;
  let match: RegExpExecArray | null;
  while ((match = numRe.exec(norm)) !== null) {
    const after = norm.slice(match.index + match[0].length, match.index + match[0].length + 14);
    for (const u of units) {
      const um = u.re.exec(after);
      if (um) {
        const value = Number.parseFloat(match[1].replace(",", "."));
        if (Number.isFinite(value)) {
          return { value: value * u.factor, unitWord: um[0] };
        }
      }
    }
  }
  return null;
}

/** استخراج مبدأ/مقصد حمل از الگوی «از X به Y» — قطع در جداکننده‌ها/خط تیره */
function extractOriginDestination(text: string): { origin: string | null; destination: string | null } {
  const m = text.match(/از\s+(.+?)\s+(?:به|تا|به\s+سمت)\s+([^،,.؛;—–-]+)/);
  if (!m) return { origin: null, destination: null };
  return { origin: m[1].trim().slice(0, 60), destination: m[2].trim().slice(0, 60) };
}

/** حذف شماره‌گذاری ابتدای خط: 1. 1) ۱- – و… */
function stripNumbering(line: string): string {
  return line.replace(/^\s*(?:[-*–•]|\d+[.)-]|[۰-۹]+[.)-])\s*/, "").trim();
}

// ─────────────────────── پارسر اصلی ───────────────────────

export interface ParseInput {
  kind: DiagramKind;
  text: string;
  /** موضوع مطالعه FPC — اگر نامشخص است پرسش تولید می‌شود */
  subject?: FpcSubject | null;
}

export function draftFromText(input: ParseInput): DraftResult {
  const { kind, text } = input;
  const questions: AssistantQuestion[] = [];
  const notes: string[] = [];
  const steps: DraftStep[] = [];

  const rawLines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (rawLines.length === 0) {
    questions.push({
      id: "q.rephrase",
      kind: "rephrase",
      messageFa: "متنی برای تبدیل به گام دریافت نشد. فرایند را خط‌به‌خط (هر خط یک گام) بنویسید؛ مثال: «برش ورق — ۱۲ ثانیه» یا «حمل از انبار به دستگاه — ۱۵ متر».",
    });
    return { steps, questions, notes };
  }

  if (kind === "fpc" && !input.subject) {
    questions.push({
      id: "q.subject",
      kind: "subject",
      messageFa: "موضوع مطالعه این جریان چیست؟ (تفسیر گام‌ها به آن وابسته است)",
      options: ["ماده", "فرد", "تجهیزات"],
    });
  }

  rawLines.forEach((raw, idx) => {
    const line = stripNumbering(raw);
    if (!line) return;
    const { symbol, ambiguity } = classifyLine(line);

    const time = extractQuantity(line, TIME_UNITS);
    const distance = extractQuantity(line, DISTANCE_UNITS);
    const { origin, destination } = symbol === "transport" ? extractOriginDestination(line) : { origin: null, destination: null };

    // عنوان: خط بدون بخش عدد/واحد — ساده: خط اصلی، اعداد در متا
    const title = line.slice(0, 120);

    steps.push({
      symbol,
      title,
      timeSec: time ? Math.round(time.value * 100) / 100 : null,
      distanceM: distance ? Math.round(distance.value * 1000) / 1000 : null,
      origin,
      destination,
      note: ambiguity.length > 0 ? `واژه‌های چندپهلو: ${ambiguity.join("، ")}` : null,
      sourceLine: idx + 1,
      ambiguity,
    });

    if (ambiguity.length > 0) {
      questions.push({
        id: `q.type-${idx + 1}`,
        kind: "step-type",
        line: idx + 1,
        title: title.slice(0, 60),
        messageFa: `خط ${idx + 1} («${title.slice(0, 50)}…») هم واژه «${ambiguity[0]}» و هم واژه دیگری دارد — نوع درست این گام چیست؟`,
      });
    }
    if (kind === "fpc" && symbol === "transport" && !distance) {
      questions.push({
        id: `q.dist-${idx + 1}`,
        kind: "distance",
        line: idx + 1,
        title: title.slice(0, 60),
        messageFa: `گام حمل «${title.slice(0, 50)}» مسافت ندارد — مسافت چند متر است؟`,
      });
    }
    if (!time) {
      questions.push({
        id: `q.time-${idx + 1}`,
        kind: "time",
        line: idx + 1,
        title: title.slice(0, 60),
        messageFa: `گام «${title.slice(0, 50)}» زمان ندارد — زمان تقریبی ثبت شود؟ (می‌توانید بعداً اندازه‌گیری کنید)`,
      });
    }
  });

  if (steps.length > 0) {
    notes.push(`${steps.length} گام پیشنهادی از ${rawLines.length} خط استخراج شد — این پیش‌نویس است و تا تأیید شما چیزی اعمال نمی‌شود.`);
    notes.push("طبقه‌بندی نمادها با واژه‌گانه قطعی انجام شده؛ پیش از تأیید، نوع هر گام را بازبینی کنید.");
  }

  return { steps, questions, notes };
}
