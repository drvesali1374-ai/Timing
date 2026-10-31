# فرهنگ داده و مدل مفهومی (DATA DICTIONARY)

**نسخه:** ۱٫۲ (پیاده‌سازی فاز ۴ — بندهای ۲٫۱۱–۲٫۱۴ به‌روزشده + بند ۹) — **تاریخ آخرین به‌روزرسانی:** ۳۱ اکتبر ۲۰۲۶
**هدف:** تعریف موجودیت‌ها، روابط، ناوردایی‌ها (invariants) و مرجع حقیقت هر داده؛ مبنای پیاده‌سازی Prisma در فاز ۱.
**قاعده:** تعریف پارامتر از مقدار پارامتر جداست؛ داده خام از داده مشتق‌شده جداست؛ هر نتیجه به نسخه روش قابل ارجاع است.

---

## ۱. نمودار ارتباط موجودیت‌ها (ER مفهومی)

```mermaid
erDiagram
    User ||--o{ Project : owns
    User }o--o{ Project : collaborates
    Project ||--o{ ConfigVersion : "has versions"
    ProfileTemplate ||--o{ Project : "instantiated (copy)"
    ConfigVersion ||--o{ ParameterFamily : contains
    ParameterFamily ||--o{ ParameterDefinition : groups
    ParameterDefinition ||--o{ ParameterValue : "typed by (def version)"
    Project ||--o{ Activity : defines
    Activity ||--o{ ActivityTime : "measured/typed"
    Activity }o--o{ Activity : "precedence"
    Project ||--o{ Diagram : has
    Diagram ||--o{ DiagramNode : contains
    Diagram }o--|| Activity : "nodes reference"
    DiagramNode ||--o{ DiagramEdge : "from/to"
    Project ||--o{ TimingSession : runs
    TimingSession ||--o{ TimingEvent : records
    TimingSession ||--o{ TimingCycle : "produces (stored at finalize)"
    TimingCycle ||--o{ ElementObservation : "contains (elementsJson)"
    ElementObservation }o--|| Activity : "element measured (ref)"
    ElementObservation }o--|| ParameterValue : "context values"
    ConfigVersion ||--o{ Formula : versions
    Formula ||--o{ CalculationResult : evaluates
    ElementObservation }o--o{ CalculationResult : "input of"
    Project ||--o{ BalanceScenario : analyzes
    BalanceScenario }o--o{ Activity : allocates
    Project ||--o{ Report : generates
    User ||--o{ AuditLog : actions
```

## ۲. جدول موجودیت‌ها

قرارداد نام‌گذاری: شناسه‌های پایدار `id` (UUIDv7)؛ کلیدهای مخفی فقط داخلی. «مرجع حقیقت» یعنی مخزنی که داده در آن تعریف/صادر می‌شود.

### ۲.۱. Project — پروژه
| فیلد | نوع | توضیح |
|---|---|---|
| id | UUIDv7 | شناسه پایدار |
| code, title | متن | کد و عنوان |
| goal, location, department, line, station, product, process, owner, shift | متن اختیاری | زمینه B1 |
| status | enum | `active / archived / completed` |
| readiness | flags | آماده اندازه‌گیری/تحلیل/تأیید |
| profileSnapshotId | ref | کپی مستقل پروفایل لحظه ایجاد |
| currentConfigVersionId | ref | نسخه فعال پیکربندی |
| createdAt/updatedAt, notes | — | — |

**ناوردایی:** حذف منطقی (بایگانی)؛ دسترسی همیشه از مجوزسنجی سرور می‌گذرد.

### ۲.۲. ConfigVersion — نسخه پیکربندی
`id`, `projectId`, `semver`, `snapshotJson` (کل پیکربندی: خانواده‌ها، فرمول‌ها، تنظیمات آماری، قواعد بالانس)، `reason`, `createdBy`, `createdAt`.
**قاعده:** نسخه‌ها **غیرقابل تغییر** (append-only) هستند؛ هر تغییر ساختاری → نسخه جدید. نتایج محاسبه همیشه به `configVersionId` ارجاع دارند (ADR-005).

### ۲.۳. ProfileTemplate — الگوی پروفایل (سراسری، فقط‌خواندنی نسبت به پروژه‌ها)
`id`, `semver`, `nameFa`, `description`, `scope`, `source{type,name,version,url}`, `assumptions[]`, `limitations[]`, `licenseNote`, `content` (همان ساختار snapshot).
**قاعده:** لحظه ایجاد پروژه، `content` به `ConfigVersion` کپی می‌شود؛ تغییر الگو اثر گذشته ندارد.

### ۲.۴. ParameterFamily — خانواده پارامتر
`id`, `configVersionId`, `stableKey` (شناسه فنی پایدار)، `nameFa`, `order`, `archived`.

### ۲.۵. ParameterDefinition — تعریف پارامتر
`id`, `familyId`, `defVersion`, `stableKey`, `nameFa`, `description`, `helpFa`,
`dataType` (enum: `shortText,longText,integer,decimal,percent,ratio,duration,dateTime,boolean,singleSelect,multiSelect,quantityWithUnit,entityRef,computed`),
`required`, `defaultValue`, `min/max`, `precision`, `rounding`, `unit`, `allowedConversions[]`,
`options[]` + `optionsSource`, `conditionExpr` (عبارت DSL)، `computationFormulaId`,
`analysisRole` (enum: `input,grouping,filter,variable,outputIndex,informational`),
`displayContexts[]` (`form,table,chart,report`), `customAttrsJson`, `archived`.
**ناوردایی:** `stableKey` هرگز بازنویسی نمی‌شود؛ تغییر تعریف → `defVersion++` و تصمیم صریح مهاجرت مقادیر (بدون تبدیل پنهانی).

### ۲.۶. ParameterValue — مقدار پارامتر
`id`, `projectId`, `defId`, `defVersion` (نسخه تعریف هنگام ثبت)، `scopeType` (`project,session,cycle,observation,activity`),
`scopeId`, `valueJson` (به‌همراه واحد)، `recordedAt`, `recordedBy`.
**ناوردایی:** مقدار به نسخه تعریف لحظه ثبت گره خورده؛ تعریف جدید مقادیر قدیمی را بی‌سروصدا تبدیل نمی‌کند.

### ۲.۷. Activity — فعالیت/عنصر کاری (مدل مشترک B5)
`id`, `projectId`, `stableKey`, `name`, `description`, `workType` (enum توسعه‌پذیر: `operatorManual,machineAuto,waiting,transport,inspection,setupChangeover,overlap`),
`vaClassification` (nullable: `valueAdded,nonValueAdded,essentialNonVA` — فقط با تأیید کاربر)،
`constraintsJson` (ایستگاه مجاز، مهارت، تجهیز اختصاصی)، `stationHint`, `skillRequired`, `customParams` (ارجاع ParameterValue)،
`sourceOfTime` (enum: `measured,estimated,referenced`).
**رابطه تقدم:** جدال `ActivityPrecedence(activityId, predecessorId)` — جهت‌دار، بدون چرخه (اعتبارسنجی در فاز ۶).

### ۲.۸. ActivityTime — زمان نوع‌دار فعالیت
`id`, `activityId`, `timeType` (مطابق `workType` تفکیک دستی/خودکار/انتظار/حرکت/بازرسی/راه‌اندازی/هم‌پوشان)، `value`, `unit`, `basis` (`observed,representative,normal,standard`), `sourceRef` (ارجاع به Observation/فرمول/ورود دستی).

### ۲.۹. Diagram — نمودار
`id`, `projectId`, `kind` (enum: `opc, fpc`), `variant` (`current,proposed`), `title`, `subject` (برای FPC: `material,person,equipment`), `version`, `layoutJson` (چیدمان)، `summaryCache` (تعداد نمادها/زمان/مسافت — مشتق، بازسازی‌پذیر).

### ۲.۱۰. DiagramNode / DiagramEdge
Node: `id`, `diagramId`, `symbol` (OPC: `operation,inspection`; FPC: `operation,transport,inspection,delay,storage`), `stepNo`, `label`, `time`, `distance`, `location`, `activityRef` (اختیاری — اتصال به مدل فعالیت بدون کپی غیرقابل‌ردیابی), `customParams`.
Edge: `id`, `diagramId`, `fromNodeId`, `toNodeId`, `waypointsJson`, `directed=true`.
**اعتبارسنجی:** گام بدون اتصال، اتصال نامعتبر، شناسه تکراری، ترتیب ناسازگار (فاز ۳).

### ۲.۱۱. TimingSession — جلسه زمان‌سنجی
`id`, `projectId`, `method` (`continuous,snapback,laps`), `status` (`running,paused,stopped,finalized`), `observer` (نام ناظر — متن آزاد), `elementsJson` (**اسنپ‌شات عناصر جلسه**: `{key, name, activityStableKey?, order}[]` — هنگام ایجاد ثابت می‌شود؛ پایداری تاریخی رکورد), `elementAdvanceMode` (`manual,auto`), `tolerancePct` (تلورانس TS-005 — فقط روش پیوسته), `elementSource` (`activities|diagram|manual`) + `diagramRefId/diagramRefNote` (ارجاع منبع عناصر در صورت نمودار), `integrityFlagsJson` (پرچم‌های تجمیعی یکپارچگی), `notes`, `startedAtWall/endedAtWall` (زمان دیواری), `deviceMetaJson`, `createdBy`, `createdAt/updatedAt`.
**ناوردایی:** عناصر جلسه پس از ایجاد بازنویسی نمی‌شوند؛ پرچم‌های یکپارچگی فقط انباشته می‌شوند (حذف ندارند).

### ۲.۱۲. TimingEvent — رویداد (append-only)
`id` (UUIDv7 سرور) + `clientEventId` (UUIDv7 کلاینت — **idempotent، یکتا**), `sessionId`, `seq` (ترتیب اکیداً صعودی، یکتا در جلسه), `type` (enum: `start,cycleStart,reading,element,lap,pause,resume,stop,note,correction,finalize`), `elementId?`, `cycleNo`, `elapsedActiveMs` (**زمان فعال یکنواخت** — «قرائت کرنومتر»؛ مکث‌ها جزو آن نیستند), `splitMs?` (بازه از مرز قبلی — snapback/نمایش split), `wallClock` (ISO — صرفاً ممیزی/گزارش), `note`, `interruptionReason?` (علت وقفه در pause), `correctionOf?/correctedValueMs?/correctionReason?` (اصلاح به رویداد قبلی + **دلیل الزامی**، بدون حذف), `integrityJson` (پرچم‌های لحظه ثبت همین رویداد), `origin` (`normal|offline-synced`), `receivedBy/receivedAt`.
**ناوردایی:** رویدادها هرگز فیزیکی حذف/ویرایش نمی‌شوند؛ اصلاح = رویداد جدید با ارجاع (ADR-004). یکتایی: `clientEventId` (جهانی) و `(sessionId, seq)`.

### ۲.۱۳. TimingCycle — چرخه (مشتق؛ ذخیره فقط در نهایی‌سازی)
`id`, `sessionId`, `seq` (یکتا در جلسه), `status` (`valid,suspect,incomplete,recovered`), `startedAtEventId/endedAtEventId`, `startedElapsedMs/endedElapsedMs`, `cycleTimeMs` (زمان چرخه مشاهده‌شده — TS-004), `elementsSumMs`, `deviationPct` (TS-005 — فقط پیوسته؛ در snapback مقدار ندارد), `elementsJson` (مشاهدات عنصر — بند ۲.۱۴), `interruptionsJson` (وقفه‌های pause→resume), `flagsJson`.
**قاعده:** ردیف‌ها **فقط در نهایی‌سازی جلسه** نوشته می‌شوند (پیش از آن «مشتق زنده» از رویدادها هستند)؛ منبع همیشه TimingEvent است و چرخه ذخیره‌شده projection بازتولیدپذیر است (ADR-013).

### ۲.۱۴. ElementObservation — مشاهده عنصر (درون `elementsJson` چرخه)
`elementKey/elementName` (اسنپ‌شات جلسه), `durationMs` (TS-003: تفاضل قرائت‌ها در پیوسته؛ مقدار مستقیم در snapback), `readingEventId` (رویداد قرائت مبنای ردیابی), `readingMode` (`continuous,snapback,laps`), `flags[]` (پرچم‌های یکپارچگی), `corrected` (رویداد correction روی قرائت مبنا اثر کرده).
**قاعده:** علامت‌گذاری پرت ≠ حذف؛ مشاهدات فقط همراه چرخه در نهایی‌سازی ذخیره می‌شوند. فیلدهای تحلیلی مفهومی (`ratingFactor`, `validity` با علت رد) در فاز ۵ به مشتق تحلیل اضافه می‌شوند (تصمیم باز §۶).

### ۲.۱۵. Formula — فرمول
`id`, `configVersionId`, `stableKey`, `semver`, `nameFa`, `exprAst` (AST سریال‌شده DSL)، `scopeLevel` (`observation,element,cycle,cycleSet,group,project,balanceScenario`), `inputContract` (نام‌ها/انواع/واحدها)، `outputUnit`, `status` (`draft,active,deprecated`), `sourceRef`, `assumptions`.

### ۲.۱۶. CalculationResult — نتیجه محاسبه
`id`, `formulaId+formulaVersion`, `configVersionId`, `scopeType/scopeId` (ورودی‌ها)، `inputRefs[]` (شناسه مشاهدات/پارامترها)، `value+unit`, `status` (`valid,invalid,incomplete`), `errorMessages[]`, `traceJson` (مراحل ارزیابی)، `computedAt`, `computedBy`.
**ناوردایی:** قطعی و بازتولیدپذیر برای (ورودی یکسان + نسخه روش یکسان)؛ نتایج قبلی با نسخه جدید بی‌سروصدا جایگزین نمی‌شوند.

### ۲.۱۷. BalanceScenario — سناریوی بالانس
`id`, `projectId`, `name`, `taktTime` یا `demand+netAvailableTime+shifts`, `objectiveWeightsJson`، `algorithm` (`lcr,rpw,kilbridgeWester,manual,…`)، `algorithmVersion`, `solutionJson` (تخصیص فعالیت→ایستگاه + جدول نیرو)، `metrics` (`LB-010..030` — راندمان، تأخیر، حداقل نظری، گلوگاه)، `constraintsReport` (نقض/رعایت قیود)، `status` (`draft,solved,accepted`), `runMs`, `objectiveValue`.
**قاعده:** خروجی همیشه «بهترین راهکار یافت‌شده» مگر بهینگی اثبات‌شده؛ تخصیص دستی مجاز با اعتبارسنجی فوری.

### ۲.۱۸. Report — گزارش
`id`, `projectId`, `kind` (`projectSummary,observationsRaw,elementAnalysis,timeChain,balance,custom`), `templateRef`, `paramsJson` (فیلتر/ترتیب/ستون)، `dataSnapshotRefs` (به‌جای کپی داده)، `methodVersionRefs` (فرمول/پیکربندی)، `generatedAt/by`, `format` (`pdf,csv,xlsx,html`).

### ۲.۱۹. User / Role / AuditLog
User: `id, name, email, authProvider`; Role: `owner,editor,recorder,viewer,admin` (قابل توسعه — ADR-009). AuditLog: `id, userId, action, entityType/Id, before/afterJson, at` — برای حذف/اصلاح اندازه‌گیری و تغییر نسخه‌ها.

## ۳. مرجع حقیقت داده‌ها

| داده | مرجع حقیقت | مشتق/کش |
|---|---|---|
| رویدادهای خام زمان‌سنجی | **TimingEvent** (سرور — append-only/idempotent با `clientEventId`)؛ در حین آفلاین: ژورنال + صف IndexedDB «timing-chrono» صرفاً **بافر** تا همگام‌سازی (ADR-013) | مشتق زنده چرخه/عنصر/وقفه از هسته مشترک `src/shared/timing` (کلاینت ∪ سرور) |
| چرخه‌ها و مشاهدات مشتق | **TimingCycle** — فقط ردیف‌های نوشته‌شده در نهایی‌سازی؛ پیش از آن همیشه مشتق زنده از TimingEvent (ADR-013) | — |
| تعریف پارامتر/فرمول/تنظیمات | **ConfigVersion (append-only — snapshot v2** با خانواده/پارامتر B2 کامل/فرمول با عبارت اجرایی — بند ۷٫۲) | — |
| مقادیر پارامتر | **ParameterValue** (جدول اجراشده فاز ۲ — مقدار جدا از تعریف، گره‌خورده به defVersion؛ بند ۷٫۱) | بافر آفلاین (فاز ۳/۴) |
| زمان‌های نماینده/نرمال/استاندارد و نتایج فرمول | **CalculationResult** (جدول اجراشده فاز ۲ — append-only با نسخه فرمول/پیکربندی/trace؛ بند ۷٫۱) | — |
| خلاصه نمودار | از DiagramNode بازسازی | summaryCache = کش |
| سناریو بالانس | BalanceScenario | — |

## ۴. جداسازی داده پروژه‌ها (زمینه‌ی A5)

۱. هر رکورد دامنه، `projectId` اجباری دارد و همه کوئری‌های سرور با `projectId + مجوز` فیلتر می‌شوند.
۲. `stableKey`ها فقط در فضای پروژه یکتا هستند.
۳. کپی پروژه = ایجاد ConfigVersion جدید از snapshot + کپی انتخابی (داده خام فقط با انتخاب صریح).
۴. AuditLog برای تغییرات بین-پروژه‌ای (کپی/انتقال) مسیر ردیابی دارد.
۵. نمونه آموزشی با برچسب `isDemo` در پروژه جدا و از نتایج واقعی ایزوله است (قاعده فاز ۱ سند جامع).

## ۵. راهبرد مهاجرت داده (چشم‌انداز)

- Prisma Migrate برای توسعه؛ `db push` ممنوع در محیط واقعی از فاز ۱ به بعد.
- هر تغییر schema با اسکریپت مهاجرت + تست رگرسیون «تعریف پارامتر/فرمول» (C2).
- استراتژی EAV-JSON برای پارامترهای پویا (ADR-010) به معنای عدم نیاز به مهاجرت ستونی برای هر پارامتر جدید است؛ مهاجرت فقط برای تغییر семانتیک تعریف‌ها با تبدیل صریح و ثبت در AuditLog.

## ۶. تصمیم‌های باز (برای فازهای بعد)

| موضوع | وضعیت |
|---|---|
| تفکیک فیزیکی جدول‌ها در SQLite به‌ازای موجودیت | نهایی در فاز ۱ همراه اولین Prisma schema اجرایی |
| فرمت دقیق `traceJson` | ✅ قفل شد در فاز ۲: گام‌های `{nodeId, op, value, unit}` با سقف ۲۵۶ گام (بند ۷٫۱) |
| ساختار `solutionJson` بالانس | در فاز ۶ همراه الگوریتم‌ها |
| فیلدهای تحلیلی مشاهده (`ratingFactor`, `validity` با علت رد) | فاز ۵ — روی TimingCycle/ElementObservation در مشتق تحلیل |

## ۷. فاز ۲ — پیاده‌سازی (۳۱ اکتبر ۲۰۲۶)

> سه جدول جدید با Prisma Migrate (نه db push) در مهاجرت `20261031072638_phase2_params_results_activities` ساخته شد. این بند ساختار **مطابق اجرا** را ثبت می‌کند؛ تعاریف مفهومی بندهای ۲٫۶ / ۲٫۷ / ۲٫۱۶ همچنان معتبرند.

### ۷٫۱. جدول‌های اجراشده

#### ParameterValue — مقدار پارامتر (بند ۲٫۶ اجرا شد)

| فیلد | نوع/پیش‌فرض | توضیح |
|---|---|---|
| `id` | UUIDv7 | شناسه پایدار |
| `projectId` | ref → Project | جداسازی پروژه (Cascade) |
| `stableKey` | متن | شناسه فنی پارامتر در snapshot پیکربندی (بدون FK به جدول تعریف — تعریف در snapshot زندگی می‌کند) |
| `defVersion` | int | نسخه تعریف لحظه ثبت — مقدار به آن گره خورده؛ تبدیل پنهانی ممنوع (ADR-005/010) |
| `scopeType` | متن، پیش‌فرض `"project"` | در فاز ۲ فقط دامنه `project` فعال است؛ `session/cycle/observation/activity` در ساختار آماده‌اند (فاز ۴+) |
| `scopeId` | متن، پیش‌فرض `""` | شناسه رکورد دامنه؛ برای `project` رشته خالی است (یکتایی SQLite با NULL برقرار نمی‌شود) |
| `valueJson` | متن (JSON) | `{"value": …, "unit": …}` — مقدار نوع‌دار + واحد |
| `recordedBy` / `recordedAt` / `updatedAt` | — | ثبت‌کننده و زمان ثبت/به‌روزرسانی |

**یکتایی:** `@@unique([projectId, stableKey, scopeType, scopeId])` — یک مقدار به‌ازای (پارامتر × دامنه) در هر پروژه؛ ثبت مجدد همان مقدار را به `defVersion` جدید می‌کِشد (pin) و `recordedAt/updatedAt` را تازه می‌کند.

#### CalculationResult — نتیجه محاسبه (بند ۲٫۱۶ اجرا شد)

| فیلد | نوع/پیش‌فرض | توضیح |
|---|---|---|
| `id` | UUIDv7 | — |
| `projectId` | ref → Project | — |
| `formulaKey` / `formulaSemver` | متن | کلید و نسخه فرمول در snapshot (مثل `TS-011` یا `f.myFormula`) |
| `configVersionId` | متن | نسخه پیکربندی مبنای محاسبه (ارجاع منطقی به ConfigVersion) |
| `scopeType` / `scopeId` | متن، پیش‌فرض `"project"` / `""` | فاز ۲: فقط project |
| `valueJson` | متن؟ (JSON) | `{"value": …, "unit": …}` — فقط وقتی `valid/incomplete` |
| `status` | متن | `valid` \| `invalid` \| `incomplete` |
| `errorsJson` | متن؟ (JSON) | فهرست `{code, messageFa}` |
| `traceJson` | متن (JSON) | گام‌های `{nodeId, op, value, unit}` — سقف ۲۵۶ گام |
| `inputRefsJson` | متن (JSON) | شناسه ورودی‌های مصرف‌شده (stableKey پارامترها/فرمول‌ها) |
| `computedBy` / `computedAt` | — | محاسبه‌کننده و زمان |

**ناوردایی:** **append-only** — هر «محاسبه» رکورد جدید است؛ رکورد قبلی جایگزین/حذف نمی‌شود و UI **آخرین نتیجه هر فرمول** را نمایش می‌دهد (تاریخچه از طریق کوئری باقی می‌ماند). ایندکس: `(projectId, formulaKey)` و `(projectId, computedAt)`.

#### Activity — فعالیت/عنصر کاری (بند ۲٫۷ اجرا شد)

| فیلد | نوع/پیش‌فرض | توضیح |
|---|---|---|
| `id` | UUIDv7 | — |
| `projectId` | ref → Project | **`@@unique([projectId, stableKey])`** — یکتایی در فضای پروژه |
| `stableKey` / `name` / `description` | متن | شناسه فنی پایدار / نام / توضیح اختیاری |
| `workType` | متن، پیش‌فرض `"operatorManual"` | ۷ نوع (B5): `operatorManual` \| `machineAuto` \| `waiting` \| `transport` \| `inspection` \| `setupChangeover` \| `overlap` |
| `vaClassification` | متن؟ | `valueAdded` \| `nonValueAdded` \| `essentialNonVA` — **nullable؛ فقط با تأیید صریح کاربر** ثبت می‌شود (UI انتخاب پیش‌فرض ندارد) |
| `constraintsJson` | متن؟ (JSON) | محدودیت‌های تخصیص (ایستگاه مجاز/تجهیز/مهارت) |
| `stationHint` / `skillRequired` | متن؟ | ایستگاه پیشنهادی / مهارت لازم |
| `sourceOfTime` | متن، پیش‌فرض `"measured"` | `measured` \| `estimated` \| `referenced` |
| `order` / `archived` | int / بولی | ترتیب نمایش / بایگانی منطقی (حذف فیزیکی ندارد) |
| `createdBy` / `createdAt` / `updatedAt` | — | — |

**تولید اولیه:** هنگام ایجاد پروژه، `elementTemplates` مدل فعالیت snapshot با `instantiateActivityTemplates` به رکوردهای مستقل کپی می‌شود (کپی مستقل — ADR-005).

### ۷٫۲. Snapshot پیکربندی v2 (`ProjectConfigSnapshot`)

قرارداد نوع در `src/shared/contracts/snapshot.ts` (مشترک بین‌ماژولی) و معناشناسی/اعتبارسنجی در `src/modules/config/domain/` (zod + ناوردایی‌ها). ساختار:

| بخش | محتوا |
|---|---|
| `snapshotVersion` | `"2"` |
| `meta` | `templateId/templateVersion/instantiatedAt` + `upgradedFromV1?` (نشانه ارتقای نمایندگی) + `excludedFamilies/parameterOverrides` (پریز ایجاد) |
| `families[]` | خانواده با `stableKey/nameFa/order/archived` + **`parameters[]` کامل B2**: هر ۱۴ نوع داده، `defVersion`، `archived`، min/max/precision/rounding/unit/options، `visibilityCondition/requiredCondition` (عبارت DSL)، `computedFormulaKey`، `displayContexts`، `customAttrs` |
| `formulas[]` | فرمول با `key/semver/scopeLevel/status` + **`expr` (عبارت DSL) + `ast` (سریال) + `inputContract`** + `origin: system\|custom` + `sourceRef/assumptionsFa/availabilityNoteFa` (برچسب صداقت مانند «نیازمند داده مشاهدات فاز ۴») |
| `activityModel` | `workTypes[]` (۷ نوع) + `elementTemplates[]` (قالب عنصر لحظه ایجاد) + `notesFa` |
| `timingMethod?` / `analysisChain[]` / `reportTemplates[]` | روش پیش‌فرض زمان‌سنجی / زنجیره تحلیل / قالب گزارش |

### ۷٫۳. سیاست ارتقای v1→v2 (نمایندگی هنگام خواندن)

- snapshotهای v1 فاز ۱ (پروفایل‌های instantiated) **در حافظه** با `readSnapshotAsV2` به نمای v2 خوانده می‌شوند: **فقط تغییر نمایندگی** — واحدهای legacy نرمال می‌شوند (مثل `%` → `percent`)، `defVersion = 1` فرض می‌شود، و فرمول‌های ارجاعی بدون عبارت اجرایی یادداشت صادقانه `availabilityNoteFa` («بدون عبارت اجرایی») می‌گیرند.
- **هیچ مقداری تبدیل نمی‌شود**؛ مقادیر ثبت‌شده به `defVersion` لحظه ثبت گره می‌مانند (بدون تبدیل پنهانی).
- **نوشتن همیشه نسخه جدید append-only می‌سازد** — snapshot v1 در DB هرگز بازنویسی نمی‌شود (مهاجرت انبوه انجام نشد؛ سازگار خوانده می‌شود — ADR-011).

---

## ۸. فاز ۳ — پیاده‌سازی نمودارها (۳۱ اکتبر ۲۰۲۶)

### ۸٫۱. موجودیت‌های جدید

| موجودیت | جدول | شرح | کلیدها |
|---|---|---|---|
| **Diagram** | `Diagram` | سند نمودار فرایندی OPC/FPC یک پروژه | `id` (UUIDv7) · `projectId` · `kind` (opc/fpc) · `variant` (current/proposed) · `variantOfId` (ارجاع نسخه فعلی برای proposed) · `subject` (فقط FPC: material/person/equipment) · `status` (draft/confirmed/archived) · `currentRev` |
| **DiagramRevision** | `DiagramRevision` | نسخه append-only سند — هر ذخیره یک رکورد | `diagramId+revNo` (یکتا) · `docJson` (مدل معنایی DiagramDoc) · `layoutJson` (چیدمان — جدا از معنا) · `validationJson` (گزارش لحظه ذخیره) · `appliedSuggestionsJson` (ردیابی پیشنهادهای دستیار) · `origin` (normal/offline-synced) · `clientOpId` (idempotency آفلاین) |

### ۸٫۲. تکمیل موجودیت Activity (B5)

فیلد جدید: `predecessorsJson` — آرایه stableKey فعالیت‌های مقدم (تقدم/تأخر). اعتبارسنجی در دامنه خالص: ارجاع موجود + بدون خودارجاعی/تکرار + بدون چرخه (DFS). مصرف‌کننده اصلی: بالانس خط فاز ۶.

### ۸٫۳. مرجع حقیقت و ردیابی (A7)

- هر نتیجه اعتبارسنجی/خلاصه → از `docJson` نسخه مشخص revision قابل بازتولید (`validationJson` شاهد ذخیره‌شده).
- مرجع فعالیت گره نمودار = `activityStableKey` (ارجاع، نه کپی) — تغییر فعالیت در نمودار反映 نمی‌شود مگر با ارجاع زنده نمایشی.
- پیشنهادهای اعمال‌شده دستیار در `appliedSuggestionsJson` هر revision با شناسه/نسخه/عنوان ثبت می‌شوند (قابلیت ردیابی B7).

### ۸٫۴. داده سمت کاربر (خارج از DB سرور)

- `IndexedDB «timing-diagrams»` — فروشگاه‌های `drafts` (پیش‌نویس نمودار فعال برای بازیابی پس از reload) و `queue` (صف ذخیره آفلاین با کلید `clientOpId` idempotent) — ADR-006/012.

---

## ۹. فاز ۴ — پیاده‌سازی (۳۱ اکتبر ۲۰۲۶)

> سه جدول با Prisma Migrate (نه db push) در مهاجرت `20261031140432_phase4_timing_sessions_events_cycles` ساخته شد. بندهای ۲.۱۱–۲.۱۴ بالا مطابق اجرا به‌روز شدند؛ این بند جزئیات اجرا، داده سمت کاربر و ممیزی را ثبت می‌کند. معناشناسی/اعتبارسنجی در `src/modules/timing/domain`، قواعد مشتق در هسته مشترک `src/shared/timing/` (ADR-004/013).

### ۹٫۱. جدول‌های اجراشده

#### TimingSession — جلسه زمان‌سنجی (بند ۲.۱۱ اجرا شد)

| فیلد | نوع/پیش‌فرض | توضیح |
|---|---|---|
| `id` | UUIDv7 | شناسه پایدار |
| `projectId` | ref → Project | جداسازی پروژه (Cascade) — ایندکس `(projectId,status)` و `(projectId,createdAt)` |
| `method` | متن | `continuous` \| `snapback` \| `laps` (TimingMethod — هسته مشترک) |
| `status` | متن، پیش‌فرض `"running"` | `running` \| `paused` \| `stopped` \| `finalized` (قفل پس از نهایی‌سازی) |
| `observer` | متن | نام ناظر (متن آزاد) |
| `elementsJson` | متن (JSON) | اسنپ‌شات عناصر جلسه: `{key, name, activityStableKey?, order}[]` — هنگام ایجاد ثابت (پایداری تاریخی) |
| `elementAdvanceMode` | متن، پیش‌فرض `"manual"` | `manual` (انتخاب عنصر در هر ثبت) \| `auto` (پیش‌روی خودکار به ترتیب) |
| `tolerancePct` | REAL، پیش‌فرض `5` | تلورانس TS-005 — فقط روش پیوسته |
| `elementSource` | متن، پیش‌فرض `"activities"` | `activities` \| `diagram` \| `manual` + `diagramRefId/diagramRefNote?` (ارجاع، نه کپی) |
| `integrityFlagsJson` | متن؟ (JSON) | پرچم‌های تجمیعی یکپارچگی جلسه |
| `notes` / `startedAtWall` / `endedAtWall` / `deviceMetaJson` | — | یادداشت / زمان دیواری شروع و پایان / فراداده دستگاه |
| `createdBy` / `createdAt` / `updatedAt` | — | — |

#### TimingEvent — رویداد (append-only — بند ۲.۱۲ اجرا شد)

| فیلد | نوع/پیش‌فرض | توضیح |
|---|---|---|
| `id` | UUIDv7 (سرور) | — |
| `sessionId` | ref → TimingSession | ایندکس `(sessionId,seq)` و `(sessionId,type)` |
| `clientEventId` | متن | UUIDv7 تولید کلاینت (RFC 9562) — **یکتای جهانی = idempotency** (هم‌زمان یکتا در جلسه) |
| `seq` | int | ترتیب درون جلسه — **یکتا `(sessionId,seq)`** |
| `type` | متن | `start` \| `cycleStart` \| `reading` \| `element` \| `lap` \| `pause` \| `resume` \| `stop` \| `note` \| `correction` \| `finalize` |
| `elementId?` / `cycleNo` | متن؟ / int | عنصر مرتبط / شماره چرخه جاری (۰ = پیش از چرخه اول) |
| `elapsedActiveMs` | REAL | زمان فعال یکنواخت (ADR-004) — مکث‌ها جزو آن نیست |
| `splitMs?` | REAL؟ | بازه از مرز قبلی (cycleStart/element/lap) |
| `wallClock` | DATETIME | زمان دیواری — صرفاً ممیزی/گزارش |
| `note` / `interruptionReason?` | متن؟ | یادداشت / علت وقفه (pause) |
| `correctionOf?` / `correctedValueMs?` / `correctionReason?` | متن؟ / REAL؟ / متن؟ | اصلاح رویداد قبلی با مقدار و **دلیل الزامی** — بدون حذف |
| `integrityJson?` | متن؟ (JSON) | پرچم‌های یکپارچگی لحظه ثبت (`visibilityLoss/sleepSuspected/clockRecovery`) |
| `origin` | متن، پیش‌فرض `"normal"` | `normal` \| `offline-synced` (ردپای همگام‌سازی آفلاین — ADR-013) |
| `receivedBy` / `receivedAt` | — | پذیرنده و زمان پذیرش در سرور |

#### TimingCycle — چرخه مشتق (بند ۲.۱۳ اجرا شد)

| فیلد | نوع/پیش‌فرض | توضیح |
|---|---|---|
| `id` | UUIDv7 | — |
| `sessionId` | ref → TimingSession | **یکتا `(sessionId,seq)`** + ایندکس `(sessionId,status)` |
| `seq` | int | شماره چرخه (۱-مبنا) |
| `status` | متن | `valid` \| `suspect` (تلورانس TS-005) \| `incomplete` \| `recovered` |
| `startedAtEventId` / `endedAtEventId?` | متن | رویدادهای مرز چرخه (ردیابی) |
| `startedElapsedMs` / `endedElapsedMs?` / `cycleTimeMs?` | REAL | مرزهای فعال / زمان چرخه مشاهده‌شده (TS-004) |
| `elementsSumMs` / `deviationPct?` | REAL / REAL؟ | جمع مدت عناصر / انحراف TS-005 (فقط پیوسته؛ snapback = null) |
| `elementsJson` | متن (JSON) | `ElementObservation[]` (بند ۲.۱۴) |
| `interruptionsJson` | متن (JSON) | وقفه‌های چرخه (`reason`, `durationMs|null`, `durationUnknown`, پرچم‌ها) |
| `flagsJson?` | متن؟ (JSON) | پرچم‌های یکپارچگی چرخه |

**قاعده ذخیره:** فقط در `finalize` (که خود فقط پس از `stop` مجاز است) نوشته می‌شود؛ پس از آن جلسه قفل است (رویداد جدید → 409) — ADR-013.

### ۹٫۲. داده سمت کاربر (خارج از DB سرور)

- `IndexedDB «timing-chrono»` — سه فروشگاه: `sessions` (فراداده + عناصر برای بازکردن آفلاین)، `events` (ژورنال append-only، کلید `clientEventId`)، `queue` (صف همگام‌سازی؛ flush batch حداکثر ۲۰۰ رویداد) — ADR-006/013. بازیابی پس از reload از **اجتماع (رویدادهای سرور ∪ ژورنال محلی)** با `reconstruct()` انجام می‌شود.

### ۹٫۳. ممیزی (فاز ۴)

- فقط سه اکشن: `timing.session-created`، `timing.session-finalized`، `timing.event-corrected` — رویدادهای معمول قرائت ممیزی نمی‌شوند (تصمیم ADR-013؛ خود TimingEvent رکورد تغییرناپذیر با `receivedBy/receivedAt` است).
