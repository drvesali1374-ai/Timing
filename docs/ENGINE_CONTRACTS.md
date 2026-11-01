# قراردادهای موتورهای هسته (ENGINE CONTRACTS)

**نسخه:** ۱٫۰ (فاز صفر) — **تاریخ:** ۲۹ اکتبر ۲۰۲۶
**هدف (بند ۷ دستور فاز صفر):** تعریف قیود و ورودی/خروجی مستقل برای موتور فرمول، مدل نمودار، کرنومتر و بالانس — بدون طراحی بیش‌ازحد پیچیده قبل از اثبات نیاز.

---

## ۱. موتور فرمول (فاز ۲)

### ورودی (immutable)
```ts
interface EvalRequest {
  formulaAst: FormulaAst            // از Formula.exprAst — پیش‌اعتبارسنجی‌شده
  formulaVersion: semver
  configVersionId: string
  scope: { type: 'observation'|'element'|'cycle'|'cycleSet'|'group'|'project'|'balanceScenario'; id: string }
  resolver: ParamValueResolver       // مقدار پارامتر با stableKey
  aggregates: AggregateProvider      // تجمیع‌های آماری مشاهدات
  units: UnitRegistry                // تبدیل‌های مجاز
  depthBudget: number                // پیش‌فرض 64
}
```

### خروجی
```ts
interface EvalResult {
  value: number | string | boolean | null
  unit?: Unit
  status: 'valid' | 'invalid' | 'incomplete'
  errors: FormulaError[]             // {code: parse|type|unit|ref|div0|cycle|missing, messageFa, astNodeId}
  trace: TraceStep[]
  inputRefs: string[]                // شناسه مقادیر/مشاهدات مصرف‌شده
  computedAt: string                 // ISO — صرفاً ثبت؛ نتیجه قطعی مستقل از زمان است
}
```

### قیود
۱. **بدون eval/Function** — فقط مفسر AST اختصاصی (ADR-003).
۲. عمق/طول/گره محدود (۶۴/۲۰۴۸/۵۱۲).
۳. گراف وابستگی بدون چرخه — چرخه پیش از اجرا رد می‌شود.
۴. تقسیم بر صفر، ارجاع ناموجود، نوع/واحد ناسازگار → `invalid` مهارشده (بدون استثنای فرار).
۵. قطعیت: (Ast + resolver data + units) یکسان → نتیجه یکسان.
۶. UI فقط مصرف‌کننده نتیجه است؛ قواعد اجرا مستقل از UI.

## ۲. مدل نمودار OPC/FPC (فاز ۳)

### ورودی (به موتور اعتبارسنجی)
```ts
interface DiagramDoc {
  kind: 'opc' | 'fpc'
  variant: 'current' | 'proposed'
  subject?: 'material' | 'person' | 'equipment'    // فقط FPC
  nodes: DiagramNode[]                              // symbol ∈ مجموعه بسته نمادها
  edges: DiagramEdge[]                              // جهت‌دار
}
```

### خروجی اعتبارسنجی
```ts
interface DiagramValidationReport {
  errors:   DiagramIssue[]   // اتصال نامعتبر، شناسه تکراری، مرجع فعالیت ناموجود
  warnings: DiagramIssue[]   // گام بدون اتصال، ترتیب ناسازگار، نماد بدون زمان/مسافت
  summary:  { counts: Record<symbol, number>; totalTime?: s; totalDistance?: m }
}
```

### قیود
۱. نمادها از **فهرست بسته** انتخاب می‌شوند (OPC: عملیات/بازرسی؛ FPC: عملیات/حمل/بازرسی/تأخیر/انبارش) — واژه‌نامه و هم‌معناها در راهنمای محصول (B6).
۲. هر node حداکثر یک `activityRef` دارد؛ **هیچ داده‌ای به‌صورت کپی غیرقابل‌ردیابی بین نمودار و فعالیت تکرار نمی‌شود** (ارجاع + نمایش).
۳. چیدمان (`layoutJson`) از مدل معنایی جدا است؛ اعتبارسنجی مستقل از چیدمان است.
۴. جهت منطقی جریان مستقل از RTL صفحه تعیین می‌شود (پیکان‌ها همیشه از مبدأ به مقصد معنایی).
۵. ویرایش هرگز وضعیت «تأییدشده» را بی‌اجازه بازنویسی نمی‌کند (نسخه‌بندی نمودار).
۶. **RTL متن فارسی بدون معکوس‌شدن جهت جریان** الزامی است (بند B6).

## ۳. موتور کرنومتر (فاز ۴)

> **پیاده‌سازی:** فاز ۴ — `src/shared/timing` (سازگار با این قرارداد؛ رویداد `note` اضافه شد؛ `cycleStart`/`element`/`lap` در پیاده‌سازی) | ✅

### ورودی/رابط (خالص، بدون DOM)
```ts
interface Clock { now(): { perfMs: number; wall: Date } }   // تزریقی برای آزمون
interface ChronoEngine {
  start(): void
  recordReading(elementId: string): ChronoEvent      // پیوسته: قرائت متوالی
  recordElement(elementId: string): ChronoEvent      // بازگشت به صفر/عنصری
  lap(): ChronoEvent
  pause(reason?): ChronoEvent; resume(): ChronoEvent; stop(): ChronoEvent
  correct(targetEventId, newValue, reason): ChronoEvent  // رویداد اصلاح — بدون حذف
  events(): readonly ChronoEvent[]
  integrity(): IntegrityFlags[]
}
```

### خروجی رویداد
`{ clientEventId: UUIDv7, sessionId, type, elementId?, cycleNo, perfElapsedMs, wallClock, interruptionReason?, correctionOf? }`

### قیود
۱. فاصله‌های **درون جلسه فعال** فقط از `performance.now()` (monotonic) محاسبه می‌شوند؛ شمارنده ثانیه‌ای ممنوع (ADR-004).
۲. زمان دیواری جدا ثبت و صرفاً برای ممیزی/گزارش انسانی استفاده می‌شود.
۳. رویدادها **append-only**؛ اصلاح = رویداد جدید با `correctionOf`.
۴. بعد از reload/خواب: `performance.now()` مبدأ جدید دارد → قطعات غیرقابل‌اتکا با پرچم `recovered/needsReview` علامت می‌خورند و ادعای دقت کامل نمی‌شود.
۵. هر رویداد پیش از هر پردازش به `TimingEventSink` بادوام (IndexedDB → صف) سپرده می‌شود (ثبت سریع و پایدار).
۶. `clientEventId` idempotent → کلیک تکراری/retry دوباره‌شماری نمی‌کند.
۷. ورودی عناصر/چرخه از پروفایل پروژه (پیوسته/سnapback/lap) — موتور مستقل از UI و از مدل داده سرور.

## ۴. موتور تحلیل مهندسی زمان (فاز ۵)

### ورودی (immutable — خالص)
```ts
// هسته خالص — shared/analysis (بدون DOM/DB)
interface AnalysisKernelInput {
  observations: MarkedObservation[]   // از چرخه‌های نهایی‌شده + علامت‌های append-only
  settings: AnalysisSettings          // agg.method/rating/allowance/stats — پارامترهای project-scope
}
// سرویس (modules/analysis): ارزیابی زنجیره از مسیر موتور فرمول فاز ۲ با
// snapshot پروژه (TS-001/002/010/011/012 نسخه‌دار) + راستی‌آزمایی متقابل با هسته.
```

### خروجی
```ts
interface TimeChain {
  representative: { value: ms | null; status: 'valid'|'incomplete'|'invalid'; method; effectiveN; warningsFa }
  normal:         { value: ms | null; status; ratingApplied; ratingFactorPct | null; labelFa }  // خام بدون ارزیابی
  standard:       { value: ms | null; status; allowanceMethod; allowanceRatePct | null; baseFa }
}
interface ElementAnalysis { counts; stats: DescriptiveStats; histogram; outlierDetection; quality; chain; formulaTrace }
```

### قیود
۱. **دو عمل جدا:** علامت «داده پرت» ≠ «حذف از محاسبه»؛ حذف بدون علت در اعتبارسنجی رد می‌شود (B9).
۲. تشخیص پرت (IQR توکی k=۱٫۵ / z-score |z|>۳) فقط «شناسایی» است؛ agg=outlierRule کنارگذاشتن قاعده‌ای را با ثبت قاعده انجام می‌دهد.
۳. بدون ارزیابی عملکرد → «زمان خام» با وضعیت incomplete — نام «زمان نرمال قطعی» ممنوع (B4).
۴. دو قرارداد مجاز نابرابرند: on-normal یعنی ST=NT×(1+r) و on-standard یعنی ST=NT÷(1−r)؛ پایه درصد صریح.
۵. گام زنجیره اگر فرمول نسخه‌دارش منسوخ/غایب باشد → incomplete صادقانه (حتی اگر ریاضیات هسته عدد بدهد).
۶. مقادیر موتور فرمول بر حسب ثانیه (inputContract کتابخانه)؛ هسته ms؛ تلورانس تطابق ۱e-۶s.
۷. ردیابی: هر خروجی مهم → نسخه پیکربندی + کلید/نسخه فرمول + روش تجمیع + واحد + تنظیمات + شمارش ورودی (بلوک trace).
۸. خروجی‌ها: CSV (UTF-8 BOM) / XLS (SpreadsheetML-2003 RTL) / JSON (ردیابی کامل)؛ PDF از مسیر چاپ مرورگر (ADR-014).
۹. هسته از UI و Prisma مستقل است؛ DTOها در shared/contracts/analysis (قاعده مرزها).

## ۵. موتور بالانس خط (فاز ۶)

### ورودی
```ts
interface BalanceProblem {
  activities: { id: string; time: number; timeType: TimeType; zone?: string; forbidden?: string[] }[]
  precedences: { before: string; after: string }[]      // DAG — اعتبارسنجی چرخه
  takt: number                                           // یا demand+netTime+shifts
  stationsAvailable?: number
  objectives: { minimizeStations?: w; smoothLoad?: w; minChanges?: w; … }
  options: { algorithm: 'lcr'|'rpw'|'kilbridgeWester'|'manual'; timeBudgetMs }
}
```

### خروجی
```ts
interface BalanceSolution {
  algorithm: string; algorithmVersion: semver
  assignments: { activityId: string; station: number }[]
  metrics: { E: number; d: number; mMin: number; bottleneck: number; idlePerStation: number[] }
  constraintsReport: { violated: ConstraintViolation[]; respected: number }
  objectiveValue: number; runMs: number
  status: 'solved' | 'infeasible-flagged' | 'time-budget-exceeded'
}
```

### قیود
۱. **رعایت تقدم/تأخر:** راه‌حل قابل‌قبول هرگز قید را نقض نمی‌کند؛ در غیر این صورت نقض صریح گزارش می‌شود (شرط پذیرش C3-۷).
۲. زمان‌های `machineAuto` به‌عنوان کار دستی اپراتور جمع نمی‌شوند؛ هم‌پوشانی مدل صریح دارد.
۳. «تعداد ایستگاه» و «نیروی هر شیفت» جداگانه با فرض‌های خود گزارش می‌شوند.
۴. الگوریتم‌های مقدماتی (LCR/RPW/KW) قطعی و آزمون‌پذیرند؛ خروجی ابتکاری = «بهترین راهکار یافت‌شده» نه «بهینه قطعی».
۵. حل دقیق (MILP/CP-SAT) در نسخه پایه **خیر** — رابط افزونه‌پذیر ثبت شد (ADR-008).
۶. تخصیص دستی کاربر مجاز است و فوری اعتبارسنجی/بازمحاسبه می‌شود؛ نامعتبری بی‌صدا پذیرفته نمی‌شود.
۷. موتور از UI و از Prisma مستقل است — ورودی/خروجی داده محض.

## ۶. جدول تحویل قراردادها به فازهای بعد

| قرارداد | پیاده‌سازی در | مصرف‌کننده‌های اصلی |
|---|---|---|
| FormulaEngine (EvalRequest/Result) | فاز ۲ | تحلیل (۵)، گزارش (۵)، دستیار (۳) |
| DiagramDoc/Validation | فاز ۳ | ویرایشگر (۳)، گزارش (۵)، دستیار (۳) |
| ChronoEngine/Clock | فاز ۴ | UI زمان‌سنجی (۴)، تحلیل (۵) |
| BalanceProblem/Solution | فاز ۶ | UI سناریو (۶)، گزارش (۶)، Yamazumi (۶) |

**قاعده وابستگی (بخش D):** تا پیش از پیاده‌سازی هر موتور، مصرف‌کننده‌های فاز جاری فقط به **این قراردادهای امضا‌شده** + داده نمونه جدا (بدون مخلوط با داده واقعی) اتکا می‌کنند.
