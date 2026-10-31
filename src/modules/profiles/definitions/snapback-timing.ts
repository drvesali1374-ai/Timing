/**
 * پروفایل «زمان‌سنجی بازگشت به صفر (عنصری)» — ثبت مستقل هر عنصر.
 *
 * منبع مشخصات: docs/PROFILES.md §۴٫۲
 * همان زنجیره فرمولی پروفایل پیش‌فرض؛ بدون کنترل جمع چرخه (به‌جای آن کنترل هم‌خوانی
 * تعداد مشاهده هر عنصر) و هشدار برای عناصر خیلی کوتاه (ذیل آستانه ۰٫۰۵ ثانیه).
 * این فایل صرفاً داده است (بدون عارضه جانبی).
 */

import type { ProfileDefinition } from "@/modules/profiles/domain/profile";

export const snapbackTiming = {
  id: "profile.snapback-timing",
  semver: "1.0.0",
  nameFa: "زمان‌سنجی بازگشت به صفر (عنصری)",
  description:
    "روش ثبت عنصری: هر عنصر به‌صورت مستقل و پس از بازگشت کرنومتر به صفر اندازه‌گیری می‌شود و مدت آن مستقیم ثبت می‌شود. به‌جای کنترل «جمع عناصر = مدت چرخه»، هم‌خوانی تعداد مشاهده هر عنصر با طرح مطالعه کنترل می‌شود و عناصر خیلی کوتاه هشدار می‌گیرند.",
  scopeOfUse:
    "کارهایی با عناصر نسبتاً بلند و مستقل؛ برای عناصر خیلی کوتاه (کوتاه‌تر از آستانه هشدار) به دلیل خطای نشست/راه‌اندازی کرنومتر توصیه نمی‌شود.",
  source: {
    type: "common-practice",
    name: "Stopwatch Snapback Timing — ثبت عنصری/بازگشت به صفر (هم‌راستا با ILO، استناد مفهومی)",
    version: "روش رایج — بدون نسخه استاندارد واحد",
  },
  assumptions: [
    "هر عنصر به‌صورت مستقل و پس از بازگشت کرنومتر به صفر اندازه‌گیری می‌شود و مدت آن مستقیم ثبت می‌شود.",
    "زمان صفر شدن و راه‌اندازی مجدد کرنومتر جزء مدت عناصر ثبت نمی‌شود؛ ثبت کامل یک چرخه کمی طولانی‌تر از روش پیوسته است.",
    "تعداد مشاهدات هر عنصر باید با طرح مطالعه هم‌خوان باشد؛ کنترل هم‌خوانی تعداد مشاهده، جایگزین کنترل جمع چرخه است.",
  ],
  limitations: [
    "عناصر خیلی کوتاه (کوتاه‌تر از آستانه هشدار) دقت ثبت پایینی دارند؛ برای آن دسته، روش پیوسته یا تجمیع چند عنصر توصیه می‌شود.",
    "کنترل سازگاری «جمع عناصر = مدت چرخه» در این پروفایل اعمال نمی‌شود؛ خطای سیستمی ثبت در جمع چرخه بی‌دیده می‌ماند.",
    "دقت ثبت محدود به رفتار مرورگر/دستگاه است (ADR-004).",
  ],
  licenseNote:
    "روش متعارف بازگشت به صفر — استناد مفهومی به متون مطالعه کار (ILO)؛ نه گواهی انطباق و نه بازتولید محتوای دارای حق نشر.",
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
        stableKey: "snapback.settings",
        nameFa: "قواعد ثبت عنصری",
        description:
          "قواعد اختصاصی ثبت بازگشت به صفر: هشدار عناصر خیلی کوتاه و کنترل هم‌خوانی تعداد مشاهده به‌جای کنترل جمع چرخه.",
        order: 6,
        parameters: [
          {
            stableKey: "snapback.minElementWarning",
            nameFa: "آستانه هشدار عنصر خیلی کوتاه",
            description:
              "عناصر کوتاه‌تر از این مقدار هنگام ثبت هشدار «خیلی کوتاه» می‌گیرند؛ خطای نشست/راه‌اندازی کرنومتر در این بازه معنادار است.",
            dataType: "decimal",
            analysisRole: "variable",
            defaultValue: 0.05,
            min: 0,
            max: 1,
            unit: "s",
            configurableOnCreate: true,
            suggestionNoteFa:
              "پیشنهاد — مرز متعارف «خیلی کوتاه» ۰٫۰۵ ثانیه است؛ با دقت ابزار ثبت تنظیم شود.",
            displayContexts: ["form", "report"],
          },
        ],
      },
    ],
    timingMethod: {
      default: "snapback",
      notesFa:
        "کرنومتر پس از هر عنصر به صفر بازمی‌گردد و مدت هر عنصر مستقیم ثبت می‌شود؛ تفکیک قرائت متوالی (TS-003) لازم نیست و کنترل تلورانس جمع (TS-005) اعمال نمی‌شود.",
    },
    analysisChain: [
      {
        step: 1,
        nameFa: "ثبت مستقل هر عنصر",
        descriptionFa:
          "هر عنصر پس از صفر شدن کرنومتر مستقیم اندازه‌گیری می‌شود؛ عناصر کوتاه‌تر از آستانه هشدار (snapback.minElementWarning) هشدار «خیلی کوتاه» می‌گیرند و به‌جای کنترل جمع چرخه، هم‌خوانی تعداد مشاهده هر عنصر با طرح مطالعه کنترل می‌شود.",
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
          "زمان نماینده در ضریب ارزیابی عملکرد ضرب می‌شود؛ فقط هنگام فعال بودن ارزیابی (rating.enabled). با ارزیابی غیرفعال، خروجی «زمان خام» نامیده می‌شود.",
        formulaRefs: ["TS-010"],
      },
      {
        step: 4,
        nameFa: "زمان استاندارد عنصر",
        descriptionFa:
          "اعمال نرخ مجاز طبق روش انتخابی: on-normal یعنی ST = NT × (1 + r) و on-standard یعنی ST = NT ÷ (1 − r)؛ دو قرارداد یکی نیستند.",
        formulaRefs: ["TS-011", "TS-012"],
      },
      {
        step: 5,
        nameFa: "زمان استاندارد چرخه",
        descriptionFa:
          "جمع زمان‌های استاندارد عناصر با مرزهای تعریف‌شده چرخه؛ به‌دلیل ثبت مستقل عناصر، کنترل تلورانس جمع چرخه (TS-005) در این پروفایل اعمال نمی‌شود.",
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
          "زمان نرمال عنصر: NT = RT × (RF ÷ 100)؛ ۱۰۰٪ معادل ضریب ۱٫۰ — مرجع (ILO مفهومی).",
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
        descriptionFa: "جمع‌بندی جلسات، عناصر، تعداد مشاهدات هر عنصر و تنظیمات اثرگذار (روش تجمیع، ارزیابی، مجاز).",
      },
      {
        id: "report.raw-observations",
        nameFa: "جدول مشاهدات خام",
        descriptionFa: "مدت‌های ثبت‌شده هر عنصر با شماره چرخه، هشدار عناصر خیلی کوتاه و وضعیت اعتبار مشاهده.",
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
