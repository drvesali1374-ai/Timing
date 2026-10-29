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

## ۴. موتور بالانس خط (فاز ۶)

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

## ۵. جدول تحویل قراردادها به فازهای بعد

| قرارداد | پیاده‌سازی در | مصرف‌کننده‌های اصلی |
|---|---|---|
| FormulaEngine (EvalRequest/Result) | فاز ۲ | تحلیل (۵)، گزارش (۵)، دستیار (۳) |
| DiagramDoc/Validation | فاز ۳ | ویرایشگر (۳)، گزارش (۵)، دستیار (۳) |
| ChronoEngine/Clock | فاز ۴ | UI زمان‌سنجی (۴)، تحلیل (۵) |
| BalanceProblem/Solution | فاز ۶ | UI سناریو (۶)، گزارش (۶)، Yamazumi (۶) |

**قاعده وابستگی (بخش D):** تا پیش از پیاده‌سازی هر موتور، مصرف‌کننده‌های فاز جاری فقط به **این قراردادهای امضا‌شده** + داده نمونه جدا (بدون مخلوط با داده واقعی) اتکا می‌کنند.
