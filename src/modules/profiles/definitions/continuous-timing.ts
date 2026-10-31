/**
 * پروفایل «زمان‌سنجی پیوسته» — ثبت قرائت‌های متوالی و کنترل سازگاری جمع عناصر با چرخه.
 *
 * منبع مشخصات: docs/PROFILES.md §۴٫۱
 * فرمول‌های ارجاع‌شده: docs/FORMULA_CATALOG.md
 * (فرمول‌های پروفایل پیش‌فرض + TS-003 تفکیک قرائت متوالی، TS-004 زمان چرخه مشاهده‌شده و TS-005 تلورانس جمع عناصر)
 * این فایل صرفاً داده است (بدون عارضه جانبی).
 */

import type { ProfileDefinition } from "@/modules/profiles/domain/profile";

export const continuousTiming = {
  id: "profile.continuous-timing",
  semver: "1.1.0",
  nameFa: "زمان‌سنجی پیوسته",
  description:
    "روش ثبت پیوسته کرنومتر: عقربه در طول چرخه متوقف نمی‌شود و قرائت هر مرز عنصر به‌ترتیب ثبت می‌شود؛ تفکیک مدت عناصر پس از ثبت با تفاضل قرائت‌های متوالی انجام می‌گیرد. قاعده اعتبارسنجی «جمع عناصر = مدت چرخه ± تلورانس» سازگاری ثبت هر چرخه را کنترل می‌کند.",
  scopeOfUse:
    "مطالعات زمان چرخه‌ای که پوشش کامل چرخه و کنترل سازگاری جمع عناصر در آنها اهمیت دارد؛ برای کارهایی با عناصر متوسط و بلند مناسب‌تر است.",
  source: {
    type: "common-practice",
    name: "Stopwatch Continuous Timing — ثبت پیوسته کرنومتری (هم‌راستا با ILO/REFA، استناد مفهومی)",
    version: "روش رایج — بدون نسخه استاندارد واحد",
  },
  assumptions: [
    "کرنومتر در طول چرخه متوقف نمی‌شود و قرائت در مرز هر عنصر ثبت می‌شود؛ تفکیک مدت‌ها پس از ثبت انجام می‌گیرد.",
    "قرائت شروع چرخه (r₀) مبنای تفکیک عناصر است و جاافتادن آن، تفکیک چرخه را نامعتبر می‌کند.",
    "جمع مدت عناصر باید با مدت چرخه در حد تلورانس سازگار باشد؛ ناسازگاری بیش از حد، چرخه را به «نیازمند بررسی» تنزل می‌دهد.",
  ],
  limitations: [
    "ثبت عناصر بسیار کوتاه به مهارت و زمان واکنش ناظر وابسته است؛ خطای تعویق قرائت در عناصر کوتاه معنادار می‌شود.",
    "کنترل تلورانس فقط ناسازگاری عددی را علامت می‌دهد و جای بررسی علّی ناسازگاری (وقفه ثبت‌نشده، قرائت جاافتاده) را نمی‌گیرد.",
    "دقت ثبت محدود به رفتار مرورگر/دستگاه است (ADR-004).",
  ],
  licenseNote:
    "روش متعارف زمان‌سنجی پیوسته — استناد مفهومی به متون ILO/REFA؛ نه گواهی انطباق و نه بازتولید محتوای دارای حق نشر.",
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
      {
        stableKey: "tolerance.settings",
        nameFa: "کنترل سازگاری ثبت",
        description:
          "قاعده اعتبارسنجی فاز ۴: جمع مدت عناصر باید با مدت چرخه در حد تلورانس سازگار باشد.",
        order: 6,
        parameters: [
          {
            stableKey: "tolerance.cycleSumCheck",
            nameFa: "تلورانس کنترل جمع چرخه",
            description:
              "حداکثر انحراف مجاز نسبی بین جمع مدت عناصر و مدت چرخه؛ انحراف بیش از این مقدار، چرخه را «نیازمند بررسی» علامت می‌دهد.",
            dataType: "percent",
            analysisRole: "variable",
            defaultValue: 5,
            min: 0,
            max: 100,
            unit: "%",
            configurableOnCreate: true,
            suggestionNoteFa:
              "پیشنهاد — آستانه ±۵٪ متعارف است؛ با شرایط ثبت و دقت کرنومتر تنظیم شود؛ مقدار استاندارد جهانی نیست.",
            displayContexts: ["form", "report"],
          },
        ],
      },
    ],
    timingMethod: {
      default: "continuous",
      notesFa:
        "کرنومتر در طول چرخه متوقف نمی‌شود؛ قرائت هر مرز عنصر ثبت و تفکیک مدت‌ها پس از ثبت با تفاضل قرائت‌های متوالی (TS-003) انجام می‌شود.",
    },
    analysisChain: [
      {
        step: 1,
        nameFa: "ثبت قرائت‌های متوالی",
        descriptionFa:
          "قرائت کرنومتر در مرز هر عنصر بدون توقف ثبت می‌شود؛ قرائت شروع چرخه (r₀) مبنای تفکیک عناصر است و مدت هر عنصر پس از ثبت تفکیک می‌شود.",
        formulaRefs: ["TS-003"],
      },
      {
        step: 2,
        nameFa: "کنترل سازگاری چرخه",
        descriptionFa:
          "جمع مدت عناصر با مدت مشاهده‌شده چرخه مقایسه می‌شود؛ انحراف نسبی بیش از تلورانس (tolerance.cycleSumCheck) چرخه را «نیازمند بررسی» علامت می‌دهد.",
        formulaRefs: ["TS-004", "TS-005"],
      },
      {
        step: 3,
        nameFa: "زمان نماینده عنصر",
        descriptionFa:
          "تجمیع مشاهدات معتبر هر عنصر بر اساس پارامتر «روش تجمیع» (agg.method): میانگین، میانه یا حذف پرت‌ها بر قاعده و سپس تجمیع.",
        formulaRefs: ["TS-001", "TS-002"],
      },
      {
        step: 4,
        nameFa: "زمان نرمال عنصر",
        descriptionFa:
          "زمان نماینده در ضریب ارزیابی عملکرد ضرب می‌شود؛ فقط هنگام فعال بودن ارزیابی (rating.enabled). با ارزیابی غیرفعال، خروجی «زمان خام» نامیده می‌شود.",
        formulaRefs: ["TS-010"],
      },
      {
        step: 5,
        nameFa: "زمان استاندارد عنصر",
        descriptionFa:
          "اعمال نرخ مجاز طبق روش انتخابی: on-normal یعنی ST = NT × (1 + r) و on-standard یعنی ST = NT ÷ (1 − r)؛ دو قرارداد یکی نیستند.",
        formulaRefs: ["TS-011", "TS-012"],
      },
      {
        step: 6,
        nameFa: "زمان استاندارد چرخه",
        descriptionFa:
          "جمع زمان‌های استاندارد عناصر با مرزهای تعریف‌شده چرخه؛ هر گام خروجی CalculationResult با وضعیت، واحد، نسخه فرمول و ارجاع مشاهدات ورودی تولید می‌کند.",
      },
    ],
    formulas: [
      {
        id: "TS-001",
        nameFa: "میانگین عنصر",
        semver: "1.1.0",
        scopeLevel: "element",
        status: "active",
        descriptionFa: "میانگین حسابی مشاهدات معتبر عنصر: x̄ = Σxᵢ ÷ n — ریاضی محض.",
      },
      {
        id: "TS-002",
        nameFa: "میانه عنصر",
        semver: "1.1.0",
        scopeLevel: "element",
        status: "active",
        descriptionFa: "مقدار میانه مشاهدات مرتب‌شده عنصر؛ نیازمند حداقل یک مشاهده معتبر — ریاضی محض.",
      },
      {
        id: "TS-003",
        nameFa: "تفکیک قرائت پیوسته",
        semver: "1.1.0",
        scopeLevel: "observation",
        status: "active",
        descriptionFa:
          "تفکیک مدت هر عنصر از تفاضل قرائت‌های متوالی: dᵢ = rᵢ − rᵢ₋₁ با r₀ = شروع چرخه — مرجع (زمان‌سنجی پیوسته).",
      },
      {
        id: "TS-004",
        nameFa: "زمان چرخه مشاهده‌شده",
        semver: "1.1.0",
        scopeLevel: "cycle",
        status: "active",
        descriptionFa:
          "زمان چرخه مشاهده‌شده از جمع عناصر در مرزهای تعریف‌شده چرخه — مرجع.",
      },
      {
        id: "TS-005",
        nameFa: "تلورانس جمع عناصر",
        semver: "1.1.0",
        scopeLevel: "cycle",
        status: "active",
        descriptionFa:
          "کنترل کیفیت ثبت: |Σdᵢ − C| ÷ C ≤ τ با تلورانس پیش‌فرض ±۵٪ ویرایش‌پذیر؛ فقط حالت پیوسته — تعریف محصول.",
      },
      {
        id: "TS-010",
        nameFa: "زمان نرمال عنصر",
        semver: "1.1.0",
        scopeLevel: "element",
        status: "active",
        descriptionFa:
          "زمان نرمال عنصر: NT = RT × (RF ÷ 100)؛ ۱۰۰٪ معادل ضریب ۱٫۰ — مرجع (ILO مفهومی).",
      },
      {
        id: "TS-011",
        nameFa: "زمان استاندارد (مجاز on-normal)",
        semver: "1.1.0",
        scopeLevel: "element",
        status: "active",
        descriptionFa:
          "زمان استاندارد با مجاز بر مبنای درصد از زمان نرمال: ST = NT × (1 + r)؛ نرخ مجاز پیشنهادی و ویرایش‌پذیر — روش رایج.",
      },
      {
        id: "TS-012",
        nameFa: "زمان استاندارد (مجاز on-standard)",
        semver: "1.1.0",
        scopeLevel: "element",
        status: "active",
        descriptionFa:
          "زمان استاندارد با مجاز بر مبنای درصد از زمان استاندارد: ST = NT ÷ (1 − r)؛ با قرارداد on-normal یکی نیست — روش رایج.",
      },
      {
        id: "ST-001",
        nameFa: "انحراف معیار نمونه",
        semver: "1.1.0",
        scopeLevel: "element",
        status: "active",
        descriptionFa: "انحراف معیار نمونه با مخرج n−1 — ریاضی محض.",
      },
      {
        id: "ST-002",
        nameFa: "ضریب تغییرات",
        semver: "1.1.0",
        scopeLevel: "element",
        status: "active",
        descriptionFa: "ضریب تغییرات: CV = s ÷ x̄؛ نسبت با نمایش درصدی — ریاضی محض.",
      },
      {
        id: "ST-010",
        nameFa: "کفایت نمونه (تقریب نرمال)",
        semver: "1.1.0",
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
        descriptionFa: "جمع‌بندی جلسات، عناصر، تعداد مشاهدات و تنظیمات اثرگذار (روش تجمیع، ارزیابی، مجاز، تلورانس).",
      },
      {
        id: "report.raw-observations",
        nameFa: "جدول مشاهدات خام",
        descriptionFa: "قرائت‌های متوالی و مدت‌های تفکیک‌شده هر عنصر با شماره چرخه، وقفه/علت و وضعیت اعتبار چرخه.",
      },
      {
        id: "report.element-analysis",
        nameFa: "تحلیل عنصر",
        descriptionFa: "آمار هر عنصر به‌همراه زنجیره زمان نماینده ← نرمال ← استاندارد.",
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
