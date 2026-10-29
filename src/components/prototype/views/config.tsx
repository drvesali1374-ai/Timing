"use client";

import { CirclePlus, FlaskConical, History, Info, Pencil, Play, Save } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KpiCard, PanelCard, SectionTitle, SourceBadge } from "../ui-bits";
import { demoFormulaRows, demoParamRows } from "../data";

export function ConfigView() {
  return (
    <div className="space-y-5">
      <SectionTitle
        title="کارگاه پیکربندی"
        sub="خانواده‌ها، پارامترها و فرمول‌ها بدون تغییر کد — تعریف پارامتر از مقدار جداست و هر تغییر، نسخه جدید می‌سازد"
        tag
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="outline" className="gap-1">
            <History className="size-3" /> نسخه پیکربندی: v1.3 (append-only)
          </Badge>
          <span className="text-muted-foreground">آخرین تغییر: افزودن پارامتر study.workstation · ۱۴۰۵/۰۸/۰۶</span>
        </div>
        <Button size="sm" className="gap-1.5" variant="outline">
          <Save className="size-4" /> ثبت نسخه جدید (با دلیل تغییر)
        </Button>
      </div>

      <Tabs defaultValue="params">
        <TabsList className="h-10">
          <TabsTrigger value="params" className="gap-1.5 text-xs sm:text-[13px]">
            خانواده‌ها و پارامترها
          </TabsTrigger>
          <TabsTrigger value="formulas" className="gap-1.5 text-xs sm:text-[13px]">
            فرمول‌ها
          </TabsTrigger>
          <TabsTrigger value="rules" className="text-xs sm:text-[13px]">
            قواعد و فرم ثبت
          </TabsTrigger>
          <TabsTrigger value="settings" className="text-xs sm:text-[13px]">
            تنظیمات آماری
          </TabsTrigger>
        </TabsList>

        <TabsContent value="params" className="mt-4 space-y-4">
          <PanelCard
            title="خانواده‌ها و پارامترهای پروژه (PRJ-1401)"
            titleExtra={
              <div className="flex gap-1.5">
                <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
                  <CirclePlus className="size-3.5" /> خانواده جدید
                </Button>
                <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
                  <CirclePlus className="size-3.5" /> پارامتر جدید
                </Button>
              </div>
            }
          >
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-right text-[11px]">خانواده</TableHead>
                    <TableHead className="text-right text-[11px]">شناسه فنی پایدار</TableHead>
                    <TableHead className="text-right text-[11px]">نام نمایشی</TableHead>
                    <TableHead className="text-right text-[11px]">نوع داده</TableHead>
                    <TableHead className="text-right text-[11px]">نقش در تحلیل</TableHead>
                    <TableHead className="text-right text-[11px]">نسخه تعریف</TableHead>
                    <TableHead className="text-right text-[11px]">یادداشت</TableHead>
                    <TableHead className="w-16 text-right text-[11px]">عملیات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {demoParamRows.map((r) => (
                    <TableRow key={r.key}>
                      <TableCell className="text-[11px] font-semibold">{r.family}</TableCell>
                      <TableCell className="font-mono text-[11px]" dir="ltr">
                        {r.key}
                      </TableCell>
                      <TableCell className="text-[11px]">{r.name}</TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">{r.type}</TableCell>
                      <TableCell className="text-[11px]">
                        <SourceBadge label={r.role} />
                      </TableCell>
                      <TableCell className="text-[11px]" dir="ltr">
                        v{r.version}
                      </TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">{r.note ?? "—"}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="h-7 w-8 p-0" aria-label={`ویرایش ${r.name}`}>
                          <Pencil className="size-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-dashed bg-muted/30 p-3 text-[11px] leading-6 text-muted-foreground">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p>
                شناسه فنی پایدار (<span dir="ltr" className="font-mono">stableKey</span>) هرگز با تغییر نام نمایشی یا
                ترتیب نابود نمی‌شود. مقادیر ثبت‌شده به نسخه تعریف لحظه ثبت گره می‌خورند و تغییر تعریف، مقادیر قدیمی را
                بدون مهاجرت صریح و ثبت در AuditLog تبدیل نمی‌کند.
              </p>
            </div>
          </PanelCard>

          <PanelCard title="پیش‌نمایش فرم ثبت مشاهده (تولیدشده از تعریف پارامترها)">
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { l: "اپراتور", ph: "انتخاب از فهرست" },
                { l: "شیفت", ph: "صبح" },
                { l: "ایستگاه", ph: "خط ۲ — ایستگاه ۴" },
                { l: "ضریب ارزیابی", ph: "۱۰۵٪" },
                { l: "نرخ مجاز", ph: "۱۵٪ (پیشنهادی)" },
                { l: "روش تجمیع", ph: "میانگین" },
              ].map((f) => (
                <div key={f.l} className="rounded-lg border border-dashed bg-muted/30 p-3">
                  <p className="text-[11px] font-semibold">{f.l}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{f.ph}</p>
                </div>
              ))}
            </div>
          </PanelCard>
        </TabsContent>

        <TabsContent value="formulas" className="mt-4 space-y-4">
          <PanelCard
            title="فرمول‌های پروژه"
            titleExtra={
              <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
                <FlaskConical className="size-3.5" /> آزمون با داده نمونه
              </Button>
            }
          >
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-right text-[11px]">شناسه</TableHead>
                    <TableHead className="text-right text-[11px]">نام</TableHead>
                    <TableHead className="text-right text-[11px]">عبارت (DSL امن)</TableHead>
                    <TableHead className="text-right text-[11px]">سطح محاسبه</TableHead>
                    <TableHead className="text-right text-[11px]">نسخه</TableHead>
                    <TableHead className="text-right text-[11px]">وضعیت</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {demoFormulaRows.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-mono text-[11px]" dir="ltr">
                        {f.id}
                      </TableCell>
                      <TableCell className="text-[11px] font-semibold">{f.name}</TableCell>
                      <TableCell className="font-mono text-[11px]" dir="ltr">
                        {f.expr}
                      </TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">{f.scope}</TableCell>
                      <TableCell className="text-[11px]" dir="ltr">
                        {f.version}
                      </TableCell>
                      <TableCell>
                        <SourceBadge label={f.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <KpiCard k="گراف وابستگی" v="بدون چرخه ✓" note="بررسی ایستا پیش از ذخیره" tone="positive" />
              <KpiCard k="عمق مجاز AST" v="۶۴" note="سقف ایمنی DSL" tone="muted" />
              <KpiCard k="eval / اجرای کد آزاد" v="ممنوع ✓" note="ADR-003 — پارسر اختصاصی" tone="positive" />
            </div>
            <div className="mt-3 rounded-lg border border-dashed bg-muted/30 p-3 text-[11px] leading-6 text-muted-foreground">
              هر فرمول نتیجه را با وضعیت (معتبر/نامعتبر/ناقص)، واحد، نسخه و trace نمایش می‌دهد. تغییر فرمول فعال، نتایج
              قبلی را بی‌سروصدا جایگزین نمی‌کند؛ «محاسبه مجدد» نتیجه جدیدی با نسخه جدید می‌سازد.
            </div>
          </PanelCard>
        </TabsContent>

        <TabsContent value="rules" className="mt-4">
          <PanelCard title="قواعد نمایش و اعتبارسنجی (عبارات شرطی DSL)">
            <div className="space-y-2 font-mono text-[11px] leading-6" dir="ltr">
              <p className="rounded-lg border bg-muted/30 p-3 text-right" dir="rtl">
                <span dir="ltr" className="font-mono">show_if: study.shift == &quot;شب&quot;</span> → نمایش پارامتر «روشنایی محیط»
              </p>
              <p className="rounded-lg border bg-muted/30 p-3 text-right" dir="rtl">
                <span dir="ltr" className="font-mono">required_if: rating.enabled == true</span> → اجباری‌شدن «ضریب ارزیابی»
              </p>
              <p className="rounded-lg border bg-muted/30 p-3 text-right" dir="rtl">
                <span dir="ltr" className="font-mono">compute: TS-011.st</span> → مقدار محاسباتی «زمان استاندارد»
              </p>
            </div>
          </PanelCard>
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <PanelCard title="تنظیمات آماری و روش‌شناختی پروژه">
            <div className="grid gap-3 sm:grid-cols-2">
              <KpiCard k="سطح اطمینان هدف" v="۹۵٪" note="پیشنهاد قابل ویرایش" />
              <KpiCard k="دقت نسبی هدف" v="۵٪" note="برای کفایت نمونه (ST-010)" />
              <KpiCard k="روش نماینده" v="میانگین" note="یا میانه — قابل تغییر" />
              <KpiCard k="قاعده داده پرت" v="فقط علامت‌گذاری" note="حذف از محاسبه = عمل جدا با ثبت علت" tone="warning" />
            </div>
          </PanelCard>
        </TabsContent>
      </Tabs>

      <div className="flex items-center gap-2 rounded-lg border border-dashed bg-muted/30 p-3 text-[11px] leading-6 text-muted-foreground">
        <Play className="size-4 shrink-0" aria-hidden />
        مسیر پذیرش فاز ۲ در این صفحه آزموده می‌شود: ساخت خانواده/پارامتر جدید → ثبت مقدار در فرم → استفاده در فرمول →
        مشاهده نتیجه → بستن و باز کردن پروژه → بازیابی همان داده/نتیجه، همه بدون تغییر کد.
      </div>
    </div>
  );
}
