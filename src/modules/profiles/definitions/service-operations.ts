/**
 * پروفایل «عملیات خدماتی و اداری (غیرتولیدی)» — همان هسته مطالعه زمان با واحدهای غیرتولیدی.
 *
 * منبع مشخصات: docs/PROFILES.md §۴٫۶
 * واحد اندازه‌گیری غیرزمانی (تعداد پرونده/مشتری/…)؛ فرمول‌های تولیدی (مجاز/تاکت) فقط با
 * فعال نگه‌داشتن خانواده‌های مربوط اعمال می‌شوند و در ایجاد پروژه قابل حذف‌اند.
 * این فایل صرفاً داده است (بدون عارضه جانبی).
 */

import type { ProfileDefinition } from "@/modules/profiles/domain/profile";

export const serviceOperations = {
  id: "profile.service-operations",
  semver: "1.0.0",
  nameFa: "عملیات خدماتی و اداری (غیرتولیدی)",
  description:
    "همان هسته مطالعه زمان برای واحدهای غیرتولیدی با واحد شمارش خدمت (پرونده/مشتری/درخواست/…): ثبت مشاهدات، تجمیع و شاخص‌های کیفیت نمونه. فرمول‌های تولیدی (مجاز و تاکت) فقط با فعال نگه‌داشتن خانواده‌های مربوط اعمال می‌شوند و قابل غیرفعال‌سازی‌اند.",
  scopeOfUse:
    "وظایف تکرارپذیر خدماتی/اداری مانند پردازش پرونده، میز خدمت و مرکز تماس؛ برای کارهای کاملاً غیرتکراری مناسب نیست.",
  source: {
    type: "common-practice",
    name: "Work Measurement for Service/Clerical Operations — هسته روش‌شناختی مشترک با واحدهای غیرتولیدی (استناد مفهومی ILO)",
    version: "روش رایج — بدون مرجع واحد",
  },
  assumptions: [
    "کار خدمتی به وظایف تکرارپذیر قابل تفکیک است؛ پراکندگی آن معمولاً بیش از کارهای تولیدی است.",
    "واحد شمارش خدمت پیش از ثبت مشخص و در طول مطالعه ثابت است.",
    "ضریب ارزیابی و نرخ مجاز (در صورت استفاده) به ناظر و توافق سازمان وابسته‌اند.",
  ],
  limitations: [
    "پراکندگی بالا و وقفه‌های مکرر کار خدمتی، نیازمند نمونه بزرگ‌تر یا روش‌های مکمل (نمونه‌برداری فعالیت) است — خارج از نسخه پایه.",
    "فرمول‌های تولیدی (مجاز/تاکت) برای محیط خدمتی تنظیم نشده‌اند؛ استفاده از آنها نیازمند توافق و مستندسازی سازمانی است.",
    "واحد شمارش سفارشی باید در سطح سازمان تعریف شود؛ ابزار فقط برچسب ثبت‌شده را حفظ می‌کند و اعتبارسنجی معنایی نمی‌کند.",
  ],
  licenseNote:
    "روش رایج — کاربرد هسته مطالعه زمان در واحدهای غیرتولیدی؛ فرمول‌های تولیدی (مجاز/تاکت) قابل غیرفعال‌سازی‌اند و بدون منبع سازمانی به‌عنوان استاندارد معرفی نمی‌شوند.",
  content: {
    families: [
      {
        stableKey: "study.context",
        nameFa: "زمینه خدمت",
        description:
          "زمینه بخش، نوع خدمت و کانال ارائه برای گروه‌بندی و فیلتر مشاهدات خدماتی.",
        order: 1,
        parameters: [
          {
            stableKey: "service.department",
            nameFa: "بخش",
            description: "بخش یا واحد سازمانی ارائه‌دهنده خدمت.",
            dataType: "shortText",
            analysisRole: "grouping",
            displayContexts: ["form", "table", "report"],
          },
          {
            stableKey: "service.type",
            nameFa: "نوع خدمت",
            description: "طبقه‌بندی خدمت در سطح سازمان (مثل صدور مجوز، پاسخ به استعلام، پردازش درخواست).",
            dataType: "shortText",
            analysisRole: "grouping",
            displayContexts: ["form", "table", "report"],
          },
          {
            stableKey: "service.channel",
            nameFa: "کانال ارائه خدمت",
            description: "کانالی که خدمت از طریق آن ارائه می‌شود؛ برای مقایسه بار و زمان بین کانال‌ها.",
            dataType: "singleSelect",
            analysisRole: "grouping",
            options: [
              { value: "in-person", labelFa: "حضوری" },
              { value: "phone", labelFa: "تلفنی" },
              { value: "online", labelFa: "آنلاین/الکترونیکی" },
              { value: "other", labelFa: "سایر" },
            ],
            displayContexts: ["form", "table", "report"],
          },
        ],
      },
      {
        stableKey: "service.units",
        nameFa: "واحد اندازه‌گیری خدمت",
        description:
          "واحد شمارش خروجی خدمت به‌جای/به‌همراه زمان؛ مبنای شمارش‌های ثبت‌شده و شاخص‌های توان عبور.",
        order: 2,
        parameters: [
          {
            stableKey: "service.unit",
            nameFa: "واحد شمارش خدمت",
            description: "آنچه در هر مشاهده شمارش می‌شود: پرونده، مشتری، درخواست، کار یا واحد سفارشی سازمان.",
            dataType: "singleSelect",
            analysisRole: "variable",
            required: true,
            options: [
              { value: "cases", labelFa: "پرونده" },
              { value: "customers", labelFa: "مشتری/مراجع" },
              { value: "requests", labelFa: "درخواست" },
              { value: "tasks", labelFa: "کار/وظیفه" },
              { value: "custom", labelFa: "سفارشی" },
            ],
            displayContexts: ["form", "report"],
          },
          {
            stableKey: "service.customUnitLabel",
            nameFa: "برچسب واحد سفارشی",
            description: "در صورت انتخاب واحد «سفارشی»، برچسب واحد باید در سطح سازمان تعریف و مستند شود.",
            dataType: "shortText",
            analysisRole: "input",
            displayContexts: ["form", "report"],
          },
        ],
      },
      {
        stableKey: "agg.settings",
        nameFa: "روش تجمیع",
        description: "نحوه استخراج زمان نماینده از مشاهدات معتبر هر وظیفه.",
        order: 3,
        parameters: [
          {
            stableKey: "agg.method",
            nameFa: "روش تجمیع مشاهدات",
            dataType: "singleSelect",
            analysisRole: "variable",
            defaultValue: "mean",
            options: [
              { value: "mean", labelFa: "میانگین" },
              { value: "median", labelFa: "میانه" },
              { value: "outlierRule", labelFa: "حذف پرت‌ها بر قاعده" },
            ],
            helpFa: "با پراکندگی بالای کار خدمتی، «میانه» یا «حذف پرت‌ها بر قاعده» غالباً تصویر منصفانه‌تری می‌دهد.",
            displayContexts: ["form", "report"],
          },
        ],
      },
      {
        stableKey: "rating.settings",
        nameFa: "ارزیابی عملکرد",
        description:
          "ارزیابی اختیاری عملکرد؛ بدون آن، خروجی «زمان خام» نامیده می‌شود. این خانواده در ایجاد پروژه قابل حذف است.",
        order: 4,
        optionalOnCreate: true,
        parameters: [
          {
            stableKey: "rating.enabled",
            nameFa: "فعال‌سازی ارزیابی عملکرد",
            dataType: "boolean",
            analysisRole: "variable",
            defaultValue: true,
            configurableOnCreate: true,
            displayContexts: ["form", "report"],
          },
          {
            stableKey: "rating.factor",
            nameFa: "ضریب ارزیابی عملکرد",
            dataType: "percent",
            analysisRole: "variable",
            min: 75,
            max: 125,
            defaultValue: 100,
            unit: "%",
            configurableOnCreate: true,
            suggestionNoteFa:
              "پیشنهاد — ۱۰۰٪ یعنی عملکرد متعارف؛ مقدار واقعی به ناظر و توافق سازمان وابسته است و استاندارد جهانی نیست.",
            helpFa: "۱۰۰٪ معادل ضریب ۱٫۰ است؛ دامنه راهنما ۷۵ تا ۱۲۵ در نظر گرفته شده است.",
            displayContexts: ["form", "report"],
          },
        ],
      },
      {
        stableKey: "allowance.settings",
        nameFa: "مجاز زمان",
        description:
          "خانواده تولیدی — در ایجاد پروژه قابل حذف است؛ با حذف آن، فرمول‌های زمان استاندارد (TS-011/TS-012) غیرفعال می‌شوند و خروجی در حد زمان نرمال گزارش می‌شود.",
        order: 5,
        optionalOnCreate: true,
        parameters: [
          {
            stableKey: "allowance.method",
            nameFa: "روش اعمال مجاز",
            dataType: "singleSelect",
            analysisRole: "variable",
            defaultValue: "on-normal",
            options: [
              { value: "on-normal", labelFa: "درصد از زمان نرمال (on-normal)" },
              { value: "on-standard", labelFa: "درصد از زمان استاندارد (on-standard)" },
            ],
            helpFa:
              "دو قرارداد یکی نیستند: on-normal یعنی ST = NT × (1 + r) و on-standard یعنی ST = NT ÷ (1 − r)؛ پایه درصد در گزارش صریح نمایش می‌یابد.",
            displayContexts: ["form", "report"],
          },
          {
            stableKey: "allowance.rate",
            nameFa: "نرخ مجاز زمان",
            dataType: "percent",
            analysisRole: "variable",
            min: 0,
            max: 50,
            defaultValue: 15,
            unit: "%",
            configurableOnCreate: true,
            suggestionNoteFa:
              "پیشنهاد — مقدار تولیدی؛ برای محیط خدمتی با توافق سازمان تنظیم شود؛ استاندارد جهانی نیست.",
            displayContexts: ["form", "report"],
          },
        ],
      },
      {
        stableKey: "takt.settings",
        nameFa: "تاکت و ظرفیت خدمت",
        description:
          "خانواده تولیدی — در ایجاد پروژه قابل حذف است؛ تاکت فقط برای ظرفیت‌سنجی خدمت (مقایسه تقاضا با زمان در دسترس) کاربرد دارد.",
        order: 6,
        optionalOnCreate: true,
        parameters: [
          {
            stableKey: "takt.demand",
            nameFa: "تقاضای دوره",
            description: "تعداد مورد انتظار واحد شمارش خدمت در دوره برنامه‌ریزی.",
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
              "زمان در دسترس نیروی خدمت منهای توقفات برنامه‌ریزی‌شده؛ مبنای محاسبه تاکت خدمت. واحد پایه ثانیه است.",
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
            description: "تعداد شیفت‌های فعال ارائه خدمت در دوره برنامه‌ریزی.",
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
        stableKey: "stats.settings",
        nameFa: "کیفیت نمونه",
        description: "شاخص‌های خروجی کیفیت نمونه‌گیری مشاهدات.",
        order: 7,
        parameters: [
          {
            stableKey: "stats.confidence",
            nameFa: "سطح اطمینان",
            dataType: "percent",
            analysisRole: "outputIndex",
            defaultValue: 95,
            unit: "%",
            displayContexts: ["form", "report"],
          },
          {
            stableKey: "stats.targetPrecision",
            nameFa: "دقت هدف (نسبی)",
            dataType: "percent",
            analysisRole: "outputIndex",
            defaultValue: 5,
            unit: "%",
            helpFa: "دقت نسبی بر حسب درصد میانگین؛ مبنای محاسبه کفایت نمونه (ST-010).",
            displayContexts: ["form", "report"],
          },
        ],
      },
    ],
    timingMethod: {
      default: "continuous",
      notesFa:
        "ثبت پیوسته برای وظایف خدمتی با وقفه‌های مکرر توصیه می‌شود (ثبت وقفه+علت الزامی است)؛ برای وظایف مستقل کوتاه، روش بازگشت به صفر در کارگاه پیکربندی قابل انتخاب است.",
    },
    analysisChain: [
      {
        step: 1,
        nameFa: "ثبت مشاهدات خدمت",
        descriptionFa:
          "زمان هر وظیفه به‌همراه شمارش خروجی بر حسب واحد شمارش خدمت (service.unit)، زمینه بخش/نوع خدمت/کانال و وقفه‌ها با علت ثبت می‌شود.",
      },
      {
        step: 2,
        nameFa: "زمان نماینده وظیفه",
        descriptionFa:
          "تجمیع مشاهدات معتبر هر وظیفه بر اساس پارامتر «روش تجمیع» (agg.method): میانگین، میانه یا حذف پرت‌ها بر قاعده و سپس تجمیع.",
        formulaRefs: ["TS-001", "TS-002"],
      },
      {
        step: 3,
        nameFa: "زمان نرمال وظیفه",
        descriptionFa:
          "زمان نماینده در ضریب ارزیابی ضرب می‌شود؛ فقط هنگام فعال بودن ارزیابی (rating.enabled). با ارزیابی غیرفعال، خروجی «زمان خام» نامیده می‌شود.",
        formulaRefs: ["TS-010"],
      },
      {
        step: 4,
        nameFa: "زمان استاندارد وظیفه",
        descriptionFa:
          "اعمال نرخ مجاز فقط در صورت فعال بودن خانواده «مجاز زمان»؛ با حذف آن خانواده، فرمول‌های TS-011/TS-012 غیرفعال می‌شوند و خروجی در حد زمان نرمال با برچسب وضعیت مناسب گزارش می‌شود.",
        formulaRefs: ["TS-011", "TS-012"],
      },
      {
        step: 5,
        nameFa: "ظرفیت و تاکت خدمت",
        descriptionFa:
          "در صورت فعال بودن خانواده «تاکت و ظرفیت خدمت»، تاکت از تقسیم «زمان خالص در دسترس هر شیفت × تعداد شیفت» بر تقاضا محاسبه و توان عبور خدمت گزارش می‌شود.",
        formulaRefs: ["TS-013"],
      },
      {
        step: 6,
        nameFa: "جمع وظیفه/چرخه",
        descriptionFa:
          "جمع زمان‌های وظیفه با مرزهای تعریف‌شده؛ هر گام خروجی CalculationResult با وضعیت، واحد، نسخه فرمول و ارجاع مشاهدات ورودی تولید می‌کند.",
      },
    ],
    formulas: [
      {
        id: "TS-001",
        nameFa: "میانگین عنصر",
        semver: "1.0.0",
        scopeLevel: "element",
        status: "active",
        descriptionFa: "میانگین حسابی مشاهدات معتبر وظیفه: x̄ = Σxᵢ ÷ n — ریاضی محض.",
      },
      {
        id: "TS-002",
        nameFa: "میانه عنصر",
        semver: "1.0.0",
        scopeLevel: "element",
        status: "active",
        descriptionFa: "مقدار میانه مشاهدات مرتب‌شده وظیفه؛ نیازمند حداقل یک مشاهده معتبر — ریاضی محض.",
      },
      {
        id: "TS-010",
        nameFa: "زمان نرمال عنصر",
        semver: "1.0.0",
        scopeLevel: "element",
        status: "active",
        descriptionFa:
          "زمان نرمال: NT = RT × (RF ÷ 100)؛ فقط هنگام فعال بودن ارزیابی — مرجع (ILO مفهومی).",
      },
      {
        id: "TS-011",
        nameFa: "زمان استاندارد (مجاز on-normal)",
        semver: "1.0.0",
        scopeLevel: "element",
        status: "active",
        descriptionFa:
          "زمان استاندارد با مجاز on-normal: ST = NT × (1 + r) — در این پروفایل با حذف خانواده «مجاز زمان» قابل غیرفعال‌سازی است.",
      },
      {
        id: "TS-012",
        nameFa: "زمان استاندارد (مجاز on-standard)",
        semver: "1.0.0",
        scopeLevel: "element",
        status: "active",
        descriptionFa:
          "زمان استاندارد با مجاز on-standard: ST = NT ÷ (1 − r)؛ با قرارداد on-normal یکی نیست — در این پروفایل با حذف خانواده «مجاز زمان» قابل غیرفعال‌سازی است.",
      },
      {
        id: "TS-013",
        nameFa: "تاکت‌تایم",
        semver: "1.0.0",
        scopeLevel: "project",
        status: "active",
        descriptionFa:
          "تاکت: TT = زمان خالص در دسترس ÷ تقاضا — فرمول تولیدی که در این پروفایل با حذف خانواده «تاکت و ظرفیت خدمت» قابل غیرفعال‌سازی است.",
      },
      {
        id: "ST-001",
        nameFa: "انحراف معیار نمونه",
        semver: "1.0.0",
        scopeLevel: "element",
        status: "active",
        descriptionFa: "انحراف معیار نمونه با مخرج n−1 — ریاضی محض.",
      },
      {
        id: "ST-002",
        nameFa: "ضریب تغییرات",
        semver: "1.0.0",
        scopeLevel: "element",
        status: "active",
        descriptionFa: "ضریب تغییرات: CV = s ÷ x̄؛ نسبت با نمایش درصدی — ریاضی محض.",
      },
      {
        id: "ST-010",
        nameFa: "کفایت نمونه (تقریب نرمال)",
        semver: "1.0.0",
        scopeLevel: "element",
        status: "active",
        descriptionFa:
          "کفایت نمونه: n_req = (z·CV ÷ e)²؛ با پراکندگی بالای کار خدمتی، پیگیری «نیازمند مشاهده بیشتر» اهمیت ویژه دارد — آمار استاندارد.",
      },
    ],
    reportTemplates: [
      {
        id: "report.study-summary",
        nameFa: "خلاصه مطالعه",
        descriptionFa: "جمع‌بندی جلسات، وظایف، تعداد مشاهدات و واحدهای شمارش به‌همراه تنظیمات اثرگذار.",
      },
      {
        id: "report.raw-observations",
        nameFa: "جدول مشاهدات خام",
        descriptionFa: "همه مشاهدات با وظیفه، زمان، شمارش بر حسب واحد خدمت، زمینه خدمت و وقفه/علت.",
      },
      {
        id: "report.element-analysis",
        nameFa: "تحلیل وظیفه",
        descriptionFa: "آمار هر وظیفه به‌همراه زنجیره زمان نماینده ← نرمال ← استاندارد (در صورت فعال بودن مجاز).",
      },
      {
        id: "report.sample-quality",
        nameFa: "کیفیت نمونه",
        descriptionFa: "کفایت نمونه هر وظیفه در سطح اطمینان و دقت هدف، با قضاوت «کافی/نیازمند مشاهده بیشتر».",
      },
      {
        id: "report.service-throughput",
        nameFa: "گزارش توان عبور خدمت",
        descriptionFa:
          "شمارش خروجی در واحد زمان به‌تفکیک بخش/نوع خدمت/کانال و تاکت خدمت (در صورت فعال بودن خانواده «تاکت و ظرفیت خدمت»).",
      },
    ],
  },
} satisfies ProfileDefinition;
