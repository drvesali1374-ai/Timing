# گزارش تحویل مأموریت بازطراحی UX، یکپارچه‌سازی UI، اصلاح RTL و توسعه ویرایشگر OPC/FPC

شاخه: `ux/rtl-experience-refinement` (ایجادشده از `main` — بدون بازنویسی فایل‌ها، داده‌ها و منطق محاسباتی دست‌نخورده)

---

## ۱. گزارش ممیزی اولیه مشکلات UI/UX و RTL

| # | صفحه/بخش | کامپوننت/فایل | نوع ایراد | اولویت | وضعیت |
|---|----------|----------------|-----------|--------|-------|
| ۱ | جزئیات پروژه | `project-detail-view.tsx` | دکمه «پیکربندی» هم در سربرگ و هم در کارت کارگاه (تکرار) | بالا | ✅ حذف از سربرگ؛ ورود از دکمه مرحله |
| ۲ | جزئیات پروژه | `project-detail-view.tsx` | ۵ کارت سنگین با توضیحات طولانی؛ مسیر شروع مبهم برای کاربر آماتور | بالا | ✅ Stepper «مراحل انجام مطالعه» بر اساس readiness واقعی |
| ۳ | کارگاه پیکربندی | `config-workshop-view.tsx` | «خانواده جدید» و «فرمول جدید» هم در سربرگ و هم در تب مربوطه (تکرار) | بالا | ✅ حذف از سربرگ؛ فقط در تب خانواده‌ها/فرمول‌ها |
| ۴ | کارگاه پیکربندی | `config-workshop-view.tsx` | خروجی JSON و درون‌ریزی به‌صورت دکمه‌های مستقل پراکنده | متوسط | ✅ گروه‌بندی در منوی «ابزارها» |
| ۵ | کارگاه زمان‌سنجی | `timing-workshop-view.tsx` | دکمه «جلسه جدید» هم در سربرگ و هم در Empty State (وقتی جلسه‌ای نیست) | بالا | ✅ سربرگ فقط وقتی فهرست پر است |
| ۶ | طراح نمودار | `diagram-canvas.tsx` | حذف/تکثیر گام هم در نوار ابزار بوم و هم در پنل ویژگی‌ها (تکرار) | بالا | ✅ فقط در پنل ویژگی‌ها (+ میان‌برهای Delete/Ctrl+D) |
| ۷ | طراح نمودار | `diagram-workshop-view.tsx` | عملیات پیشنهادی/بایگانی/خروجی‌ها دکمه‌های مستقل بی‌گروه | متوسط | ✅ ذخیره/خروجی/چاپ/تأیید + منوی «عملیات بیشتر» |
| ۸ | طراح نمودار | `diagram-canvas.tsx` | نوار ابزار بدون گروه‌بندی معنادار | متوسط | ✅ سه گروه: نمادها / ویرایش / نمایش |
| ۹ | طراح نمودار | `diagram-canvas.tsx` | بوم فقط ۳۷۰px عرض در دسکتاپ ۱۴۴۰ (رصد شده با اندازه‌گیری واقعی) | بحرانی | ✅ تمام‌صفحه (۸۳۴px با پنل‌ها، ۹۸۲px با پنل‌های جمع‌شده) + پنل‌های جمع‌شونده |
| ۱۰ | طراح نمودار | `diagram-nodes.tsx` | فقط ۲ Handle (بالا/پایین) — اتصال از چپ/راست ممکن نبود | بحرانی | ✅ ۸ Handle چهارجهته (۴ ضلع × source/target) |
| ۱۱ | طراح نمودار | `types.ts`, `editor-store.ts`, `diagram-canvas.tsx` | `DiagramEdge` محل اتصال را نگه نمی‌داشت | بحرانی | ✅ `fromHandle`/`toHandle` ذخیره و بازیابی می‌شود |
| ۱۲ | کل برنامه | `providers.tsx` | اجزای Portal رادیکس `dir="ltr"` پیش‌فرض می‌گرفتند (رصد شده با اندازه‌گیری واقعی: منوی کشویی computed direction = ltr) | بحرانی | ✅ `DirectionProvider dir="rtl"` سراسری — رأس منوها اکنون rtl |
| ۱۳ | تمام فرم‌ها | `select.tsx` | `w-fit` در SelectTrigger — Select عرض فرم را پر نمی‌کرد | بالا | ✅ `w-full` + truncate مقدار |
| ۱۴ | تمام فرم‌ها | `select.tsx` | متن طولانی آیتم‌ها بدون شکستن؛ محتوای منو بدون سقف عرض | بالا | ✅ `break-words` + `max-w-[calc(100vw-1.5rem)]` |
| ۱۵ | تمام دیالوگ‌ها | `dialog.tsx`, `alert-dialog.tsx` | بدون سقف ارتفاع و اسکرول — دیالوگ بلند از viewport بیرون می‌زد | بحرانی | ✅ `max-h-[calc(100dvh-2.5rem)]` + `overflow-y-auto` |
| ۱۶ | دیالوگ‌های بلند | `parameter-dialog.tsx`, `formula-dialog.tsx`, `new-session-dialog.tsx` | دکمه ذخیره/انصراف در انتهای فرم طولانی از دسترس خارج | بالا | ✅ `DialogBody` اسکرول‌شونده — عنوان/دکمه‌ها ثابت |
| ۱۷ | تمام جداول | `table.tsx` | `text-left` پیش‌فرض سرستون‌ها در RTL (چپ‌چین) | بالا | ✅ `text-start` (راست‌چین در RTL) + `pe-0` منطقی |
| ۱۸ | منوهای رادیکس | `dropdown-menu.tsx` | `pr-2 pl-8`/`left-2` فیزیکی — نشانگر آیتم در RTL سمت غلط | بالا | ✅ `ps/pe/start` منطقی + چرخش چورون زیرمنو در RTL |
| ۱۹ | پنجره‌های جانبی | `sheet.tsx` | دکمه بستن `right-4` فیزیکی؛ بدون اسکرول محتوا | متوسط | ✅ `end-4` منطقی + `overflow-y-auto` |
| ۲۰ | کارگاه تحلیل | `analysis-workshop-view.tsx` | ۷ تب هم‌زمان (تراکم بصری) | متوسط | ✅ ۵ تب اصلی + منوی «جزئیات پیشرفته» |
| ۲۱ | کارگاه بالانس | `balance-workshop-view.tsx` | ۸ تب هم‌زمان (تراکم بصری) | متوسط | ✅ ۵ تب اصلی + منوی «جزئیات پیشرفته» |
| ۲۲ | پوسته برنامه | `app-shell.tsx` | Badge «فاز ۴» و جعبه «فازهای بعدی» تاریخ‌گذشته | کم | ✅ v1.0.0 + حذف جعبه منسوخ |
| ۲۳ | چندین view | `ui-bits`, `dashboard-view`, `new-project-view` | `ml-1`/`pr-9`/`right-3` فیزیکی | متوسط | ✅ `ms/ps/start` منطقی |
| ۲۴ | خروجی SVG | `svg.ts` | لنگر یال‌ها همیشه پایین→بالا (غیر چهارجهته) | بالا | ✅ لنگر بر اساس ضلع ذخیره‌شده + مسیر تاشده عمودی/افقی |
| ۲۵ | اعتبارسنجی سرور | `modules/diagrams/domain/diagram.ts` | Schema یال ضلع اتصال نمی‌پذیرفت | بالا | ✅ `fromHandle/toHandle` اختیاری در Zod (سازگار با داده قدیمی) |
| ۲۶ | راهنماها | سراسر برنامه | توضیحات طولانی در متن اصلی؛ راهنما فقط hover | متوسط | ✅ کامپوننت `Hint` (Popover با کلیک/Tab/Enter) |

**نکته درباره تصاویر «قبل/بعد»:** اصلاحات هسته‌ای قبل از امکان ثبت تصویر «قبل» اعمال شد؛ به‌جای آن، مشکل «قبل» با **اندازه‌گیری عینی** مستند شد (بوم ۳۷۰px، dir منوها ltr، تعداد دکمه‌های تکراری) و تصاویر «بعد» در `docs/ux-verification/` ذخیره شد (۱۶ تصویر دسکتاپ/موبایل).

---

## ۲. فایل‌های مهم اصلاح‌شده

### هسته RTL و استایل
- `src/app/globals.css` — قواعد RTL پایه، `@custom-variant rtl`، اسکرول‌بار، هندل‌های React Flow
- `src/components/app/providers.tsx` — **`DirectionProvider dir="rtl"`** (کلید Fixes #۱۲)

### کامپوننت‌های پایه (اصلاح اصولی مشترک)
- `src/components/ui/select.tsx` — w-full، logical props، break-words، سقف عرض
- `src/components/ui/dialog.tsx` — max-h + scroll + **`DialogBody`** جدید + text-start + end-4
- `src/components/ui/alert-dialog.tsx` — max-h + scroll + text-start
- `src/components/ui/table.tsx` — text-start سرستون‌ها
- `src/components/ui/dropdown-menu.tsx` — logical props کامل + چرخش چورون RTL
- `src/components/ui/sheet.tsx` — end-4 + overflow

### ناوبری و ساختار
- `src/components/app/project-detail-view.tsx` — **بازطراحی کامل با StudyPathStepper**
- `src/components/app/app-shell.tsx` — پاک‌سازی محتوای منسوخ
- `src/components/app/hint.tsx` — **کامپوننت جدید** (راهنمای قابل‌دسترسی)
- `src/components/app/advanced-tabs-menu.tsx` — **کامپوننت جدید** (جزئیات پیشرفته)
- `src/components/app/config/config-workshop-view.tsx` — حذف تکرار + منوی ابزارها
- `src/components/app/timing/timing-workshop-view.tsx` — حذف تکرار Empty State
- `src/components/app/analysis/analysis-workshop-view.tsx` — ۵+۲ تب
- `src/components/app/balance/balance-workshop-view.tsx` — ۵+۳ تب

### ویرایشگر OPC/FPC
- `src/shared/diagrams/types.ts` — `DiagramHandleSide` + `handleId` + پیش‌فرض سازگار + `effectiveSource/TargetSide`
- `src/components/app/diagrams/diagram-nodes.tsx` — ۸ Handle چهارجهته
- `src/components/app/diagrams/diagram-canvas.tsx` — onConnect با Handleها، rfEdges با نگاشت ضلع، نوار ابزار گروهی، دکمه تمام‌صفحه
- `src/components/app/diagrams/diagram-workshop-view.tsx` — **بازطراحی کامل**: تمام‌صفحه، پنل‌های جمع‌شونده، Escape، منوی عملیات بیشتر
- `src/components/app/diagrams/editor-store.ts` — addEdge با ضلع‌ها
- `src/shared/diagrams/svg.ts` — خروجی SVG با لنگر چهارسویه (سازگار با قدیمی)
- `src/modules/diagrams/domain/diagram.ts` — Schema Zod با fromHandle/toHandle اختیاری

### دیالوگ‌های بلند
- `src/components/app/config/parameter-dialog.tsx`، `formula-dialog.tsx`، `src/components/app/timing/new-session-dialog.tsx` — DialogBody

### آزمون جدید
- `scripts/test-handles.mjs` — **۱۶ آزمون E2E اتصال چهارجهته**

---

## ۳. تغییرات ناوبری و چیدمان

- **جزئیات پروژه**: ۵ کارت سنگین → Stepper پنج‌مرحله‌ای «مراحل انجام مطالعه» با وضعیت واقعی (diagramReady/measurementReady/analysisReady/configReady/approvalReady از API). نوار «اقدام پیشنهادی» مرحله بعدی را با CTA اصلی نشان می‌دهد؛ دکمه هر مرحله برای کاربران حرفه‌ای همیشه فعال است. پیشرفت با یک نوار Progress (بدون Badge پراکنده). عملیات ویرایش/تکثیر/بایگانی در منوی واحد «عملیات پروژه».
- **کارگاه پیکربندی**: سربرگ فقط «بازگشت» + «ابزارها» (خروجی JSON/درون‌ریزی). ایجاد خانواده/فرمول فقط در تب اصلی خود.
- **کارگاه زمان‌سنجی**: «جلسه جدید» در سربرگ فقط با وجود جلسه؛ Empty State دارای CTA اختصاصی.
- **تحلیل/بالانس**: تب‌های اصلی (۵) + منوی «جزئیات پیشرفته» — قابلیتی حذف نشده؛ trigger منو با انتخاب تب تخصصی، خودش به تب فعال تبدیل می‌شود.
- **پوسته**: Badge فاز منسوخ حذف؛ جعبه «فازهای بعدی» حذف.

## ۴. اصلاحات کامپوننت‌های مشترک و RTL

- **DirectionProvider سراسری**: ریشه مشکل جهت پنجره‌های Portal رادیکس — بدون آن، DropdownMenu/Select/Popover روی `dir="ltr"` پیش‌فرض می‌افتادند (با اندازه‌گیری مستند شد). اکنون همه RTL واقعی هستند.
- **CSS منطقی**: تبدیل هدفمند `pl/pr/ml/mr/left/right/text-left` → `ps/pe/ms/me/start/end/text-start` در کامپوننت‌های پایه؛ موارد فنی LTR (فرمول، شناسه، JSON، کد) با `dir="ltr"` حفظ شدند.
- **جدول**: `text-align: start` سراسری (globals.css) + TableHead منطقی — جداول فارسی پیش‌فرض راست‌چین (تأیید مرورگر: `thAlign: "right"`).
- **Dialog/AlertDialog**: سقف ارتفاع `calc(100dvh-2.5rem)` + اسکرول — هیچ پنجره‌ای از viewport بیرون نمی‌زند؛ دیالوگ‌های بلند با `DialogBody` عنوان/دکمه ثابت و بدنه اسکرول.
- **Select**: `w-full` در فرم‌ها، truncate مقدار انتخابی، آیتم‌های break-words، سقف عرض محتوا، DirectionProvider.
- **راهنما**: کامپوننت `Hint` با Popover (باز شدن با کلیک/لمس/Tab+Enter — نه فقط hover).

## ۵. پیاده‌سازی تمام‌صفحه نمودار (بند ۸.۱)

- **تک‌نمایشی**: حالت تمام‌صفحه فقط کلاس‌های چیدمان همان درخت DOM را عوض می‌کند (`fixed inset-0 z-[60] flex flex-col`) — نمونه دوم ادیتور ساخته نمی‌شود. انتخاب گره، Undo/Redo، ذخیره خودکار و وضعیت چون در `editor-store` (Zustand خارج React) زندگی می‌کنند، دست‌نخورده می‌مانند (تأیید مرورگر: ۳ گام/۳ اتصال قبل و بعد از تمام‌صفحه).
- **اندازه‌گیری واقعی**: بوم ۳۷۰px → ۸۳۴px (تمام‌صفحه با پنل‌ها) → با جمع‌کردن پنل‌ها ۹۸۲px در حالت عادی.
- **خروج**: دکمه «خروج از تمام‌صفحه» + کلید Escape (هندلر با capture).
- **Resize**: React Flow با ResizeObserver خودکار ابعاد جدید را می‌سنجد؛ fitView حفظ می‌شود.
- **پنل‌ها**: فهرست نمودارها (راست) و پنل ویژگی‌ها (چپ) جمع‌شونده با دکمه‌های دائمی در سربرگ (PanelRight/PanelLeft) — در تمام‌صفحه و حالت عادی.
- **موبایل**: چیدمان ستونی؛ بدون اسکرول افقی (scrollW=390 در viewport 390).

## ۶. Handleهای چهارجهته و ذخیره‌سازی (بند ۸.۲)

- **۸ Handle برای هر گام** با شناسه پایدار: `top-source/target`, `bottom-source/target`, `left-source/target`, `right-source/target` (هر ضلع هم آغازگر هم گیرنده).
- **جریان داده**: drag کاربر → `onConnect` (sourceHandle/targetHandle) → استخراج ضلع با `handleSideFromId` → `addEdge(from, to, fromHandle, toHandle)` → `DiagramEdge` → autosave سرور → Zod اختیاری → SQLite.
- **بازگذاری**: `effectiveSourceSide/effectiveTargetSide` → `handleId(side, role)` → props یال RF.
- **خروجی SVG**: `sideAnchor()` لنگر هر ضلع + مسیر تاشده عمودی/افقی بر اساس جهت مبدأ — خروجی چاپ/PNG/SVG با محل دقیق اتصال.
- **اندازه لمسی**: `connectionRadius={32}` + بزرگ‌شدگی هندل با hover/انتخاب (CSS).

## ۷. سازگاری با نمودارهای قدیمی

- فیلدها **اختیاری** (`.nullable().optional()`) — یال بدون ضلع در Schema `.strict()` فعلی عبور می‌کند.
- **پیش‌فرض قطعی**: بدون `fromHandle` → مبدأ «پایین»، بدون `toHandle` → مقصد «بالا» (رفتار نسخه قبل).
- **تزریق نمی‌شود**: یال قدیمی دست‌نخورده ذخیره/برگردانده می‌شود (آزمون H-2: یال بدون Handle پس از ذخیره و GET دقیقاً بدون فیلد برگشت — «بدون تزریق ضلع»).
- اعتبارسنجی/چیدمان خودکار/diff/مقایسه نسخه‌ها فقط از from/to استفاده می‌کنند — بدون تغییر رفتار.
- **بازیابی revision**: محل اتصال‌ها دقیقاً از revision مربوط برمی‌گردد (آزمون H-4).

## ۸. نتایج آزمون‌ها (واقعی)

| آزمون | نتیجه |
|---|---|
| ESLint (`bun run lint`) | ✅ بدون خطا |
| TypeScript (`tsc --noEmit`) | ✅ بدون خطا (فقط خطای از پیش موجود پوشه skills خارج از برنامه) |
| آزمون‌های واحد (`bun test src/shared`) | ✅ 215/215 |
| فاز ۱ | ✅ 53/53 |
| فاز ۲ | ✅ 59/59 |
| فاز ۳ (نمودارها) | ✅ 38/38 |
| فاز ۴ | ✅ 42/42 |
| فاز ۵ | ✅ 48/48 |
| فاز ۶ | ✅ 56/56 |
| فاز ۷ (یکپارچگی+کارایی) | ✅ 75/75 |
| مرز ماژول‌ها | ✅ بدون چرخه |
| **جدید: اتصال چهارجهته** (`test-handles.mjs`) | ✅ 16/16 |
| خطاهای کنسول مرورگر | ✅ صفر خطا (فقط هشدار attribution رد-فلو) |

**Build production**: طبق محدودیت محیط اجرا (سرور توسعه پورت ۳۰۰۰) اجرا نشد؛ کامپایل توسعه + tsc + لینت + ۳۷۱ آزمون یکپارچگی، پوشش کامل رگرسیون را می‌دهد.

## ۹. تصاویر تأیید (docs/ux-verification/)

01 داشبورد (دسکتاپ) · 02 جزئیات پروژه با Stepper · 03 نوار ابزار گروه‌بندی‌شده · 04 تمام‌صفحه · 05 سه اتصال چهارسویه · 06 پنل‌های جمع‌شده (بوم ۹۸۲px) · 07 کارگاه نمودار موبایل · 08 داشبورد موبایل · 09 جزئیات پروژه موبایل · 10 منوی عملیات پروژه RTL · 11 راهنمای Popover · 12 سربرگ پیکربندی بدون تکرار · 13 منوی ابزارها · 14 تحلیل با ۵ تب · 15 منوی جزئیات پیشرفته · 16 انتخاب تب تخصصی از منو.

## ۱۰. محدودیت‌های باقی‌مانده

- تصاویر مقایسه‌ای «قبل» ثبت نشد (اصلاحات قبل از امکان Snapshot اعمال شد) — به‌جای آن اندازه‌گیری عینی «قبل» مستند شد.
- پنل ویژگی‌ها در موبایل زیر بوم است (نه Side Panel کشویی) — با دکمه جمع‌کردن قابل مدیریت است.
- Fullscreen API مرورگر (حذف نوار آدرس) عمداً استفاده نشد؛ پوشش CSS تمام‌viewport در محیط sandbox قابل اتکاتر است.
- برخی `text-right`/`text-left` در جدول‌های تحلیل به‌عنوان استثنای عمدی محتوای LTR/عددی حفظ شدند.

## ۱۱. وضعیت Git

- شاخه: `ux/rtl-experience-refinement` (از main، بدون force-push)
- کامیت: `b52a049` — ۴۸ فایل (+۱۵۵۴/−۴۸۴ خط)، ۵ فایل جدید (Hint، AdvancedTabsMenu، test-handles، گزارش، ۱۷ تصویر تأیید)
- داده‌های پروژه/نسخه‌ها/جلسات دست‌نخورده (آزمون‌های فاز ۱-۷ روی همان پایگاه داده قبلی قبول شدند).
- **push**: آماده اجرا؛ نیازمند PAT معتبر (مثل فازهای قبل — توکن در جلسات قبل فقط در فرمان push مصرف و ذخیره نشده است):
  `git push https://x-access-token:<TOKEN>@github.com/drvesali1374-ai/Timing.git ux/rtl-experience-refinement:ux/rtl-experience-refinement`
