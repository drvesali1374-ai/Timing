/**
 * موتور قواعد پیشنهاد دستیار (B7 سناریوهای ۳-۶ + کنترل‌های الزامی).
 * خالص و قطعی — لایه الف (بدون مدل زبانی).
 *
 * کنترل‌های الزامی (B7):
 *  - هیچ پیشنهادی خودکار اعمال نمی‌شود؛ همه پیشنهادها pending می‌مانند تا تصمیم کاربر.
 *  - هر پیشنهاد شناسه قطعی + نسخه موتور دارد (ردیابی).
 *  - پیشنهادهای بهبود نوع «فرضیه» هستند و صریح برچسب می‌خورند.
 */

import type { DiagramDoc, DiagramNode } from "@/shared/diagrams/types";
import { symbolLabelFa } from "@/shared/diagrams/types";
import { validateDiagram, type DiagramValidationContext } from "@/shared/diagrams/validation";

export const ASSISTANT_ENGINE_VERSION = "1.0.0";

export type SuggestionKind = "improvement" | "fix" | "hypothesis" | "question";

export interface AssistantSuggestion {
  /** شناسه قطعی: قاعده + گره — ردیابی و جلوگیری از تکرار */
  id: string;
  ruleId: string;
  engineVersion: string;
  kind: SuggestionKind;
  severity: "info" | "warning";
  nodeId?: string;
  /** پیام پیشنهاد */
  messageFa: string;
  /** علت/دلیل — همیشه همراه منبع محلی */
  reasonFa: string;
  /** ارجاع منبع محلی (کتابخانه دانش/کاتالوگ) */
  sourceRef: string;
  /** وضعیت تصمیم کاربر — پیشنهاد هرگز خودکار اعمال نمی‌شود */
  status: "pending" | "accepted" | "rejected" | "edited";
}

/**
 * تحلیل نمودار و تولید پیشنهادها — قطعی.
 * منبع پیشنهادها: قواعد اعتبارسنجی + قواعد بهبود (کتابخانه دانش).
 */
export function analyzeDiagram(doc: DiagramDoc, ctx: DiagramValidationContext = {}): AssistantSuggestion[] {
  const out: AssistantSuggestion[] = [];
  const report = validateDiagram(doc, ctx);

  const push = (s: Omit<AssistantSuggestion, "engineVersion" | "status">) => {
    out.push({ ...s, engineVersion: ASSISTANT_ENGINE_VERSION, status: "pending" });
  };

  // ── قواعد اصلاح (از هشدارهای اعتبارسنجی) ──
  for (const w of report.warnings) {
    const node = doc.nodes.find((n) => n.id === w.nodeId);
    switch (w.code) {
      case "unconnected":
        push({
          id: `fix-conn-${w.nodeId}`,
          ruleId: "R-CONN-1",
          kind: "fix",
          severity: "warning",
          nodeId: w.nodeId,
          messageFa: `گام «${node?.title ?? "—"}» به جریان متصل نیست — اتصال آن به گام قبل/بعد را بررسی کنید.`,
          reasonFa: "گام بدون اتصال در توالی جریان شرکت نمی‌کند و خلاصه/مقایسه روش‌ها آن را کامل منعکس نمی‌کند.",
          sourceRef: "کتابخانه دانش — قاعده «توالی» (guide.sequence)",
        });
        break;
      case "no-time":
        push({
          id: `fix-time-${w.nodeId}`,
          ruleId: "R-TIME-1",
          kind: "question",
          severity: "info",
          nodeId: w.nodeId,
          messageFa: `گام «${node?.title ?? "—"}» زمان ندارد — زمان (حتی برآوردی با برچسب منبع) ثبت کنید.`,
          reasonFa: "بدون زمان گام‌ها، مجموع زمان جریان و مقایسه روش‌ها ناقص است.",
          sourceRef: "کتابخانه دانش — قاعده «واحد زمان» (guide.time-unit)",
        });
        break;
      case "no-distance":
        push({
          id: `fix-dist-${w.nodeId}`,
          ruleId: "R-DIST-1",
          kind: "fix",
          severity: "warning",
          nodeId: w.nodeId,
          messageFa: `گام حمل «${node?.title ?? "—"}» مسافت ندارد — مسافت را ثبت کنید.`,
          reasonFa: "مجموع مسافت جریان بدون مسافت حمل‌ها قابل محاسبه نیست؛ تحلیل جابه‌جایی ناقص می‌ماند.",
          sourceRef: "کتابخانه دانش — قاعده «مسافت حمل» (guide.transport-distance)",
        });
        break;
      case "component-no-source":
        push({
          id: `fix-src-${w.nodeId}`,
          ruleId: "R-SRC-1",
          kind: "fix",
          severity: "info",
          nodeId: w.nodeId,
          messageFa: `ورود جزء «${node?.title ?? "—"}» نام منبع/جزء ندارد — sourceRef را تکمیل کنید.`,
          reasonFa: "در OPC، ردیابی اجزای ورودی بدون نام منبع ممکن نیست.",
          sourceRef: "کتابخانه دانش — نماد «ورود جزء» (sym.opc.componentEntry)",
        });
        break;
      case "order-inconsistent":
        push({
          id: `fix-order-${report.warnings.indexOf(w)}`,
          ruleId: "R-ORDER-1",
          kind: "fix",
          severity: "warning",
          messageFa: w.messageFa,
          reasonFa: "ترتیب ناسازگار، توالی واقعی فرایند را مخدوش می‌کند؛ شماره‌گذاری/اتصال‌ها را بازبینی کنید.",
          sourceRef: "کتابخانه دانش — قاعده «توالی» (guide.sequence)",
        });
        break;
      default:
        break;
    }
  }

  // ── قواعد بهبود/فرضیه (فقط فرضیه — نه نتیجه قطعی) ──
  if (doc.kind === "fpc") {
    // R-HYP-1: حذف/کاهش تأخیر
    for (const node of doc.nodes) {
      if (node.symbol === "delay") {
        push({
          id: `hyp-delay-${node.id}`,
          ruleId: "R-HYP-1",
          kind: "hypothesis",
          severity: "info",
          nodeId: node.id,
          messageFa: `حذف یا کاهش تأخیر «${node.title}» در نسخه پیشنهادی قابل بررسی است — فرضیه قابل آزمون، نه نتیجه قطعی.`,
          reasonFa: `تأخیر معمولاً ارزشی نمی‌افزاید؛ ${node.note?.trim() ? `علت ثبت‌شده: «${node.note.trim().slice(0, 60)}». ` : "اما علت آن ثبت نشده و بدون دانستن علت، حذف آن فرضیه است. "}اثر واقعی باید با مشاهده/اندازه‌گیری آزموده شود.`,
          sourceRef: "کتابخانه دانش — قاعده «علت تأخیر» (guide.delay-reason) + روش‌شناسی تحلیل ارزش (m.value-analysis)",
        });
      }
    }
    // R-HYP-2: کاهش مسافت حمل
    const transports = doc.nodes.filter((n) => n.symbol === "transport");
    for (const node of transports) {
      if ((node.distanceM ?? 0) >= 20) {
        push({
          id: `hyp-dist-${node.id}`,
          ruleId: "R-HYP-2",
          kind: "hypothesis",
          severity: "info",
          nodeId: node.id,
          messageFa: `کاهش مسافت حمل «${node.title}» (${node.distanceM}m) با چیدمان/نزدیک‌سازی ایستگاه‌ها قابل بررسی است — فرضیه قابل آزمون.`,
          reasonFa: "جابه‌جایی طولانی معمولاً کاندیدای بهبود چیدمان است؛ اثر هر تغییر باید با داده واقعی سنجیده شود.",
          sourceRef: "کتابخانه دانش — روش‌شناسی تحلیل ارزش (m.value-analysis)",
        });
      }
    }
    // R-HYP-3: ادغام حمل‌های متوالی
    const order = [...doc.nodes].sort((a, b) => (a.stepNo ?? 0) - (b.stepNo ?? 0));
    for (let i = 1; i < order.length; i += 1) {
      if (order[i - 1].symbol === "transport" && order[i].symbol === "transport") {
        push({
          id: `hyp-merge-${order[i - 1].id}-${order[i].id}`,
          ruleId: "R-HYP-3",
          kind: "hypothesis",
          severity: "info",
          nodeId: order[i].id,
          messageFa: `دو حمل متوالی («${order[i - 1].title}» و «${order[i].title}») در یک مسیر قابل ادغام هستند — فرضیه قابل آزمون.`,
          reasonFa: "ادغام حمل‌های هم‌مسیر معمولاً مسافت/زمان کل را کم می‌کند؛ ابتدا هم‌مسیر بودن را با مبدأ/مقصد واقعی بررسی کنید.",
          sourceRef: "کتابخانه دانش — قاعده «مسافت حمل» (guide.transport-distance)",
        });
      }
    }
    // R-DUP-1: فعالیت تکراری (عنوان+نماد یکسان)
    const seen = new Map<string, DiagramNode>();
    for (const node of doc.nodes) {
      const key = `${node.symbol}::${node.title.trim()}`;
      if (seen.has(key)) {
        push({
          id: `dup-${node.id}`,
          ruleId: "R-DUP-1",
          kind: "question",
          severity: "warning",
          nodeId: node.id,
          messageFa: `گام «${node.title}» (${symbolLabelFa(doc.kind, node.symbol)}) تکراری است — عمدی است یا خطا؟`,
          reasonFa: "گام تکراری ممکن است خطای ثبت یا واقعاً تکرار در فرایند باشد؛ تمایز نیاز به تأیید شما دارد.",
          sourceRef: "قاعده دستیار R-DUP-1",
        });
      } else {
        seen.set(key, node);
      }
    }
    // R-CONTRA-1: حمل با مسافت صفر (اطلاعات متناقض)
    for (const node of doc.nodes) {
      if (node.symbol === "transport" && node.distanceM === 0) {
        push({
          id: `contra-zero-${node.id}`,
          ruleId: "R-CONTRA-1",
          kind: "question",
          severity: "warning",
          nodeId: node.id,
          messageFa: `حمل «${node.title}» با مسافت صفر ثبت شده — اطلاعات متناقض؛ مسافت واقعی یا نوع نماد را اصلاح کنید.`,
          reasonFa: "حمل با مسافت صفر منطقاً جابه‌جایی نیست؛ یا مسافت نادرست است یا نماد باید عملیات/انبارش باشد.",
          sourceRef: "قاعده دستیار R-CONTRA-1",
        });
      }
    }
  }

  return out;
}

/** ساخت پیشنهاد «ایجاد نسخه پیشنهادی» از روی گام‌های تأخیر (فرضیه‌های پذیرفته‌شده) */
export function proposeVariantSuggestion(doc: DiagramDoc): AssistantSuggestion | null {
  const hasDelay = doc.nodes.some((n) => n.symbol === "delay");
  const hasLongTransport = doc.nodes.some((n) => n.symbol === "transport" && (n.distanceM ?? 0) >= 20);
  if (!hasDelay && !hasLongTransport) return null;
  return {
    id: "hyp-variant-create",
    ruleId: "R-HYP-VARIANT",
    engineVersion: ASSISTANT_ENGINE_VERSION,
    kind: "hypothesis",
    severity: "info",
    messageFa: "ایجاد «نسخه پیشنهادی» جداگانه با حذف/کاهش تأخیرها و مسافت‌های طولانی قابل بررسی است.",
    reasonFa: "نسخه پیشنهادی جدا از نسخه اصلی ساخته می‌شود و تفاوت خلاصه‌ها (نمادها/زمان/مسافت) قابل مقایسه است — تصمیم نهایی با مشاهده واقعی است.",
    sourceRef: "کتابخانه دانش — قاعده «مقایسه روش‌ها» (guide.current-vs-proposed)",
    status: "pending",
  };
}
