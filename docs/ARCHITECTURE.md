# معماری نرم‌افزار (ARCHITECTURE)

**نسخه:** ۱٫۰ (فاز صفر) — **تاریخ:** ۲۹ اکتبر ۲۰۲۶
**دستورات مرجع:** بخش A6/A7/A8 و C سند جامع؛ ADR-001 تا ADR-010.

---

## ۱. سبک معماری: Modular Monolith

**تصمیم (ADR-001):** یک اپلیکیشن یکپارچه با مرزهای ماژول صریح در سطح کد و قرارداد. میکروسرویس در این مقیاس (یک تیم، آفلاین-محور، داده پروژه‌محور) سربار عملیاتی بی‌دلیل دارد؛ سبک انتخابی هم جداسازی منطقی می‌دهد، هم استقرار/تست را ساده نگه می‌دارد. مرزهای آینده‌نگر برای جداسازی سرویس (در صورت رشد) در لایه Application هر ماژول حفظ می‌شود.

### ۱٫۱. لایه‌های هر ماژول (قاعده وابستگی یک‌طرفه)

```
UI (components)  →  Application (services/قراردادها)  →  Domain (منطق خالص)
                            ↓
                     Infrastructure (Prisma, IndexedDB, APIs)
```

- **Domain:** توابع خالص، بدون وابستگی به فریم‌ورک و I/O — واحد/بالانس/فرمول/آمار. ✅ آزمون‌پذیر بدون مرورگر.
- **Application:** casos استفاده، تراکنش، مجوزسنجی، هماهنگی. فقط از طریق **این لایه** ماژول‌های دیگر فراخوانی می‌شوند.
- **Infrastructure:** Prisma (سرور)، IndexedDB (کلاینت)، صف همگام‌سازی.
- **UI:** فقط نمایش/فراخوانی Application؛ منطق دامنه در UI ممنوع.

### ۱٫۲. نقشه ماژول‌ها و قاعده وابستگی

```
src/
├── app/                       # مسیرها (App Router) — فقط ترکیب UI
├── modules/
│   ├── identity/              # هویت، نقش‌ها، مجوزها
│   ├── projects/              # پروژه‌ها، نسخه پیکربندی، کپی/بایگانی
│   ├── profiles/              # الگوهای پروفایل (فقط‌خواندنی سراسری)
│   ├── parameters/            # خانواده‌ها، تعریف/مقدار پارامتر
│   ├── formula/               # Parser/AST، ارزیاب، گراف وابستگی
│   ├── process/               # مدل فعالیت و تقدم/تأخر
│   ├── diagrams/              # OPC/FPC: مدل، اعتبارسنجی، ویرایشگر
│   ├── assistant/             # دستیار آفلاین (قواعد + کتابخانه دانش + لایه مدل اختیاری)
│   ├── chronometer/           # موتور کرنومتر (خالص) + رابط رویدادها
│   ├── observations/          # جلسه/چرخه/مشاهده، صف آفلاین، همگام‌سازی
│   ├── analysis/              # آمار، زنجیره زمان، کفایت نمونه
│   ├── balance/              # الگوریتم‌ها، سناریو، شاخص‌ها
│   └── reporting/             # قالب‌ها، تولید خروجی
└── shared/                    # انواع مشترک، واحدها، ابزار خالص، قراردادهای تبادل
```

**قواعد:**
۱. وابستگی فقط رو به پایین و به `shared`؛ هیچ وابستگی حلقوی (تأیید با ESLint import rules از فاز ۱).
۲. ارتباط بین‌ماژولی فقط از لایه Application و از طریق **پورت‌های تعریف‌شده در `shared/contracts`**.
۳. `formula` به `parameters` فقط از طریق قرارداد «Resolver مقدار» وابسته است (نه Prisma).
۴. `chronometer` کاملاً مستقل از فریم‌ورک است (خالص + timestamp تزریقی برای آزمون).
۵. `balance` فقط مدل Activity + اعداد زمان می‌گیرد؛ به UI/schema وابسته نیست.

### ۱٫۳. قراردادهای تبادل کلیدی (نمای TypeScript)

```ts
// shared/contracts
interface ParamValueResolver { (stableKey: string, scope: ScopeRef): number | string | boolean | null }
interface FormulaEvalInput { values: ParamValueResolver; aggregates: AggregateProvider; units: UnitRegistry }
interface TimingEventSink { append(event: ChronoEvent): Promise<void> }        // ثبت بادوام
interface ActivityGraph { nodes(): Activity[]; edges(): PrecedencePair[] }
interface BalanceProblem { activities; times: Map<activityId, number>; takt: number; zones?: string[]; precedences }
interface BalanceSolution { assignments; metrics; constraintsReport; runMs; algorithmVersion }
interface SyncQueue { enqueue(op: IdempotentOp): void; flush(): Promise<SyncReport> }
```

## ۲. مدل کنترل دسترسی (ADR-009)

- **RBAC در سطح پروژه:** `owner` (همه)، `editor` (پیکربندی/داده)، `recorder` (فقط ثبت مشاهدات)، `viewer` (فقط گزارش‌ها).
- احراز هویت: NextAuth (Credentials + امکان افزودن پرووایدر) از فاز ۱.
- **هر API route** قبل از هر عملیاتی: (۱) session، (۲) نقش کاربر در `projectId`، (۳) فیلتر کوئری با `projectId` — مجوزسنجی سمت سرور الزامی؛ مخفی‌سازی UI کافی نیست.
- الگوی پیروی: OWASP Multi-Tenant Cheat Sheet (شناسه مستأجر در هر کوئری، عدم اتکا به id 序 ترتیبی، لاگ دسترسی).
- AuditLog برای عملیات حساس (حذف منطقی، اصلاح مشاهده، تغییر نسخه فرمول، کپی پروژه).

## ۳. رویکرد نسخه‌بندی (ADR-005)

| چه چیزی | سازوکار |
|---|---|
| پیکربندی پروژه (خانواده/پارامتر/فرمول/تنظیمات) | `ConfigVersion` **append-only** با semver و snapshotJson |
| تعریف پارامتر | `defVersion` داخل تعریف؛ مقادیر به نسخه لحظه ثبت گره می‌خورند |
| فرمول | `semver` مستقل + وضعیت draft/active/deprecated |
| الگوی پروفایل | semver؛ کپی لحظه ایجاد (Copy-on-Instantiate) |
| نتیجه محاسبه | ارجاع به (فرمول نسخه + configVersion + inputRefs) |
| نتایج قبلی | هرگز بی‌سروصدا جایگزین نمی‌شوند؛ «محاسبه مجدد» = رکورد جدید با نسخه جدید |

**مهاجرت داده:** Prisma Migrate (نه db push) از فاز ۱؛ هر مهاجرت با تست رگرسیون تعریف/فرمول؛ تغییرات semانتیک تعریف‌ها با تبدیل صریح + AuditLog (بدون تبدیل پنهانی).

## ۴. مدیریت تعارض آفلاین (ADR-006)

**وضعیت‌ها:** `local-only → queued → synced / conflict / rejected`.

۱. هر عملیات آفلاین **کلید idempotent** دارد (`clientOpId` — UUIDv7) → retry/کلیک تکراری، ثبت دوباره ایجاد نمی‌کند.
۲. صف آفلاین در IndexedDB با ترتیب عمدی: رویداد زمان‌سنجی > مقادیر پارامتر > توصیه‌ها.
۳. خط‌مشی تعارض:
   - رویدادهای زمان‌سنجی: **append-only و هرگز بازنویسی** → تعارض عملی ندارند؛ فقط دوباره‌ارسال dedup می‌شود.
   - مقادیر پارامتر/تخصیص سناریو: نسخه‌دار با `updatedAt`؛ در تعارض → وضعیت `conflict` + نمایش دو مقدار به کاربر برای تصمیم صریح (بدون ادعای همگام‌سازی موفق خودکار).
   - نسخه‌های Config: فقط در حالت آنلاین قابل ایجاد (قفل خوش‌نودانه ساده).
۴. UI وضعیت واقعی را نشان می‌دهد: آفلاین/در صف/همگام/تعارض/بازیابی‌شده.
۵. اتصال از طریق Service Worker + Background Sync (در حد پشتیبانی مرورگر) و در غیر این صورت flush دستی/خودکار هنگام بازگشت آنلاین.

## ۵. استراتژی تست‌پذیری

| لایه | ابزار | دامنه |
|---|---|---|
| Domain خالص (formula, chronometer, balance, analysis, units) | Bun test + داده مرجع مستقل | قطعیت، مرزی، اعداد مرجع |
| Application/Integration | تست API درخواست-پاسخ + SQLite آزمایشی | مجوزها، جداسازی پروژه، نسخه‌بندی |
| رگرسیون | سناریوهای ثابت داده مرجع | تغییر تعریف/فرمول |
| E2E | Agent Browser / Playwright (فاز ۷) | مسیر کامل ایجاد→گزارش |
| آفلاین | شبیه‌سازی قطع شبکه + reload | صف، تعارض، بازیابی |
| RTL/UI | بازبینی وایرفریم + فاز ۷ | دسترس‌پذیری و RTL |

قاعده: توابع دامنه به زمان سیستم واقعی وابسته نیستند (ساعت/تصادف تزریقی).

## ۶. ماتریس تصمیم فناوری

معیارها (وزن): تجربه توسعه (۲)، اکوسیستم (۲)، نگهداری (۲)، آفلاین (۳)، اجرای مدل محلی (۱)، عملکرد نمودار (۲)، پایداری ذخیره‌سازی (۲)، استقرار (۲)، هزینه (۲). نمره ۱–۵.

| گزینه | تجربه | اکوسیستم | نگهداری | آفلاین | مدل محلی | نمودار | ذخیره | استقرار | هزینه | **جمع وزنی** |
|---|---|---|---|---|---|---|---|---|---|---|
| **Next.js 16 + React 19 + TS** | ۵ | ۵ | ۵ | ۵ (PWA/SW) | ۴ (WebGPU در دسترس) | ۵ | ۵ | ۵ | ۴ | **۸۹ / ۹۰** |
| Vue 3 + Nuxt | ۴ | ۴ | ۴ | ۴ | ۴ | ۴ | ۴ | ۴ | ۴ | ۷۳ |
| Angular 19 | ۳ | ۳ | ۴ | ۴ | ۳ | ۳ | ۴ | ۴ | ۳ | ۶۲ |
| SPA خالص (Vite+React) | ۴ | ۴ | ۴ | ۴ | ۴ | ۵ | ۴ | ۳ | ۴ | ۷۱ |
| Electron (دسکتاپ) | ۲ | ۳ | ۲ | ۵ | ۵ | ۴ | ۵ | ۲ | ۱ | ۶۴ |

**انتخاب: Next.js 16 (App Router) + TypeScript 5 + Tailwind CSS 4 + shadcn/ui.**
دلایل کلیدی (ADR-002): RSC برای بار اولیه سبک، مسیر API یکپارچه برای مجوزسنجی سرور، اکوسیستم React Flow/Recharts برای ویرایشگر و نمودار، PWA بالغ، تناسب با تیم/میزبان و پشتیبانی WebGPU برای لایه اختیاری مدل محلی.

| زیرسیستم | گزینه‌ها | انتخاب | دلیل |
|---|---|---|---|
| ORM/DB | Prisma+SQLite / Drizzle+PG / TypeORM | **Prisma + SQLite** | مهاجرت امن، نوع‌دهی قوی، کافی برای تک-استقرار؛ PostgreSQL در ADR-005 به‌عنوان مسیر رشد ثبت شد |
| State | Redux / Zustand / Jotai | **Zustand** | سبک، بدون boilerplate؛ سرور-state با TanStack Query |
| فرم | فرم دستی / react-hook-form | **react-hook-form + zod** | اعتبارسنجی هم‌زمان UI/سرور با یک schema |
| نمودار داده | ECharts / Recharts / D3 خام | **Recharts (پایه) + SVG اختصاصی برای Yamazumi** | RTL ساده، اندازه معقول؛ Yamazumi سفارشی دقیق‌تر است |
| ویرایشگر نمودار (فاز ۳) | React Flow / GoJS / RAF之手 | **@xyflow/react v12** | متن‌باز MIT، RTL قابل پیاده‌سازی، export قابل کنترل (ADR-007) |
| موتور فرمول (فاز ۲) | mathjs / jsep / پارسر اختصاصی | **پارسر اختصاصی (الهام‌گرفته از الگوی jsep)** | کنترل کامل عملگرها/امنیت/واحدها؛ بدون سطح حمله mathjs (ADR-003) |
| خروجی | ExcelJS / SheetJS + PDF (Print CSS) | **CSV+XLSX (SheetJS-گونه) + PDF چاپ-سبک** | RTL فارسی در چاپ CSS مطمئن‌تر از PDF-جنی‌راتورهای لاتین‌محور است (بازبینی فاز ۵) |

نسخه‌های راستی‌آزمایی‌شده (npm، ۲۰۲۶-۱۰-۲۹): next 16.4.3 · react 19.3.1 · tailwindcss 4.3.3 · @xyflow/react 12.12.0 · zustand 5.0.16 · zod 4.6.7 · recharts 3.10.1 · @prisma/client 7.10.1 (پایدار؛ prisma CLI 8.0.0-rc → در فاز ۱ از کانال پایدار نصب می‌شود)

## ۷. قابلیت آفلاین و PWA

- Service Worker با استراتژی precache دارایی‌ها + network-first برای API داده (با بافر IndexedDB).
- IndexedDB (Dexie-گونه یا خام) برای: صف عملیات، جلسه فعال، کش پروژه فعال.
- عملیات مجاز آفلاین: ثبت رویداد/مشاهده، مشاهده پروژه فعال، ویرایش نمودار محلی (فاز ۳+).
- عملیات نیازمند سرور: ایجاد ConfigVersion، مدیریت کاربر، گزارش‌های سرور-محور.
- وضعیت آفلاین همیشه صادقانه نمایش داده می‌شود (حتی وقتی مدل زبانی محلی در دسترس نیست: «قواعد آفلاین فعال؛ مدل زبانی محلی غیرفعال»).

## ۸. امنیت

- اعتبارسنجی ورودی همه API با zod؛ خطاها بدون افشای ساختار داخلی.
- فرمول‌ها با DSL امن (بدون eval/Function) — ADR-003.
- رازها فقط در متغیر محیطی؛ هرگز در مخزن/لاگ.
- AuditLog عملیات حساس؛ CORS محدود به همان مبدأ.
- مرور آسیب‌پذیری وابستگی‌ها در فاز ۷ (npm audit + بازبینی دستی).

## ۹. ریسک‌های معماری ثبت‌شده

| ریسک | اثر | کاهش |
|---|---|---|
| کاهش دقت تایمر در تب پس‌زمینه/خواب | خطای زمان | ADR-004: monotonic + پرچم کیفیت + نمایش «نیازمند بررسی» |
| رشد snapshotJson پیکربندی | کارایی | فشرده‌سازی + نگهداری نسخه‌های مرجع فقط در تغییر واقعی |
| تعارض همگام‌سازی در ثبت طولانی آفلاین | از دست رفتن داده | کلید idempotent + صف + تصمیم صریح کاربر |
| WebGPU در دسترس نبودن | لایه دستیار | مسیر جایگزین قواعد-محور (لایه الف) |
| RTL در کتابخانه‌های نمودار | جهت معکوس | تست RTL اختصاصی + اجزای سفارشی Yamazumi |

---

## ۹. وضعیت پیاده‌سازی فاز ۱ (به‌روزرسانی ۳۱ اکتبر ۲۰۲۶)

### ۹٫۱. ساختار اجراشده

```
src/
├── app/                    # page.tsx (SPA تک‌نما) + api/** (۱۳ route)
├── modules/
│   ├── identity/           # ✅ فاز ۱ — auth-service، session، nextauth، user-repo
│   ├── projects/           # ✅ فاز ۱ — project-service (CRUD/بایگانی/تکثیر/اعضا)، repo، domain
│   ├── profiles/           # ✅ فاز ۱ — domain + definitions (۷ پروفایل) + service
│   ├── audit/              # ✅ فاز ۱ — audit-service + repo
│   └── (parameters/formula/process/…)  # ⏳ فازهای ۲ به بعد
├── shared/
│   ├── contracts/acl.ts    # منبع واحد نقش/مجوز (سرور + UI)
│   ├── contracts/api.ts    # DTOهای فاز ۱
│   ├── validation/project.ts # zod — مشترک UI/سرور
│   ├── errors.ts · logger.ts · http.ts · ids.ts (UUIDv7)
└── components/app/**       # UI فاز ۱ (بدون منطق دامنه)
```

### ۹٫۲. اجرای قواعد مرزها (R1-4)

قواعد §۱٫۲ با اسکریپت `scripts/check-module-boundaries.mjs` قفل شد (اجرای CI/dev):
- domain → فقط shared؛ application → ماژول خودش + application ماژول‌های دیگر + `lib/db` (تراکنش)؛
- infrastructure → فقط ماژول خودش + shared + `lib/db`؛ دسترسی بین‌ماژولی به زیرساخت دیگر ممنوع؛
- UI → فقط shared + lib کلاینت (هیچ import از modules)؛ API → فقط application (+ استثنای مستند آداپتور NextAuth برای route احراز هویت)؛
- کشف چرخه در سطح فایل و ماژول با DFS.
- **یال‌های بین‌ماژولی فعلی:** identity→audit · projects→identity · projects→profiles · projects→audit (یک‌طرفه).

### ۹٫۳. تصمیم‌های ثبت‌شده فاز ۱

| موضوع | تصمیم |
|---|---|
| نسخه‌بندی اجرا | Prisma Migrate (`db push` ممنوع) — پوشه `prisma/migrations/` بخشی از مخزن |
| تراکنش‌ها | `db.$transaction` در لایه Application (ریپوها کلاینت tx می‌پذیرند) — ثبت شد در §۹٫۲ |
| تکثیر پروژه | ساختار+پیکربندی کپی، اعضا نه؛ ممیزی روی هر دو پروژه (مبدأ/مقصد) |
| snapshot | ساختار `ProfileSnapshot` (meta+content) — فاز ۲ همان را ویرایش/نسخه می‌کند |
| نمایش myRole | محاسبه در DTO بر اساس عضویت «کاربر درخواست‌کننده» (نه اولین عضو) |
| UUIDv7 | تولید در Application (RFC 9562) برای همه موجودیت‌ها |

---

## ۱۰. وضعیت پیاده‌سازی فاز ۲ (به‌روزرسانی ۳۱ اکتبر ۲۰۲۶)

### ۱۰٫۱. ساختار اجراشده

```
src/
├── app/                        # page.tsx + api/** (۲۴ route — از ۱۳ در فاز ۱)
│   └── api/
│       ├── formula/functions           # GET فهرست ۲۲ تابع DSL (UI)
│       └── projects/[id]/
│           ├── config                  # GET پیکربندی جاری (snapshot v2)
│           ├── config/versions         # GET تاریخچه نسخه‌ها
│           ├── config/formulas/validate# POST اعتبارسنجی زنده عبارت
│           ├── config/export|import    # خروجی/درون‌ریزی JSON (dryRun → apply)
│           ├── values                  # GET/PUT مقدار پارامتر (دامنه project)
│           ├── formulas/evaluate       # POST محاسبه + ذخیره نتیجه نسخه‌دار
│           ├── formulas/results        # GET نتایج (آخرین هر فرمول)
│           └── activities(+[id])       # CRUD فعالیت (B5)
├── modules/
│   ├── identity/ projects/ profiles/ audit/    # ✅ فاز ۱ — بدون تغییر ساختاری
│   ├── config/                 # ✅ فاز ۲ — domain (snapshot/operations/validation-zod) · application (config-service: عملیات ۱۴گانه + نسخه append-only + import/export) · infrastructure (config-repo)
│   ├── params/                 # ✅ فاز ۲ — domain (value) · application (value-service: ثبت مقدار + ارزیابی + CalculationResult) · infrastructure (value-repo)
│   └── activities/             # ✅ فاز ۲ — domain (activity) · application (activity-service + instantiateActivityTemplates) · infrastructure (activity-repo)
├── shared/
│   ├── formula/                # ✅ فاز ۲ — هسته مشترک خالص موتور فرمول (۹ فایل: ast/lexer/parser/units/functions/evaluator/static-analysis/engine + آزمون ۴۴گانه) — ADR-011
│   ├── contracts/snapshot.ts   # ✅ فاز ۲ — قرارداد نوع snapshot v2 بین‌ماژولی + formulaResultSymbol
│   └── contracts/config.ts     # ✅ فاز ۲ — DTOهای کارگاه پیکربندی UI ↔ API
└── components/app/config/**    # ✅ فاز ۲ — UI کارگاه (۱۶ فایل: ۵ تب + دیالوگ‌ها) + hooks/use-config.ts
```

### ۱۰٫۲. هسته مشترک موتور فرمول (ADR-011)

قرارداد «domain→domain بین ماژول‌ها ممنوع» (§۱٫۲/§۹٫۲) جایی برای موتوری که هم سرور و هم کلاینت لازم دارند نمی‌گذاشت — بنا بر این موتور فرمول به‌عنوان **هسته مشترک خالص** در `src/shared/formula/` پیاده شد:

- **خالص:** بدون DB/UI/زمان سیستم؛ قطعی و آزمون‌پذیر (۴۴ آزمون واحد).
- **دو مصرف‌کننده:** ماژول‌های سرور (config/params از طریق application) و **فرم‌ساز UI** که شرط‌های `visibilityCondition/requiredCondition` پارامترها را سمت کاربر با همان موتور ارزیابی می‌کند — بدون رفت‌وبرگشت API و با **منبع واحد ارزیابی**.
- قاعده مرزی مرتبط (قابل‌اجرا با `check-module-boundaries`): UI مجاز است فقط `@/shared/**` (و lib کلاینت) را import کند — هسته مشترک راه حقوقیِ import سمت کلاینت است، نه استثنا روی قاعده «منطق دامنه در UI ممنوع».
- قرارداد نوع snapshot v2 هم در `shared/contracts/snapshot.ts` نشست (شکل قرارداد در shared، معناشناسی/اعتبارسنجی مالک ماژول config — ADR-011).

### ۱۰٫۳. مرزها و یال‌های بین‌ماژولی (R1-4 در فاز ۲)

- `bun run check:boundaries` (۱۶۶ فایل): **۰ نقض · ۰ چرخه** — شامل قاعده هسته مشترک (UI فقط `@/shared/**`) — شاهد: `docs/evidence/phase2-tests/boundaries.txt`.
- **یال‌های جدید فاز ۲ (یک‌طرفه):** `projects→activities` (نمونه‌سازی قالب عنصر هنگام ایجاد پروژه) · `config→audit` · `params→config` · `params→audit` · `activities→audit`.
- مجوز عملیات export/import در **ریشه ترکیب API** ترکیب می‌شود (route، `authorizeProjectAction` از application پروژه‌ها و `exportConfig/importConfig` از application پیکربندی را کنار هم می‌خواند) — یال مستقیم `projects→config` لازم نشد و گراف بدون چرخه ماند.
- گراف کامل: `identity→audit · projects→identity · projects→profiles · projects→activities · projects→audit · config→audit · params→config · params→audit · activities→audit`.

### ۱۰٫۴. تصمیم‌های ثبت‌شده فاز ۲

| موضوع | تصمیم |
|---|---|
| snapshot پیکربندی | v2 typed (`shared/contracts/snapshot.ts`)؛ v1 در حافظه به v2 خوانده می‌شود (نمایندگی)؛ نوشتن = همیشه نسخه جدید append-only — ADR-011 |
| عملیات کارگاه | ۱۴ عملیات تغییر (خانواده/پارامتر/فرمول/مدل فعالیت) در domain config؛ هر فراخوانی API = یک ConfigVersion جدید با semver و دلیل |
| مقدار جدای از تعریف | جدول `ParameterValue` با defVersion pinning؛ ثبت مجدد مقدار = pin به نسخه جدید (ADR-010) |
| نتایج فرمول | `CalculationResult` append-only؛ UI آخرین نتیجه هر فرمول را نمایش می‌دهد (A7) |
| تراکنش‌های تعاملی | داخل callback تابع `$transaction` فقط با کلاینت `tx` کار می‌شود — کلاینت سراسری `db` داخل callback روی SQLite قفل می‌دهد (درس عملی — ADR-011 بند تصمیم ۴) |
| نماد نتیجه فرمول | `f.camelCase` برای کلید سفارشی؛ ارجاع در عبارت با `<کلید>.result` و خط تیره→زیرخط (`TS_011.result`) — چون گرامر DSL خط تیره ندارد |
| پروفایل‌های v2 | ۷ پروفایل با semver 1.1.0 (کتابخانه ۲۲ فرمول سیستمی اجرایی + مدل فعالیت) — seed |
| ارزیابی شرط فرم سمت کاربر | همان موتور خالص `shared/formula` در UI (بدون منطق دامنه موازی) — ADR-011 |
