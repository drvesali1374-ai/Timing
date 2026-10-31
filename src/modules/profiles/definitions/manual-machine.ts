/**
 * پروفایل «مطالعه فعالیت دستی–ماشین» — تفکیک انواع زمان فعالیت و هم‌پوشانی.
 *
 * منبع مشخصات: docs/PROFILES.md §۴٫۳
 * مدل فعالیت با انواع زمان (B5): manual، machineAuto، waiting، overlap.
 * فرمول‌های اضافه نسبت به پروفایل پیش‌فرض: TS-020 چرخه دستی–ماشین و TS-021 نسبت بار اپراتور.
 * این فایل صرفاً داده است (بدون عارضه جانبی).
 */

import type { ProfileDefinition } from "@/modules/profiles/domain/profile";

export const manualMachine = {
  id: "profile.manual-machine",
  semver: "1.0.0",
  nameFa: "مطالعه فعالیت دستی–ماشین",
  description:
    "پروفایل مطالعه چرخه‌های ترکیبی اپراتور–ماشین با تفکیک انواع زمان فعالیت: دستی، خودکار ماشین، انتظار و هم‌پوشانی. چرخه دستی–ماشین با بیشینه کار اپراتور (با لحاظ هم‌پوشانی) و زمان خودکار ماشین محاسبه می‌شود و نسبت بار اپراتور گزارش می‌گردد.",
  scopeOfUse:
    "ایستگاه‌های کاری ترکیبی اپراتور–ماشین که کار دستی و کار خودکار ماشین هم‌پوشانی دارند یا می‌توانند داشته باشند.",
  source: {
    type: "common-practice",
    name: "Man–Machine / Multiple Activity Study — روش متعارف متون مطالعه کار (استناد مفهومی ILO؛ مدل انواع زمان B5)",
    version: "روش رایج — بدون نسخه استاندارد واحد",
  },
  assumptions: [
    "چرخه کار ترکیبی از اجزای دستی و خودکار ماشین است و الگوی هم‌پوشانی در چرخه‌ها تکرارپذیر است.",
    "زمان خودکار ماشین ارزیابی عملکرد نمی‌گیرد؛ ضریب ارزیابی فقط بر اجزای دستی اعمال می‌شود.",
    "هم‌پوشانی دستی–ماشین به‌صورت صریح در مدل فعالیت ثبت می‌شود؛ جمع کورکورانه اجزای زمان ممنوع است.",
  ],
  limitations: [
    "تغییرپذیری ترتیب یا مدت فعالیت‌های ماشین بین چرخه‌ها، دقت مدل چرخه را کاهش می‌دهد.",
    "نمودار هم‌پوشانی man-machine در فاز ۵ فعال می‌شود؛ تا آن زمان خروجی به مقادیر محاسبه‌شده و جدول گزارش محدود است.",
    "دقت ثبت محدود به رفتار مرورگر/دستگاه است (ADR-004).",
  ],
  licenseNote:
    "روش متعارف مطالعه دستی–ماشین — استناد مفهومی به متون مطالعه کار؛ فرمول‌های چرخه و نسبت بار (TS-020/TS-021) تعریف محصول‌اند و گواهی انطباق با هیچ استاندارد رسمی ادعا نمی‌شود.",
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
        description: "نحوه استخراج زمان نماینده از مشاهدات معتبر هر فعالیت.",
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
          "ارزیابی اختیاری عملکرد اپراتور؛ فقط بر اجزای دستی اعمال می‌شود و زمان خودکار ماشین ارزیابی نمی‌گیرد.",
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
        stableKey: "mm.timeTypes",
        nameFa: "انواع زمان فعالیت",
        description:
          "مدل فعالیت با انواع زمان (B5): دستی، خودکار ماشین، انتظار و هم‌پوشانی. انواع فعال، ساختار ثبت فعالیت‌ها و فرمول‌های چرخه دستی–ماشین را تعیین می‌کنند.",
        order: 6,
        parameters: [
          {
            stableKey: "mm.useManual",
            nameFa: "زمان دستی (manual)",
            description:
              "کاری که اپراتور انجام می‌دهد؛ مشمول ارزیابی عملکرد است و در نسبت بار اپراتور (TS-021) جمع می‌شود.",
            dataType: "boolean",
            analysisRole: "informational",
            defaultValue: true,
            configurableOnCreate: true,
            displayContexts: ["form", "report"],
          },
          {
            stableKey: "mm.useMachineAuto",
            nameFa: "زمان خودکار ماشین (machineAuto)",
            description:
              "کاری که ماشین بدون دخالت اپراتور انجام می‌دهد؛ ارزیابی عملکرد نمی‌گیرد و سمت ماشینی چرخه دستی–ماشین (TS-020) است.",
            dataType: "boolean",
            analysisRole: "informational",
            defaultValue: true,
            configurableOnCreate: true,
            displayContexts: ["form", "report"],
          },
          {
            stableKey: "mm.useWaiting",
            nameFa: "زمان انتظار (waiting)",
            description:
              "زمان بیکاری اپراتور یا ماشین در انتظار طرف دیگر؛ جدا از کار مؤثر گزارش می‌شود.",
            dataType: "boolean",
            analysisRole: "informational",
            defaultValue: true,
            configurableOnCreate: true,
            displayContexts: ["form", "report"],
          },
          {
            stableKey: "mm.useOverlap",
            nameFa: "زمان هم‌پوشانی (overlap)",
            description:
              "بخشی از کار دستی که هم‌زمان با کار خودکار ماشین انجام می‌شود؛ در TS-020 صریح مدل‌سازی می‌شود و جمع کورکورانه اجزای زمان ممنوع است.",
            dataType: "boolean",
            analysisRole: "informational",
            defaultValue: true,
            configurableOnCreate: true,
            displayContexts: ["form", "report"],
          },
        ],
      },
    ],
    timingMethod: {
      default: "continuous",
      notesFa:
        "ثبت پیوسته برای پوشش هم‌زمانی کار دستی و ماشین توصیه می‌شود؛ رویدادهای شروع/پایان کار خودکار ماشین جداگانه علامت‌گذاری می‌شوند تا هم‌پوشانی مدل شود.",
    },
    analysisChain: [
      {
        step: 1,
        nameFa: "ثبت فعالیت‌ها با نوع زمان",
        descriptionFa:
          "هر فعالیت چرخه با یکی از انواع زمان (دستی، خودکار ماشین، انتظار، هم‌پوشانی) و ترتیب زمانی ثبت می‌شود؛ انواع فعال در خانواده «انواع زمان فعالیت» تعیین می‌شوند.",
      },
      {
        step: 2,
        nameFa: "زمان نماینده فعالیت",
        descriptionFa:
          "تجمیع مشاهدات معتبر هر فعالیت بر اساس پارامتر «روش تجمیع» (agg.method): میانگین، میانه یا حذف پرت‌ها بر قاعده و سپس تجمیع.",
        formulaRefs: ["TS-001", "TS-002"],
      },
      {
        step: 3,
        nameFa: "زمان نرمال اجزای دستی",
        descriptionFa:
          "ضریب ارزیابی فقط بر اجزای دستی اعمال می‌شود (rating.enabled و rating.factor)؛ زمان خودکار ماشین ارزیابی نمی‌گیرد. با ارزیابی غیرفعال، خروجی «زمان خام» نامیده می‌شود.",
        formulaRefs: ["TS-010"],
      },
      {
        step: 4,
        nameFa: "چرخه دستی–ماشین",
        descriptionFa:
          "چرخه ترکیبی با بیشینه «جمع کار دستی با لحاظ هم‌پوشانی» و «زمان خودکار ماشین» محاسبه می‌شود؛ هم‌پوشانی صریح مدل می‌شود و جمع کورکورانه اجزای زمان ممنوع است.",
        formulaRefs: ["TS-020"],
      },
      {
        step: 5,
        nameFa: "زمان استاندارد",
        descriptionFa:
          "اعمال نرخ مجاز طبق روش انتخابی: on-normal یعنی ST = NT × (1 + r) و on-standard یعنی ST = NT ÷ (1 − r)؛ دو قرارداد یکی نیستند.",
        formulaRefs: ["TS-011", "TS-012"],
      },
      {
        step: 6,
        nameFa: "نسبت بار اپراتور و جمع چرخه",
        descriptionFa:
          "نسبت بار اپراتور از تقسیم جمع کار دستی بر چرخه دستی–ماشین به‌دست می‌آید؛ جمع عناصر استاندارد با مرزهای چرخه، زمان استاندارد چرخه را می‌سازد.",
        formulaRefs: ["TS-021"],
      },
    ],
    formulas: [
      {
        id: "TS-001",
        nameFa: "میانگین عنصر",
        semver: "1.0.0",
        scopeLevel: "element",
        status: "active",
        descriptionFa: "میانگین حسابی مشاهدات معتبر عنصر/فعالیت: x̄ = Σxᵢ ÷ n — ریاضی محض.",
      },
      {
        id: "TS-002",
        nameFa: "میانه عنصر",
        semver: "1.0.0",
        scopeLevel: "element",
        status: "active",
        descriptionFa: "مقدار میانه مشاهدات مرتب‌شده عنصر/فعالیت؛ نیازمند حداقل یک مشاهده معتبر — ریاضی محض.",
      },
      {
        id: "TS-010",
        nameFa: "زمان نرمال عنصر",
        semver: "1.0.0",
        scopeLevel: "element",
        status: "active",
        descriptionFa:
          "زمان نرمال: NT = RT × (RF ÷ 100)؛ در این پروفایل فقط برای اجزای دستی — مرجع (ILO مفهومی).",
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
        id: "TS-020",
        nameFa: "چرخه دستی–ماشین",
        semver: "1.0.0",
        scopeLevel: "cycle",
        status: "active",
        descriptionFa:
          "چرخه دستی–ماشین: C = max(جمع دستی با لحاظ هم‌پوشانی، خودکار ماشین)؛ هم‌پوشانی صریح مدل‌سازی می‌شود — تعریف محصول (B5).",
      },
      {
        id: "TS-021",
        nameFa: "نسبت بار اپراتور",
        semver: "1.0.0",
        scopeLevel: "cycle",
        status: "active",
        descriptionFa: "نسبت بار اپراتور: L_op = جمع دستی ÷ C؛ خروجی درصدی — تعریف محصول.",
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
        descriptionFa: "جمع‌بندی جلسات، فعالیت‌ها، انواع زمان فعال و تنظیمات اثرگذار (تجمیع، ارزیابی، مجاز).",
      },
      {
        id: "report.raw-observations",
        nameFa: "جدول مشاهدات خام",
        descriptionFa: "همه مشاهده‌ها با فعالیت، نوع زمان، چرخه، مدت، ضریب ارزیابی و وضعیت اعتبار.",
      },
      {
        id: "report.element-analysis",
        nameFa: "تحلیل فعالیت",
        descriptionFa: "آمار هر فعالیت به‌تفکیک نوع زمان به‌همراه زنجیره زمان نماینده ← نرمال ← استاندارد.",
      },
      {
        id: "report.sample-quality",
        nameFa: "کیفیت نمونه",
        descriptionFa: "کفایت نمونه هر فعالیت در سطح اطمینان و دقت هدف، با قضاوت «کافی/نیازمند مشاهده بیشتر».",
      },
      {
        id: "report.standard-time",
        nameFa: "گزارش زمان استاندارد",
        descriptionFa: "زمان استاندارد اجزا و چرخه با نمایش فرمول، نسخه فرمول و ضرایب به‌کاررفته.",
      },
      {
        id: "report.man-machine-overlap",
        nameFa: "نمودار هم‌پوشانی دستی–ماشین",
        descriptionFa:
          "خط زمانی چرخه با تفکیک کار دستی، خودکار، انتظار و هم‌پوشانی به‌همراه نسبت بار اپراتور؛ خروجی نمودار ساده man-machine در فاز ۵ فعال می‌شود.",
      },
    ],
  },
} satisfies ProfileDefinition;
