/**
 * پروفایل پیش‌فرض «مطالعه عمومی زمان صنعتی» — هم‌راستا با اصول مطالعه کار ILO.
 *
 * منبع مشخصات: docs/PROFILES.md §۳ (پروفایل پیش‌فرض تفصیلی)
 * فرمول‌های ارجاع‌شده: docs/FORMULA_CATALOG.md (TS-001/002/010/011/012، ST-001/002/010)
 * این فایل صرفاً داده است (بدون عارضه جانبی)؛ نوع‌ها از دامنه پروفایل وارد می‌شوند.
 */

import type { ProfileDefinition } from "@/modules/profiles/domain/profile";

export const generalIndustrialTimeStudy = {
  id: "profile.general-industrial-time-study",
  semver: "1.0.0",
  nameFa: "مطالعه عمومی زمان صنعتی",
  description:
    "پروفایل پیش‌فرض برای مطالعه زمان چرخه‌ای کارهای تولیدی و غیرتولیدی با کرنومتر (دستی یا دیجیتال): تفکیک عناصر، ثبت مشاهدات، ارزیابی عملکرد اختیاری و تعیین زمان نرمال و استاندارد بر پایه مجازهای توافق‌شده سازمان. زنجیره تحلیل کامل «مشاهده‌شده ← نماینده ← نرمال ← استاندارد ← استاندارد چرخه» به‌همراه شاخص‌های کیفیت نمونه از ابتدای ایجاد پروژه فعال است.",
  scopeOfUse:
    "مطالعه زمان چرخه‌ای کارهای تکرارپذیر با کرنومتر؛ برای کارهای غیرتکراری بسیار طولانی مناسب نیست و نیازمند روش‌های نمونه‌برداری فعالیت است.",
  source: {
    type: "reference-method",
    name: "ILO — Introduction to Work Study",
    version: "4th revised edition",
    url: "https://www.ilo.org/publications/introduction-work-study-4th-revised-edition",
  },
  assumptions: [
    "کار تعریف‌شده، روش‌شده و تکرارپذیر است.",
    "اپراتور آموزش‌دیده و با روش متعارف کار می‌کند.",
    "ضریب ارزیابی عملکرد در صورت استفاده، به ناظر و توافق سازمان وابسته است.",
    "نرخ مجاز، مقدار پیشنهادی قابل ویرایش است و باید با شرایط کاری واقعی تنظیم شود.",
    "دورکاری/خواب دستگاه در جلسه، کیفیت ثبت را به «بازیابی‌شده/نیازمند بررسی» تنزل می‌دهد.",
  ],
  limitations: [
    "برای کارهای غیرتکراری بسیار طولانی، مطالعه کامل چرخه‌ای مناسب نیست (نیازمند روش‌های نمونه‌برداری فعالیت — خارج از نسخه پایه).",
    "دقت ثبت محدود به رفتار مرورگر/دستگاه است (ADR-004).",
  ],
  licenseNote:
    "هم‌راستا با اصول مطالعه کار ILO — استناد مفهومی، نه گواهی انطباق؛ متن و جدول‌های دارای حق نشر بازتولید نمی‌شوند.",
  isDefault: true,
  content: {
    families: [
      {
        stableKey: "study.context",
        nameFa: "زمینه مطالعه",
        description:
          "اطلاعات زمینه‌ای جلسه ثبت برای گروه‌بندی و فیلتر مشاهدات؛ این خانواده در ایجاد پروژه قابل حذف است.",
        order: 1,
        optionalOnCreate: true,
        parameters: [
          {
            stableKey: "study.operator",
            nameFa: "اپراتور",
            description: "نام یا کد اپراتوری که کار در جلسه مشاهده می‌شود.",
            dataType: "shortText",
            analysisRole: "grouping",
            displayContexts: ["form", "table", "report"],
          },
          {
            stableKey: "study.machine",
            nameFa: "ماشین/تجهیزات",
            description: "ماشین یا تجهیزات درگیر در ایستگاه مورد مطالعه.",
            dataType: "shortText",
            analysisRole: "grouping",
            displayContexts: ["form", "table", "report"],
          },
          {
            stableKey: "study.shift",
            nameFa: "شیفت",
            description: "شیفت جلسه ثبت؛ برای مقایسه بین شیفت‌ها.",
            dataType: "singleSelect",
            analysisRole: "grouping",
            options: [
              { value: "1", labelFa: "۱" },
              { value: "2", labelFa: "۲" },
              { value: "3", labelFa: "۳" },
              { value: "multi", labelFa: "چندشیفت" },
            ],
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
          {
            stableKey: "study.workstation",
            nameFa: "ایستگاه کاری",
            description: "محل فیزیکی/ساختاری انجام کار.",
            dataType: "shortText",
            analysisRole: "grouping",
            displayContexts: ["form", "table", "report"],
          },
        ],
      },
      {
        stableKey: "agg.settings",
        nameFa: "روش تجمیع",
        description: "نحوه استخراج زمان نماینده از مشاهدات معتبر هر عنصر.",
        order: 2,
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
            helpFa: "«حذف پرت‌ها بر قاعده» یعنی مشاهدات خارج از قاعده تعریف‌شده پروژه حذف و سپس تجمیع انجام می‌شود.",
            displayContexts: ["form", "report"],
          },
        ],
      },
      {
        stableKey: "rating.settings",
        nameFa: "ارزیابی عملکرد",
        description:
          "ارزیابی اختیاری عملکرد اپراتور؛ بدون آن، خروجی «زمان خام» نامیده می‌شود و برچسب «زمان نرمال قطعی» نمی‌گیرد.",
        order: 3,
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
          "روش و نرخ اعمال مجازهای زمان؛ نرخ پیشنهادی ویرایش‌پذیر است، نه استاندارد جهانی.",
        order: 4,
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
            suggestionNoteFa: "پیشنهاد — تنظیم با شرایط کاری؛ مقدار استاندارد جهانی نیست",
            displayContexts: ["form", "report"],
          },
        ],
      },
      {
        stableKey: "stats.settings",
        nameFa: "کیفیت نمونه",
        description: "شاخص‌های خروجی کیفیت نمونه‌گیری مشاهدات.",
        order: 5,
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
        "روش ثبت پیش‌فرض پیوسته است؛ روش بازگشت به صفر در پروفایل‌های اختصاصی و در کارگاه پیکربندی قابل انتخاب است.",
    },
    analysisChain: [
      {
        step: 1,
        nameFa: "زمان مشاهده‌شده",
        descriptionFa:
          "مدت هر عنصر در هر چرخه ثبت می‌شود (فرم مشاهده: عنصر جاری، شماره چرخه، قرائت/مدت، ضریب ارزیابی اختیاری، وقفه با علت و یادداشت).",
      },
      {
        step: 2,
        nameFa: "زمان نماینده عنصر",
        descriptionFa:
          "تجمیع مشاهدات معتبر هر عنصر بر اساس پارامتر «روش تجمیع» (agg.method): میانگین، میانه یا حذف پرت‌ها بر قاعده و سپس تجمیع.",
        formulaRefs: ["TS-001", "TS-002"],
      },
      {
        step: 3,
        nameFa: "زمان نرمال عنصر",
        descriptionFa:
          "زمان نماینده در ضریب ارزیابی عملکرد ضرب می‌شود؛ فقط هنگام فعال بودن ارزیابی (rating.enabled). با ارزیابی غیرفعال، خروجی «زمان خام» نامیده می‌شود و برچسب «زمان نرمال قطعی» نمی‌گیرد.",
        formulaRefs: ["TS-010"],
      },
      {
        step: 4,
        nameFa: "زمان استاندارد عنصر",
        descriptionFa:
          "اعمال نرخ مجاز طبق روش انتخابی: on-normal یعنی ST = NT × (1 + r) و on-standard یعنی ST = NT ÷ (1 − r). دو قرارداد یکی نیستند و پایه درصد در گزارش صریح نمایش می‌یابد.",
        formulaRefs: ["TS-011", "TS-012"],
      },
      {
        step: 5,
        nameFa: "زمان استاندارد چرخه",
        descriptionFa:
          "جمع زمان‌های استاندارد عناصر با مرزهای تعریف‌شده چرخه؛ هر گام خروجی CalculationResult با وضعیت معتبر/ناقص، واحد، نسخه فرمول و ارجاع مشاهدات ورودی تولید می‌کند.",
      },
    ],
    formulas: [
      {
        id: "TS-001",
        nameFa: "میانگین عنصر",
        semver: "1.0.0",
        scopeLevel: "element",
        status: "active",
        descriptionFa: "میانگین حسابی مشاهدات معتبر عنصر: x̄ = Σxᵢ ÷ n — ریاضی محض.",
      },
      {
        id: "TS-002",
        nameFa: "میانه عنصر",
        semver: "1.0.0",
        scopeLevel: "element",
        status: "active",
        descriptionFa: "مقدار میانه مشاهدات مرتب‌شده عنصر؛ نیازمند حداقل یک مشاهده معتبر — ریاضی محض.",
      },
      {
        id: "TS-010",
        nameFa: "زمان نرمال عنصر",
        semver: "1.0.0",
        scopeLevel: "element",
        status: "active",
        descriptionFa:
          "زمان نرمال عنصر: NT = RT × (RF ÷ 100)؛ ۱۰۰٪ معادل ضریب ۱٫۰ — مرجع (ILO مفهومی). بدون ارزیابی، خروجی «زمان خام» با برچسب ناقص است.",
      },
      {
        id: "TS-011",
        nameFa: "زمان استاندارد (مجاز on-normal)",
        semver: "1.0.0",
        scopeLevel: "element",
        status: "active",
        descriptionFa:
          "زمان استاندارد با مجاز بر مبنای درصد از زمان نرمال: ST = NT × (1 + r)؛ نرخ مجاز پیشنهادی و ویرایش‌پذیر — روش رایج.",
      },
      {
        id: "TS-012",
        nameFa: "زمان استاندارد (مجاز on-standard)",
        semver: "1.0.0",
        scopeLevel: "element",
        status: "active",
        descriptionFa:
          "زمان استاندارد با مجاز بر مبنای درصد از زمان استاندارد: ST = NT ÷ (1 − r)؛ با قرارداد on-normal یکی نیست — روش رایج.",
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
          "کفایت نمونه: n_req = (z·CV ÷ e)²؛ جهت قضاوت «کافی/نیازمند مشاهده بیشتر» — نه سقف قطعی — آمار استاندارد.",
      },
    ],
    reportTemplates: [
      {
        id: "report.study-summary",
        nameFa: "خلاصه مطالعه",
        descriptionFa: "جمع‌بندی جلسات، عناصر، تعداد مشاهدات و تنظیمات اثرگذار (روش تجمیع، ارزیابی، مجاز).",
      },
      {
        id: "report.raw-observations",
        nameFa: "جدول مشاهدات خام",
        descriptionFa: "همه مشاهدات ثبت‌شده با عنصر، چرخه، مدت، ضریب ارزیابی، وقفه/علت و وضعیت اعتبار.",
      },
      {
        id: "report.element-analysis",
        nameFa: "تحلیل عنصر",
        descriptionFa: "آمار هر عنصر (میانگین، میانه، پراکندگی) به‌همراه زنجیره زمان نماینده ← نرمال ← استاندارد.",
      },
      {
        id: "report.sample-quality",
        nameFa: "کیفیت نمونه",
        descriptionFa: "کفایت نمونه هر عنصر در سطح اطمینان و دقت هدف، با قضاوت «کافی/نیازمند مشاهده بیشتر».",
      },
      {
        id: "report.standard-time",
        nameFa: "گزارش زمان استاندارد",
        descriptionFa: "زمان استاندارد عناصر و چرخه با نمایش فرمول، نسخه فرمول و ضرایب به‌کاررفته.",
      },
    ],
  },
} satisfies ProfileDefinition;
