/**
 * کتابخانه دانش محلی دستیار (B7 — لایه الف).
 * محتوای نسخه‌دار و قابل جست‌وجو که کاملاً آفلاین کار می‌کند (در بسته برنامه است).
 * منابع: ارجاع به ردیف‌های docs/STANDARDS_CATALOG.md — بدون ادعای انطباق رسمی بدون منبع.
 */

export const KNOWLEDGE_VERSION = "1.0.0";

export interface KnowledgeEntry {
  id: string;
  category: "symbol" | "glossary" | "guide" | "method" | "sample";
  titleFa: string;
  bodyFa: string;
  /** ارجاع محلی: شناسه ردیف STANDARDS_CATALOG یا سند داخلی */
  sourceRef: string;
  /** کلیدواژه‌های جست‌وجو */
  keywords: string[];
}

export const KNOWLEDGE_ENTRIES: KnowledgeEntry[] = [
  // ── نمادها ──
  {
    id: "sym.opc.operation",
    category: "symbol",
    titleFa: "نماد عملیات (OPC)",
    bodyFa:
      "در نمودار عملیات فرایند، دایر نشان‌دهنده عملیات است: تغییری عمدی در موضوع (شکل، خاصیت، مونتاژ، آماده‌سازی). هر عملیات معمولاً با شماره مرحله و توضیح کوتاه شناخته می‌شود.",
    sourceRef: "STANDARDS_CATALOG §۶ (ScienceDirect Topics «Process Chart» — میراث ASME/Grimshaw)",
    keywords: ["دایر", "عملیات", "opc", "operation"],
  },
  {
    id: "sym.opc.inspection",
    category: "symbol",
    titleFa: "نماد بازرسی (OPC)",
    bodyFa:
      "مربع نشان‌دهنده بازرسی/کنترل کیفیت است: بررسی یا آزمون موضوع بدون تغییر عمدی در آن. در OPC معمولاً روی مسیر اصلی جریان مونتاژ می‌آید.",
    sourceRef: "STANDARDS_CATALOG §۶",
    keywords: ["مربع", "بازرسی", "کنترل کیفیت", "inspection"],
  },
  {
    id: "sym.opc.componentEntry",
    category: "symbol",
    titleFa: "نماد ورود جزء (OPC)",
    bodyFa:
      "ورود اجزای تشکیل‌دهنده به جریان مونتاژ: هر جزء (ماده/قطعه) که به خط اصلی اضافه می‌شود با نام و منبع مشخص وارد نمودار می‌شود و در نقطه مونتاژ به مسیر اصلی می‌پیوندد.",
    sourceRef: "STANDARDS_CATALOG §۶",
    keywords: ["جزء", "ورود", "مونتاژ", "component"],
  },
  {
    id: "sym.opc.assemblyPoint",
    category: "symbol",
    titleFa: "نماد نقطه مونتاژ (OPC)",
    bodyFa:
      "محل اتصال/مونتاژ اجزای ورودی به جریان اصلی محصول. در سنت نمودارهای مونتاژ، این نقطه جایی است که اجزای متعدد به یک زیرمجموعه یا محصول نهایی تبدیل می‌شوند.",
    sourceRef: "STANDARDS_CATALOG §۶",
    keywords: ["مونتاژ", "اتصال", "assembly"],
  },
  {
    id: "sym.fpc.operation",
    category: "symbol",
    titleFa: "نماد عملیات (FPC)",
    bodyFa:
      "دایر: عملیاتی که موضوع مطالعه (ماده/فرد/تجهیزات) را عمداً تغییر می‌دهد. در نمودار جریان فرایند با حرف O نیز شناخته می‌شود.",
    sourceRef: "STANDARDS_CATALOG §۶ (میراث پنج‌نمادی ASME)",
    keywords: ["دایر", "عملیات", "o", "fpc"],
  },
  {
    id: "sym.fpc.transport",
    category: "symbol",
    titleFa: "نماد حمل (FPC)",
    bodyFa:
      "پیکان: جابه‌جایی موضوع از مکانی به مکان دیگر. حمل باید مسافت (و در صورت لزوم مبدأ/مقصد) داشته باشد؛ بدون مسافت، تحلیل جریان ناقص است.",
    sourceRef: "STANDARDS_CATALOG §۶",
    keywords: ["پیکان", "حمل", "جابه‌جایی", "transport", "t"],
  },
  {
    id: "sym.fpc.inspection",
    category: "symbol",
    titleFa: "نمار بازرسی (FPC)",
    bodyFa: "مربع: بررسی/آزمون موضوع بدون تغییر عمدی. با حرف I نیز شناخته می‌شود.",
    sourceRef: "STANDARDS_CATALOG §۶",
    keywords: ["مربع", "بازرسی", "i"],
  },
  {
    id: "sym.fpc.delay",
    category: "symbol",
    titleFa: "نماد تأخیر (FPC)",
    bodyFa:
      "نماد D: توقف ناخواسته موضوع بین دو فعالیت مجاز (انتظار برای صف، تجهیز، اجازه و…). تأخیر هیچ ارزشی اضافه نمی‌کند؛ علت آن باید ثبت شود تا حذف/کاهش آن قابل بررسی باشد.",
    sourceRef: "STANDARDS_CATALOG §۶",
    keywords: ["d", "تأخیر", "انتظار", "delay"],
  },
  {
    id: "sym.fpc.storage",
    category: "symbol",
    titleFa: "نماد انبارش (FPC)",
    bodyFa:
      "مثلث وارونه: نگهداری محافظت‌شده موضوع با قصد بازیابی بعدی. اگر نگهداری کنترل‌شده/مستند نباشد ممکن است تأخیر تلقی شود — تمایز را کاربر تعیین می‌کند.",
    sourceRef: "STANDARDS_CATALOG §۶",
    keywords: ["مثلث", "انبار", "انبارش", "storage", "s"],
  },

  // ── واژه‌نامه ──
  {
    id: "gl.opc",
    category: "glossary",
    titleFa: "OPC — نمودار عملیات فرایند",
    bodyFa:
      "نموداری که توالی اصلی عملیات‌ها و بازرسی‌های محصول و اجزای تشکیل‌دهنده آن را نشان می‌دهد. در منابع، اصطلاح Operation Process Chart و Outline Process Chart گاهی متفاوت به‌کار می‌روند؛ واژه‌نامه محصول OPC را به‌معنای «نمودار عملیات فرایند شامل اجزای مونتاژ» به‌کار می‌برد. هم‌معناها: Process Chart (کلی‌تر)، Outline Process Chart (خلاصه‌تر).",
    sourceRef: "STANDARDS_CATALOG §۶ + ScienceDirect Topics «Process Chart»",
    keywords: ["opc", "operation process chart", "outline", "نمودار عملیات"],
  },
  {
    id: "gl.fpc",
    category: "glossary",
    titleFa: "FPC — نمودار جریان فرایند",
    bodyFa:
      "نموداری که جزئیات حرکت و رویدادهای یک موضوع مشخص (ماده، فرد یا تجهیزات) را با نمادهای عملیات/حمل/بازرسی/تأخیر/انبارش به‌ همراه زمان و مسافت ثبت می‌کند. هم‌معناها: Process Flow Chart، Flow Process Chart، Travel Chart (برای فرد/تجهیزات).",
    sourceRef: "STANDARDS_CATALOG §۶",
    keywords: ["fpc", "flow process chart", "جریان فرایند"],
  },
  {
    id: "gl.subject",
    category: "glossary",
    titleFa: "موضوع مطالعه (FPC)",
    bodyFa:
      "چیزی که جریان آن ترسیم می‌شود: ماده (قطعه/مواد اولیه)، فرد (اپراتور) یا تجهیزات (ماشین/ابزار). تفسیر نمادها به موضوع بستگی دارد؛ مثلاً «حمل» برای فرد یعنی پیاده‌روی اپراتور.",
    sourceRef: "سند جامع B6",
    keywords: ["موضوع", "ماده", "فرد", "تجهیزات", "subject"],
  },
  {
    id: "gl.takt",
    category: "glossary",
    titleFa: "تاکت‌تایم (اشاره)",
    bodyFa:
      "زمان خالص در دسترس تولید تقسیم بر تقاضای همان بازه. با زمان چرخه یا زمان استاندارد یکسان نیست. در این فاز فقط برای اشاره مفهومی؛ محاسبه آن در ماژول بالانس (فاز ۶) است.",
    sourceRef: "سند جامع B4",
    keywords: ["تاکت", "takt"],
  },

  // ── راهنمای طراحی ──
  {
    id: "guide.sequence",
    category: "guide",
    titleFa: "قاعده توالی",
    bodyFa:
      "جریان نمودار فرایندی باید بی‌چرخه باشد؛ اگر واقعیت کار حلقه دارد (بساز مجدد)، آن را صریح با برچسب نشان دهید و ترتیب گام‌ها را بازبینی کنید.",
    sourceRef: "قاعده طراحی داخلی — DIAGRAM_GUIDE_FA §۳",
    keywords: ["چرخه", "توالی", "ترتیب"],
  },
  {
    id: "guide.transport-distance",
    category: "guide",
    titleFa: "قاعده مسافت حمل",
    bodyFa: "هر گام حمل باید مسافت داشته باشد؛ بدون آن، مجموع مسافت جریان قابل محاسبه نیست و تحلیل جابه‌جایی ناقص می‌ماند.",
    sourceRef: "قاعده طراحی داخلی — DIAGRAM_GUIDE_FA §۳",
    keywords: ["مسافت", "حمل"],
  },
  {
    id: "guide.delay-reason",
    category: "guide",
    titleFa: "قاعده علت تأخیر",
    bodyFa: "برای هر تأخیر، علت را در یادداشت ثبت کنید؛ پیشنهاد حذف تأخیر بدون دانستن علت، فرضیه است نه نتیجه.",
    sourceRef: "قاعده طراحی داخلی — DIAGRAM_GUIDE_FA §۳",
    keywords: ["تأخیر", "علت", "یادداشت"],
  },
  {
    id: "guide.time-unit",
    category: "guide",
    titleFa: "قاعده واحد زمان",
    bodyFa: "زمان گام‌ها بر مبنای ثانیه (SI) ذخیره می‌شود؛ نمایش دقیقه/ساعت تبدیل نمایشی است. منبع زمان هر گام را مشخص کنید (اندازه‌گیری/برآورد/ارجاع).",
    sourceRef: "سند جامع B6 + FORMULA_CATALOG §واحدها",
    keywords: ["زمان", "واحد", "ثانیه"],
  },
  {
    id: "guide.current-vs-proposed",
    category: "guide",
    titleFa: "قاعده مقایسه روش‌ها",
    bodyFa:
      "روش موجود را در variant «فعلی» ثبت کنید؛ پیشنهادها را در variant جداگانه. تفاوت‌ها (تعداد نمادها، مسافت، زمان) به‌صورت دلتا گزارش می‌شود و بهبود فقط پس از مشاهده/اندازه‌گیری تأیید می‌شود.",
    sourceRef: "سند جامع B6 + PROFILES §۴٫۵",
    keywords: ["مقایسه", "پیشنهادی", "فعلی"],
  },

  // ── روش‌شناسی ──
  {
    id: "m.asme-symbols",
    category: "method",
    titleFa: "نمادهای پنج‌نمادی فرایندی (میراث ASME/Grimshaw)",
    bodyFa:
      "طبقه‌بندی متعارف رویدادهای نمودار جریان فرایند (عملیات/حمل/بازرسی/تأخیر/انبارش) میراث انجمن‌های مهندسی مکانیک و متون کلاسیک مطالعه کار است. استاندارد الزام‌آور واحدی برای شکل دقیق نمادها وجود ندارد؛ این محصول نمادهای متعارف را برگزیده و واژه‌نامه همراه دارد — این ارجاع مفهومی است، نه گواهی انطباق.",
    sourceRef: "STANDARDS_CATALOG §۶ — ScienceDirect Topics «Process Chart» (بازیابی ۲۰۲۶-۱۰-۲۹)",
    keywords: ["asme", "نماد", "استاندارد", "گریمشاو"],
  },
  {
    id: "m.ilo-work-study",
    category: "method",
    titleFa: "مطالعه کار ILO — چارچوب کلی",
    bodyFa:
      "چارچوب مطالعه کار (مطالعه روش و مطالعه زمان) مرجع روش‌شناختی عمومی محصول است؛ نمودار فرایندی بخشی از مطالعه روش است. نام‌گذاری «هم‌راستا با ILO» به‌معنای تأیید رسمی یا بازتولید کامل متن دارای مجوز نیست.",
    sourceRef: "STANDARDS_CATALOG §۱ — ILO Introduction to Work Study (ویراست ۴)",
    keywords: ["ilo", "مطالعه کار", "مطالعه روش"],
  },
  {
    id: "m.value-analysis",
    category: "method",
    titleFa: "تحلیل ارزش در جریان",
    bodyFa:
      "برچسب ارزش‌افزا/غیرارزش‌افزا برای هر گام فقط با تأیید صریح کاربر ثبت می‌شود؛ سیستم آن را به‌عنوان واقعیت قطعی فرض نمی‌کند. حذف تأخیر/کاهش جابه‌جایی همیشه «فرضیه قابل بررسی» است تا با مشاهده/اندازه‌گیری آزموده شود.",
    sourceRef: "سند جامع A2/B5 — منشور محصول",
    keywords: ["ارزش افزا", "فرضیه", "بهبود"],
  },
];

/** جست‌وجوی ساده متنی در کتابخانه — آفلاین، قطعی */
export function searchKnowledge(query: string): KnowledgeEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const tokens = q.split(/\s+/).filter(Boolean);
  return KNOWLEDGE_ENTRIES.filter((entry) => {
    const haystack = `${entry.titleFa}\n${entry.bodyFa}\n${entry.keywords.join(" ")}`.toLowerCase();
    return tokens.some((t) => haystack.includes(t));
  });
}
