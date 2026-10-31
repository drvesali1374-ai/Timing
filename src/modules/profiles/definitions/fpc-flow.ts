/**
 * پروفایل «تحلیل جریان فرایند (FPC)» — نمادهای پنج‌گانه، خلاصه مسافت/زمان و مقایسه روش‌ها.
 *
 * منبع مشخصات: docs/PROFILES.md §۴٫۵ + docs/STANDARDS_CATALOG.md ردیف ۶
 * موضوع مطالعه: ماده/فرد/تجهیزات؛ خلاصه خودکار تعداد هر نوع نماد و مجموع مسافت/زمان؛
 * مقایسه روش فعلی/پیشنهادی با دو نسخه نمودار (ویرایشگر فاز ۳ — ADR-007).
 * توجه: این پروفایل فرمولی در کاتالوگ TS/ST/LB ندارد؛ خلاصه جریان توسط ویرایشگر نمودار
 * (شمارش و جمع ریاضی محض) تولید می‌شود، بنابراین فهرست فرمول‌ها خالی است.
 * این فایل صرفاً داده است (بدون عارضه جانبی).
 */

import type { ProfileDefinition } from "@/modules/profiles/domain/profile";

export const fpcFlow = {
  id: "profile.fpc-flow",
  semver: "1.1.0",
  nameFa: "تحلیل جریان فرایند (FPC)",
  description:
    "پروفایل تحلیل جریان فرایند با نمادهای پنج‌گانه (عملیات، حمل، بازرسی، تأخیر، انبارش) برای موضوع مطالعه ماده، فرد یا تجهیزات. خلاصه خودکار تعداد هر نوع نماد و مجموع مسافت/زمان تولید می‌شود و روش فعلی با نسخه پیشنهادی (دو نسخه نمودار) مقایسه می‌گردد.",
  scopeOfUse:
    "مستندسازی و بهبود جریان فرایند در سطح گام‌ها (حرکت، عملیات، بازرسی، تأخیر، انبارش) همراه با زمان و مسافت؛ دقت زمان‌سنجی عنصری را جایگزین نمی‌کند.",
  source: {
    type: "common-practice",
    name: "Process Chart (OPC/FPC) — ScienceDirect Topics «Process Chart» + میراث ASME/Grimshaw",
    version: "بازیابی ۲۰۲۶-۱۰-۲۹",
    url: "https://www.sciencedirect.com/topics/engineering/process-chart",
  },
  assumptions: [
    "فرایند به توالی گام‌ها با نمادهای پنج‌گانه (عملیات، حمل، بازرسی، تأخیر، انبارش) قابل ترسیم است.",
    "زمان و مسافت گام‌ها قابل ثبت یا برآورد معتبر هستند.",
    "نسخه پیشنهادی همان فرایند با تغییرات مشخص است تا مقایسه دو نسخه معنادار باشد.",
  ],
  limitations: [
    "اصطلاح‌شناسی OPC/FPC و شکل نمادها بین منابع (میراث ASME/گریمشاو و متون IE) متفاوت است؛ استاندارد الزام‌آور واحدی وجود ندارد و واژه‌نامه داخلی همراه هم‌معناها ارائه می‌شود.",
    "ویرایشگر نمودار در فاز ۳ فعال می‌شود (ADR-007)؛ در فاز پایه ساختار داده‌ای و پارامترهای پروفایل آماده است.",
    "تحلیل جریان، دقت زمان‌سنجی عنصری را جایگزین نمی‌کند؛ برای زمان‌های دقیق از پروفایل‌های زمان‌سنجی استفاده شود.",
  ],
  licenseNote:
    "روش رایج — نمادهای پنج‌گانه فرایندی، میراث ASME/گریمشاو؛ بدون استاندارد الزام‌آور واحد؛ ارجاع مفهومی، نه گواهی انطباق.",
  content: {
    families: [
      {
        stableKey: "flow.context",
        nameFa: "زمینه جریان",
        description:
          "تعیین موضوع مطالعه (ماده/فرد/تجهیزات) و واحد مسافت؛ نمادها و خلاصه‌ها بر همان موضوع اعمال می‌شوند.",
        order: 1,
        parameters: [
          {
            stableKey: "flow.subject",
            nameFa: "موضوع مطالعه",
            description:
              "جریان چیزی که ترسیم می‌شود: ماده (FPC مادی)، فرد (جریان کار اپراتور) یا تجهیزات؛ تعیین‌کننده تفسیر گام‌ها است.",
            dataType: "singleSelect",
            analysisRole: "input",
            required: true,
            options: [
              { value: "material", labelFa: "ماده" },
              { value: "person", labelFa: "فرد" },
              { value: "equipment", labelFa: "تجهیزات" },
            ],
            displayContexts: ["form", "report"],
          },
          {
            stableKey: "flow.distanceUnit",
            nameFa: "واحد مسافت",
            description: "واحد ثبت و جمع مسافت گام‌های حمل؛ نمایش در خلاصه جریان با همین واحد است.",
            dataType: "singleSelect",
            analysisRole: "variable",
            defaultValue: "m",
            options: [
              { value: "m", labelFa: "متر" },
              { value: "km", labelFa: "کیلومتر" },
              { value: "ft", labelFa: "فوت" },
              { value: "yd", labelFa: "یارد" },
            ],
            displayContexts: ["form", "report"],
          },
        ],
      },
      {
        stableKey: "flow.comparison",
        nameFa: "مقایسه روش‌ها",
        description:
          "مقایسه روش فعلی با روش پیشنهادی از طریق دو نسخه از نمودار فرایند و مقایسه خلاصه‌های آنها.",
        order: 2,
        parameters: [
          {
            stableKey: "flow.compareEnabled",
            nameFa: "مقایسه روش فعلی/پیشنهادی",
            description:
              "در صورت فعال بودن، نسخه دوم نمودار برای روش پیشنهادی ایجاد و خلاصه دو نسخه کنار هم گزارش می‌شود.",
            dataType: "boolean",
            analysisRole: "variable",
            defaultValue: true,
            configurableOnCreate: true,
            displayContexts: ["form", "report"],
          },
        ],
      },
      {
        stableKey: "flow.summary",
        nameFa: "خلاصه جریان",
        description:
          "شاخص‌های خروجی خلاصه خودکار نمودار فرایند: تعداد هر نوع نماد پنج‌گانه، مجموع مسافت و مجموع زمان؛ توسط ویرایشگر نمودار (فاز ۳) محاسبه می‌شوند.",
        order: 3,
        parameters: [
          {
            stableKey: "fpc.count.operation",
            nameFa: "تعداد عملیات (O)",
            dataType: "integer",
            analysisRole: "outputIndex",
            displayContexts: ["report"],
          },
          {
            stableKey: "fpc.count.transport",
            nameFa: "تعداد حمل (T)",
            dataType: "integer",
            analysisRole: "outputIndex",
            displayContexts: ["report"],
          },
          {
            stableKey: "fpc.count.inspect",
            nameFa: "تعداد بازرسی (I)",
            dataType: "integer",
            analysisRole: "outputIndex",
            displayContexts: ["report"],
          },
          {
            stableKey: "fpc.count.delay",
            nameFa: "تعداد تأخیر (D)",
            dataType: "integer",
            analysisRole: "outputIndex",
            displayContexts: ["report"],
          },
          {
            stableKey: "fpc.count.storage",
            nameFa: "تعداد انبارش (S)",
            dataType: "integer",
            analysisRole: "outputIndex",
            displayContexts: ["report"],
          },
          {
            stableKey: "fpc.totalDistance",
            nameFa: "مجموع مسافت",
            description: "جمع مسافت گام‌های حمل، بر حسب واحد مسافت انتخابی (flow.distanceUnit).",
            dataType: "decimal",
            analysisRole: "outputIndex",
            min: 0,
            displayContexts: ["chart", "report"],
          },
          {
            stableKey: "fpc.totalTime",
            nameFa: "مجموع زمان جریان",
            description: "جمع زمان گام‌های ثبت‌شده بر مبنای ثانیه (SI)؛ تبدیل نمایشی لایه UI است.",
            dataType: "decimal",
            analysisRole: "outputIndex",
            min: 0,
            unit: "s",
            displayContexts: ["chart", "report"],
          },
        ],
      },
      {
        stableKey: "study.context",
        nameFa: "زمینه مطالعه",
        description:
          "شناسه فرایند/مسیر و تاریخ برای گروه‌بندی و فیلتر؛ این خانواده در ایجاد پروژه قابل حذف است.",
        order: 4,
        optionalOnCreate: true,
        parameters: [
          {
            stableKey: "study.process",
            nameFa: "فرایند/مسیر مورد مطالعه",
            description: "نام یا کد فرایندی که جریان آن ترسیم می‌شود.",
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
        nameFa: "تعیین موضوع و ترسیم گام‌ها",
        descriptionFa:
          "موضوع مطالعه (ماده/فرد/تجهیزات — flow.subject) تعیین و توالی گام‌های فرایند با نمادهای پنج‌گانه عملیات، حمل، بازرسی، تأخیر و انبارش ترسیم می‌شود.",
      },
      {
        step: 2,
        nameFa: "ثبت زمان و مسافت گام‌ها",
        descriptionFa:
          "برای هر گام زمان و برای گام‌های حمل مسافت ثبت می‌شود؛ مسافت بر حسب واحد انتخابی (flow.distanceUnit) و زمان بر مبنای ثانیه است.",
      },
      {
        step: 3,
        nameFa: "خلاصه خودکار جریان",
        descriptionFa:
          "تعداد هر نوع نماد، مجموع مسافت و مجموع زمان محاسبه و در شاخص‌های خانواده «خلاصه جریان» و گزارش خلاصه نمایش می‌یابد.",
      },
      {
        step: 4,
        nameFa: "مقایسه روش فعلی/پیشنهادی",
        descriptionFa:
          "در صورت فعال بودن مقایسه (flow.compareEnabled)، نسخه پیشنهادی همان فرایند با تغییرات مشخص ترسیم و خلاصه دو نسخه (تعداد نمادها، مسافت، زمان) کنار هم گزارش می‌شود.",
      },
    ],
    /**
     * کاتالوگ فرمول‌ها (FORMULA_CATALOG.md) برای تحلیل جریان فرایند شناسه‌ای ندارد:
     * خلاصه جریان (شمارش نمادها و جمع مسافت/زمان) ریاضی محض است و توسط ویرایشگر
     * نمودار فاز ۳ تولید می‌شود؛ بنابراین این پروفایل ارجاع فرمول نسخه‌دار ندارد.
     */
    formulas: [],
    reportTemplates: [
      {
        id: "report.fpc-diagram",
        nameFa: "نمودار فرایند (FPC)",
        descriptionFa:
          "خروجی چاپی/تصویری نمودار فرایند با نمادهای پنج‌گانه و موضوع مطالعه مشخص؛ ویرایشگر نمودار در فاز ۳ فعال می‌شود.",
      },
      {
        id: "report.flow-summary",
        nameFa: "خلاصه جریان فرایند",
        descriptionFa:
          "تعداد هر نوع نماد (عملیات، حمل، بازرسی، تأخیر، انبارش)، مجموع مسافت و مجموع زمان؛ به‌تفکیک روش فعلی/پیشنهادی در صورت فعال بودن مقایسه.",
      },
      {
        id: "report.flow-comparison",
        nameFa: "مقایسه روش فعلی و پیشنهادی",
        descriptionFa:
          "دو نسخه نمودار و تفاوت خلاصه‌ها: تعداد نمادها، مجموع مسافت و مجموع زمان — جهت ارزیابی بهبود پیشنهادی.",
      },
    ],
  },
} satisfies ProfileDefinition;
