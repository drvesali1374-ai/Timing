# Task J — فاز ۲: UI «کارگاه پیکربندی» (Config Workshop)

## خلاصه
UI کامل فاز ۲ روی تک‌صفحه SPA (بدون مسیر جدید) پیاده و دودی‌تست شد. همه‌چیز تحت
`src/components/app/config/` + هوک‌های `src/hooks/use-config.ts` + یکپارچه‌سازی مینیمال
در سه فایل موجود. سرور دست‌نخورده ماند.

## فایل‌های اصلی (ساختار نهایی)
- `src/hooks/use-config.ts` — همه هوک‌های TanStack Query فاز ۲ (config، apply-ops،
  validate/test فرمول، values، results، evaluate، activities، functions، export/import)
  + `ParamValueWireDto` (شکل واقعی سیم `value:{value,unit}`) + `formatParamValueFa`/`faCount`.
  نکته سیم: import نامعتبر با ۴۲۲ و بدنه=گزارش برمی‌گردد → `postImport` هر دو حالت را
  به `ConfigImportReportDto` تبدیل می‌کند.
- `config/config-workshop-view.tsx` — نمای اصلی: سربرگ، semver/نسخه/شمارنده‌ها،
  هشدار cycleRisk (destructive)، بنر فقط‌خواندنی، ۵ تب، اکشن‌های خانواده/فرمول/خروجی/درون‌ریزی.
- `config/config-bits.tsx` — نشان‌های مشترک (MonoKey، SemverBadge، DefVersionBadge،
  FormulaStatusBadge، OriginBadge، ScopeLevelBadge، DataTypeBadge، WorkTypeBadge، VaBadge،
  ErrorList، TraceSteps).
- `config/families-tab.tsx` + `family-dialog.tsx` + `parameter-dialog.tsx` — کارت خانواده
  به‌ترتیب order، جدول پارامتر، منوی عملیات ردیف (ویرایش/بایگانی/جابه‌جایی)، دیالوگ
  پارامتر با فیلدهای پویا بر اساس dataType (واحدها، min/max/precision/rounding،
  ویرایشگر گزینه‌ها، displayContexts، شرط‌های DSL، computedFormulaKey).
  هر کنش = POST تک‌عملیاتی با دلیل خودکار فارسی.
- `config/formulas-tab.tsx` + `formula-dialog.tsx` + `formula-test-panel.tsx` +
  `formula-tester-dialog.tsx` — کارت فرمول (expr لترال mono، availabilityNoteFa کهربایی)،
  دیالوگ با اعتبارسنجی زنده debounce 600ms (خطا/هشدار/چیپ‌های ارجاع/unknown قرمز)،
  راهنمای توابع (GET /api/formula/functions)، پنل آزمون با ورودی نمونه per-ref + trace.
  فرمول سیستمی: expr قفل + یادداشت؛ فقط نام/توضیح ویرایش‌پذیر.
- `config/form-values-tab.tsx` + `value-field.tsx` — فرم‌ساز گروه‌بندی خانواده؛
  ورودی per-dataType (عددی با واحد، Switch، Select، چک‌باکس چندگانه، تاریخ، …)؛
  شرط visibility/required با موتور خالص `@/shared/formula/engine` سمت کاربر؛
  badge کهربایی defVersion≠currentDefVersion؛ فقط فیلدهای تغییرکرده PUT می‌شوند.
  الگوی state: `initial` (useMemo از items سرور شامل پیش‌فرض‌ها) + overlay `draft`
  (بدون setState-in-effect — پارامتر تازه پس از invalidation خودکار دیده می‌شود).
- `config/results-tab.tsx` — کارت per فرمول پروژه‌ای + دکمه «محاسبه» (evaluate)،
  آخرین نتیجه با badge وضعیت (emerald/کهربایی/قرمز)، مقدار mono درشت، FaDate withTime،
  inputRefs، trace بازشو، خطاها؛ فرمول‌های غیرپروژه‌ای → کارت «فاز ۴».
- `config/activities-tab.tsx` + `activity-dialog.tsx` — جدول فعالیت‌ها با badge نوع کار
  (رنگ‌های ملایم طبق spec)، VaBadge، سوییچ نمایش بایگانی‌شده‌ها، دیالوگ ایجاد/ویرایش
  (pattern el.xxx، vaClassification فقط با تأیید کاربر، sourceOfTime).
- `config/import-dialog.tsx` — انتخاب فایل JSON → dryRun → گزارش (خطاها یا ✓) →
  دکمه «اعمال پیکربندی».

## یکپارچه‌سازی
- `src/app/page.tsx` — نمای "project-config" → ConfigWorkshopView.
- `src/components/app/app-shell.tsx` — ViewName، breadcrumb «کارگاه پیکربندی»،
  hint فازهای بعد، فوتر نسخه ۰٫۳٫۰، badge «فاز ۲».
- `src/components/app/project-detail-view.tsx` — prop onOpenConfig، دکمه outline
  «پیکربندی» با Settings2، کارت فعال کارگاه در overview + فهرست آینده بدون پیکربندی.

## اصلاحات این نشست (بازبینی نهایی)
1. دکمه «پیکربندی» در هدر جزئیات پروژه → `variant="outline"` (مطابق spec).
2. بازطراحی state فرم مقادیر به الگوی derived-overlay (`initial` + `draft` sparse) —
   رفع `react-hooks/set-state-in-effect` و هم‌گام‌سازی خودکار پارامتر تازه‌افزوده.

## کیفیت
- `bunx tsc --noEmit` → فقط ۲ خطای پیش‌موجود skills/ (مجاز).
- `bun run lint` → ۰ خطا.
- `bun run check:boundaries` → قبول (UI فقط از @/shared, @/components, @/lib, @/hooks).
- dev server پورت ۳۰۰۰ زنده؛ GET / ۲۰۰؛ smoke کامل HTTP روی همه endpointهای فاز ۲
  (config/values/results/activities/functions/validate/test/export/import-dryRun) موفق.

## نکات سیم/مشکلات گزارشی برای سرور (تغییر UI لازم نداشت)
- **باگ داده الگوها**: برخی تعاریف profile (service-operations، manual-machine، …)
  واحد «%» دارند در حالی که رجیستری واحدها فقط «percent» می‌شناسد → `GET config/export`
  روی پروژه‌های برخاسته از آن الگوها ۴۰۰ با پیام فارسی «۸ مورد نامعتبر» می‌دهد
  (UI آن را با toast.error فارسی نمایش می‌دهد — رفتار صحیح). اصلاح داده الگوها
  در سرور توصیه می‌شود.
- `PUT values` فقط فیلدهای ارسالی را ذخیره می‌کند و پاسخ `{items}` برمی‌گرداند؛
  `GET values` مقدار پیش‌فرض را server-side جای خالی می‌گذارد (پیش‌فرض = «پرشده تا وقتی ذخیره نشود») — UI با همین فرض ساخته شده.
- import نامعتبر: ۴۲۲ با بدنه=گزارش (نه پاکت خطای استاندارد) — در `postImport` هندل شد.
