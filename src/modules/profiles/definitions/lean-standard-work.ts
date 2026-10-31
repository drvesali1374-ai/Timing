/**
 * پروفایل «کار استاندارد و Yamazumi» — مقایسه زمان عناصر با تاکت و شاخص‌های توازن.
 *
 * منبع مشخصات: docs/PROFILES.md §۴٫۴ + docs/STANDARDS_CATALOG.md ردیف ۵
 * ورودی: زمان‌های نماینده/استاندارد عناصر + تاکت (تقاضا ÷ زمان خالص در دسترس).
 * خروجی: Yamazumi، خط تاکت و شاخص‌های توازن (LB-010…LB-030 به‌علاوه LB-001).
 * این فایل صرفاً داده است (بدون عارضه جانبی).
 */

import type { ProfileDefinition } from "@/modules/profiles/domain/profile";

export const leanStandardWork = {
  id: "profile.lean-standard-work",
  semver: "1.0.0",
  nameFa: "کار استاندارد و Yamazumi",
  description:
    "پروفایل کار استاندارد Lean: زمان‌های نماینده/استاندارد عناصر با تاکت (تقاضا ÷ زمان خالص در دسترس) مقایسه می‌شوند و توازن ایستگاه‌ها/اپراتورها با نمودار ستونی Yamazumi، خط تاکت و شاخص‌های توازن گزارش می‌شود. زمان‌ها یا از مطالعه زمان پیشین تأمین می‌شوند یا مستقیم وارد می‌شوند.",
  scopeOfUse:
    "خطوط مونتاژ و سلول‌های کاری تکرارپذیر که تقاضا و زمان در دسترس آنها برای دوره برنامه‌ریزی مشخص است.",
  source: {
    type: "common-practice",
    name: "Lean Enterprise Institute — Lexicon «Operator Balance Chart»",
    version: "Lexicon (بازیابی ۲۰۲۶-۱۰-۲۹)",
    url: "https://www.lean.org/lexicon-terms/operator-balance-chart/",
  },
  assumptions: [
    "زمان‌های نماینده/استاندارد عناصر از مطالعه زمان معتبر یا ورود مستقیم کارشناسی تأمین می‌شوند.",
    "تقاضا و زمان خالص در دسترس برای دوره برنامه‌ریزی مشخص و نسبتاً پایدارند.",
    "عناصر قابل تخصیص به ایستگاه‌ها/اپراتورها هستند و روابط تقدم رعایت می‌شود.",
  ],
  limitations: [
    "تاکت‌تایم با زمان چرخه یا زمان استاندارد یکسان نیست؛ مقایسه آنها جهت‌دار است.",
    "حداقل نظری ایستگاه‌ها کران پایین با فرض تقسیم‌پذیری کامل عناصر است؛ تخصیص عملیاتی می‌تواند بیش از آن باشد.",
    "«تعداد ایستگاه» و «تعداد نیرو در هر شیفت» دو مفهوم جداگانه‌اند و هر یک با فرض‌های خود گزارش می‌شوند (B10).",
    "نمودار ستونی Yamazumi و خط تاکت در فاز ۶ فعال می‌شود؛ در نسخه پایه شاخص‌ها جدولی گزارش می‌شوند.",
  ],
  licenseNote:
    "روش رایج Lean — LEI؛ برچسب «روش رایج» نه استاندارد رسمی؛ ارجاع به اصطلاح‌شناسی Lean با ذکر منبع، بدون ادعای انطباق.",
  content: {
    families: [
      {
        stableKey: "takt.settings",
        nameFa: "تاکت و تقاضا",
        description:
          "ورودی‌های محاسبه تاکت‌تایم (TS-013): تقاضای دوره و زمان خالص در دسترس؛ پایه برنامه‌ریزی توازن خط.",
        order: 1,
        parameters: [
          {
            stableKey: "takt.demand",
            nameFa: "تقاضای دوره",
            description: "تعداد خروجی مورد انتظار در دوره برنامه‌ریزی (محصول/واحد).",
            dataType: "integer",
            analysisRole: "variable",
            required: true,
            min: 1,
            unit: "واحد",
            displayContexts: ["form", "report"],
          },
          {
            stableKey: "takt.netAvailableTime",
            nameFa: "زمان خالص در دسترس هر شیفت",
            description:
              "زمان در دسترس منهای توقفات برنامه‌ریزی‌شده؛ مبنای محاسبه تاکت. واحد پایه ثانیه است و تبدیل نمایشی لایه UI است.",
            dataType: "decimal",
            analysisRole: "variable",
            required: true,
            min: 0,
            unit: "s",
            displayContexts: ["form", "report"],
          },
          {
            stableKey: "takt.shifts",
            nameFa: "تعداد شیفت در دوره",
            description: "تعداد شیفت‌های فعال در دوره برنامه‌ریزی؛ زمان خالص در دسترس کل از حاصل‌ضرب آن در زمان هر شیفت به‌دست می‌آید.",
            dataType: "integer",
            analysisRole: "variable",
            defaultValue: 1,
            min: 1,
            unit: "شیفت",
            configurableOnCreate: true,
            displayContexts: ["form", "report"],
          },
        ],
      },
      {
        stableKey: "lean.inputs",
        nameFa: "ورودی زمان عناصر",
        description:
          "مبنای زمان‌هایی که وارد نمودار توازن می‌شوند: زمان نماینده (پیش از مجاز) یا زمان استاندارد (با مجاز).",
        order: 2,
        parameters: [
          {
            stableKey: "lean.timeBasis",
            nameFa: "مبنای زمان عناصر",
            dataType: "singleSelect",
            analysisRole: "variable",
            defaultValue: "standard",
            options: [
              { value: "representative", labelFa: "زمان نماینده" },
              { value: "standard", labelFa: "زمان استاندارد" },
            ],
            helpFa:
              "کار استاندارد معمولاً بر زمان استاندارد بنا می‌شود؛ انتخاب «زمان نماینده» مقایسه پیش از مجاز را ممکن می‌کند و باید در گزارش صریح درج شود.",
            displayContexts: ["form", "report"],
          },
        ],
      },
      {
        stableKey: "study.context",
        nameFa: "زمینه مطالعه",
        description:
          "زمینه خط/سلول و محصول برای گروه‌بندی و مقایسه سناریوها؛ این خانواده در ایجاد پروژه قابل حذف است.",
        order: 3,
        optionalOnCreate: true,
        parameters: [
          {
            stableKey: "study.line",
            nameFa: "خط/سلول کاری",
            description: "خط یا سلولی که توازن آن مطالعه می‌شود.",
            dataType: "shortText",
            analysisRole: "grouping",
            displayContexts: ["form", "table", "report"],
          },
          {
            stableKey: "study.product",
            nameFa: "محصول/خانواده محصول",
            description: "محصول یا خانواده محصولی که تقاضا برای آن تعریف شده است.",
            dataType: "shortText",
            analysisRole: "grouping",
            displayContexts: ["form", "table", "report"],
          },
          {
            stableKey: "study.date",
            nameFa: "تاریخ مطالعه",
            dataType: "dateTime",
            analysisRole: "filter",
            defaultValue: "today",
            helpFa: "مقدار پیش‌فرض ویژه «امروز» یعنی هنگام ثبت، تاریخ جاری جلسه به‌صورت خودکار جایگزین می‌شود.",
            displayContexts: ["form", "table", "report"],
          },
        ],
      },
    ],
    analysisChain: [
      {
        step: 1,
        nameFa: "ورود زمان‌های عناصر",
        descriptionFa:
          "زمان‌های نماینده/استاندارد عناصر بر مبنای انتخابی (lean.timeBasis) از مطالعه زمان پیشین یا ورود مستقیم کارشناسی تأمین و با مرزهای چرخه تعریف می‌شوند.",
      },
      {
        step: 2,
        nameFa: "محاسبه تاکت‌تایم",
        descriptionFa:
          "تاکت از تقسیم «زمان خالص در دسترس هر شیفت × تعداد شیفت» بر تقاضای دوره به‌دست می‌آید؛ تاکت با زمان چرخه/استاندارد یکسان نیست.",
        formulaRefs: ["TS-013"],
      },
      {
        step: 3,
        nameFa: "بار هر ایستگاه",
        descriptionFa:
          "بار هر ایستگاه/اپراتور از جمع زمان عناصر تخصیص‌یافته به آن محاسبه می‌شود؛ مبنای نمودار Yamazumi و شاخص‌های توازن.",
        formulaRefs: ["LB-001"],
      },
      {
        step: 4,
        nameFa: "شاخص‌های توازن",
        descriptionFa:
          "راندمان بالانس، تأخیر بالانس، حداقل نظری ایستگاه‌ها و گلوگاه محاسبه می‌شوند؛ حداقل نظری کران پایین با فرض تقسیم‌پذیری کامل است.",
        formulaRefs: ["LB-010", "LB-011", "LB-020", "LB-022"],
      },
      {
        step: 5,
        nameFa: "بیکاری ایستگاه و نیروی نظری",
        descriptionFa:
          "زمان بیکاری هر ایستگاه روی تاکت و نیروی نظری (جمع کار دستی ÷ زمان خالص شیفت) محاسبه می‌شود؛ نیروی نظری جدا از تخصیص عملیاتی گزارش می‌شود.",
        formulaRefs: ["LB-021", "LB-030"],
      },
      {
        step: 6,
        nameFa: "خروجی Yamazumi و خط تاکت",
        descriptionFa:
          "ستون‌ها = اپراتور/ایستگاه، ارتفاع = زمان و خط تاکت روی نمودار رسم می‌شود؛ نمودار ستونی در فاز ۶ فعال می‌شود و تا آن زمان شاخص‌ها جدولی گزارش می‌شوند.",
      },
    ],
    formulas: [
      {
        id: "TS-013",
        nameFa: "تاکت‌تایم",
        semver: "1.0.0",
        scopeLevel: "project",
        status: "active",
        descriptionFa:
          "تاکت‌تایم: TT = زمان خالص در دسترس ÷ تقاضا؛ با زمان چرخه/استاندارد یکسان نیست — روش رایج (Lean).",
      },
      {
        id: "LB-001",
        nameFa: "بار ایستگاه",
        semver: "1.0.0",
        scopeLevel: "balanceScenario",
        status: "active",
        descriptionFa: "بار ایستگاه: S_k = جمع زمان عناصر تخصیص‌یافته به ایستگاه k — تعریف محصول.",
      },
      {
        id: "LB-010",
        nameFa: "راندمان بالانس",
        semver: "1.0.0",
        scopeLevel: "balanceScenario",
        status: "active",
        descriptionFa:
          "راندمان بالانس: E = ΣT ÷ (m·C_max) با m ایستگاه و C_max بیشینه بار — روش رایج.",
      },
      {
        id: "LB-011",
        nameFa: "تأخیر بالانس",
        semver: "1.0.0",
        scopeLevel: "balanceScenario",
        status: "active",
        descriptionFa: "تأخیر بالانس: d = 1 − E — روش رایج.",
      },
      {
        id: "LB-020",
        nameFa: "حداقل نظری ایستگاه‌ها",
        semver: "1.0.0",
        scopeLevel: "balanceScenario",
        status: "active",
        descriptionFa:
          "حداقل نظری ایستگاه‌ها: m_min = ⌈ΣT ÷ TT⌉؛ کران پایین با فرض تقسیم‌پذیری کامل عناصر — روش رایج.",
      },
      {
        id: "LB-021",
        nameFa: "زمان بیکاری ایستگاه",
        semver: "1.0.0",
        scopeLevel: "balanceScenario",
        status: "active",
        descriptionFa: "زمان بیکاری ایستگاه روی تاکت: I_k = TT − S_k — تعریف محصول.",
      },
      {
        id: "LB-022",
        nameFa: "گلوگاه",
        semver: "1.0.0",
        scopeLevel: "balanceScenario",
        status: "active",
        descriptionFa: "گلوگاه: ایستگاه با بیشترین بار (k* = argmax S_k) — تعریف محصول.",
      },
      {
        id: "LB-030",
        nameFa: "نیروی نظری",
        semver: "1.0.0",
        scopeLevel: "balanceScenario",
        status: "active",
        descriptionFa:
          "نیروی نظری: W_theory = ΣT_manual ÷ زمان خالص شیفت؛ جدا از «تخصیص عملیاتی» گزارش می‌شود — تعریف محصول.",
      },
    ],
    reportTemplates: [
      {
        id: "report.takt-summary",
        nameFa: "خلاصه تاکت و تقاضا",
        descriptionFa: "تقاضا، زمان خالص در دسترس، تعداد شیفت و تاکت‌تایم محاسبه‌شده با نسخه فرمول.",
      },
      {
        id: "report.yamazumi-chart",
        nameFa: "نمودار Yamazumi (بالانس اپراتور)",
        descriptionFa:
          "ستون‌های اپراتور/ایستگاه با ارتفاع زمان و خط تاکت؛ نمودار ستونی در فاز ۶ فعال می‌شود و تا آن زمان بار ایستگاه‌ها جدولی گزارش می‌شود.",
      },
      {
        id: "report.balance-indices",
        nameFa: "شاخص‌های توازن خط",
        descriptionFa:
          "راندمان بالانس، تأخیر، حداقل نظری ایستگاه‌ها، گلوگاه، بیکاری ایستگاه و نیروی نظری — هر شاخص با فرمول و فرض خودش.",
      },
    ],
  },
} satisfies ProfileDefinition;
