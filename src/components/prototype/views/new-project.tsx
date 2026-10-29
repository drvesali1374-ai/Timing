"use client";

import { useState } from "react";
import { Check, ChevronLeft, Eye, Info } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { PanelCard, SectionTitle, SourceBadge } from "../ui-bits";
import { demoProfiles, type ViewId } from "../data";

const steps = ["اطلاعات پروژه", "انتخاب پروفایل", "اجزای پروفایل"];

export function NewProjectView({ onNavigate }: { onNavigate: (v: ViewId) => void }) {
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState("general");
  const [picked, setPicked] = useState({
    context: true,
    rating: true,
    allowance: true,
    customFamily: false,
    demoData: false,
  });

  const defaultProfile = demoProfiles.find((p) => p.isDefault)!;

  return (
    <div className="space-y-5">
      <SectionTitle
        title="ایجاد پروژه و انتخاب پروفایل"
        sub="پروفایل پیش‌فرض از ابتدا انتخاب شده است — پروژه هرگز با پیکربندی کاملاً خالی ایجاد نمی‌شود (اصل A2)"
        tag
      />

      {/* نشانگر گام‌ها */}
      <ol className="flex flex-wrap items-center gap-2 text-[11px] sm:text-xs">
        {steps.map((s, i) => {
          const n = i + 1;
          const active = step === n;
          const done = step > n;
          return (
            <li key={s} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStep(n)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1 transition-colors",
                  active && "border-primary bg-primary text-primary-foreground",
                  done && "border-primary/40 bg-primary/5 text-primary",
                  !active && !done && "border-border text-muted-foreground",
                )}
              >
                {done ? <Check className="size-3" /> : <span className="font-bold">{n}</span>}
                {s}
              </button>
              {n < steps.length ? <ChevronLeft className="size-3 text-muted-foreground" aria-hidden /> : null}
            </li>
          );
        })}
      </ol>

      {step === 1 && (
        <PanelCard title="اطلاعات پایه پروژه">
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { id: "title", label: "عنوان*", ph: "مثال: زمان‌سنجی خط مونتاژ پکیج الکترونیک" },
              { id: "code", label: "کد پروژه*", ph: "PRJ-1403" },
              { id: "goal", label: "هدف مطالعه", ph: "تعیین زمان استاندارد و بالانس" },
              { id: "location", label: "محل / کارخانه", ph: "سالن ۲" },
              { id: "line", label: "خط تولید / ایستگاه", ph: "خط ۲ — ایستگاه ۴" },
              { id: "product", label: "محصول / فرایند", ph: "پکیج الکترونیک مدل A" },
              { id: "owner", label: "مسئول مطالعه", ph: "مهندس مطالعه زمان" },
            ].map((f) => (
              <div key={f.id} className="space-y-1.5">
                <Label htmlFor={f.id} className="text-xs">
                  {f.label}
                </Label>
                <Input id={f.id} placeholder={f.ph} className="h-9 text-xs sm:text-sm" />
              </div>
            ))}
            <div className="space-y-1.5">
              <Label htmlFor="shift" className="text-xs">
                شیفت
              </Label>
              <Input id="shift" placeholder="صبح / عصر / چندشیفتی" className="h-9 text-xs sm:text-sm" />
            </div>
          </div>
          <div className="mt-4 space-y-1.5">
            <Label htmlFor="notes" className="text-xs">
              یادداشت‌های سفارشی
            </Label>
            <Input id="notes" placeholder="یادداشت آزاد پروژه…" className="h-9 text-xs sm:text-sm" />
          </div>
          <div className="mt-5 flex justify-start">
            <Button size="sm" onClick={() => setStep(2)}>
              گام بعد: انتخاب پروفایل ←
            </Button>
          </div>
        </PanelCard>
      )}

      {step === 2 && (
        <PanelCard
          title="پروفایل‌های روش‌شناختی"
          titleExtra={<Badge variant="outline" className="border-dashed text-[10px]">پیش‌نمایش کامل پیش از ایجاد</Badge>}
        >
          <p className="mb-4 text-xs leading-6 text-muted-foreground">
            پروفایل انتخابی به‌صورت <span className="font-semibold text-foreground">کپی مستقل (Copy-on-Instantiate)</span> وارد
            پروژه می‌شود؛ تغییر الگوی عمومی در آینده، این پروژه را بی‌اطلاع تغییر نمی‌دهد.
          </p>
          <div className="grid gap-3 lg:grid-cols-2">
            {demoProfiles.map((p) => {
              const isSel = selected === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelected(p.id)}
                  aria-pressed={isSel}
                  className={cn(
                    "rounded-xl border p-4 text-right transition-all",
                    isSel ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/30" : "border-border hover:border-primary/40",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h3 className="text-sm font-bold">{p.name}</h3>
                        {p.isDefault ? (
                          <Badge className="bg-primary text-[10px]">پیش‌فرض — از پیش انتخاب‌شده</Badge>
                        ) : null}
                      </div>
                      <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">{p.desc}</p>
                    </div>
                    <span
                      aria-hidden
                      className={cn(
                        "grid size-5 shrink-0 place-items-center rounded-full border",
                        isSel ? "border-primary bg-primary text-primary-foreground" : "border-border",
                      )}
                    >
                      {isSel ? <Check className="size-3" /> : null}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <SourceBadge label={p.source} />
                    <SourceBadge label={`دامنه: ${p.scope}`} />
                    <SourceBadge label={`فعال‌سازی: ${p.phase}`} />
                  </div>
                  <span className="mt-3 inline-flex items-center gap-1 text-[11px] text-primary">
                    <Eye className="size-3.5" /> پیش‌نمایش کامل (خانواده‌ها، پارامترها، فرمول‌ها، فرض‌ها)
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-5 flex justify-between">
            <Button variant="outline" size="sm" onClick={() => setStep(1)}>
              → گام قبل
            </Button>
            <Button size="sm" onClick={() => setStep(3)}>
              گام بعد: اجزای پروفایل ←
            </Button>
          </div>
        </PanelCard>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <PanelCard title={`اجزای پروفایل انتخابی: ${defaultProfile.name}`}>
            <div className="space-y-3">
              {[
                { k: "context", label: "خانواده «زمینه مطالعه»", note: "اپراتور، شیفت، ایستگاه، ماشین" },
                { k: "rating", label: "ارزیابی عملکرد", note: "ضریب اختیاری ۷۵–۱۲۵٪ (پیش‌فرض ۱۰۰٪)" },
                { k: "allowance", label: "دسته مجاز زمان", note: "on-normal · نرخ پیشنهادی ۱۵٪ — قابل ویرایش، نه استاندارد جهانی" },
                { k: "customFamily", label: "خانواده پارامتر سفارشی خالی", note: "برای پیکربندی دستی بعدی" },
                { k: "demoData", label: "ایجاد پروژه نمونه آموزشی جدا", note: "ایزوله از داده واقعی — قابل بازنشانی" },
              ].map((item) => (
                <label
                  key={item.k}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/50"
                >
                  <Checkbox
                    checked={picked[item.k as keyof typeof picked]}
                    onCheckedChange={(v) => setPicked((prev) => ({ ...prev, [item.k]: v === true }))}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block text-xs font-semibold sm:text-[13px]">{item.label}</span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">{item.note}</span>
                  </span>
                </label>
              ))}
            </div>
            <Separator className="my-4" />
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-[11px] leading-6">
              <Info className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
              <p>
                مقدار «نرخ مجاز ۱۵٪» یک پیش‌فرض کاربردی ویرایش‌پذیر است. طبق منشور محصول، ضرایب وابسته به صنعت و
                توافق سازمانی بدون منبع و فرض روشن، استاندارد جهانی تلقی نمی‌شوند.
              </p>
            </div>
            <div className="mt-5 flex justify-between">
              <Button variant="outline" size="sm" onClick={() => setStep(2)}>
                → گام قبل
              </Button>
              <Button size="sm" className="gap-1.5" onClick={() => onNavigate("config")}>
                <Check className="size-4" /> ایجاد پروژه و ورود به کارگاه پیکربندی
              </Button>
            </div>
          </PanelCard>

          <Card className="py-4">
            <CardContent className="px-4 sm:px-6">
              <Tabs defaultValue="general">
                <TabsList className="h-9">
                  <TabsTrigger value="general" className="text-xs">خلاصه</TabsTrigger>
                  <TabsTrigger value="families" className="text-xs">خانواده‌ها</TabsTrigger>
                  <TabsTrigger value="formulas" className="text-xs">فرمول‌ها</TabsTrigger>
                  <TabsTrigger value="assumptions" className="text-xs">فرض‌ها</TabsTrigger>
                </TabsList>
                <TabsContent value="general" className="mt-3 text-xs leading-6 text-muted-foreground">
                  پروفایل دارای ۳ خانواده پایه، ۱۲ پارامتر، ۶ فرمول فعال و زنجیره تحلیل کامل
                  «مشاهده → نماینده → نرمال → استاندارد» است — صرفاً نام و ظاهر از پیش‌ساخته نیست (اصل A2).
                </TabsContent>
                <TabsContent value="families" className="mt-3 text-xs leading-6 text-muted-foreground">
                  زمینه مطالعه · روش تجمیع · ارزیابی عملکرد · مجاز زمان · کیفیت نمونه
                </TabsContent>
                <TabsContent value="formulas" className="mt-3 text-xs leading-6 text-muted-foreground">
                  TS-001 میانگین · TS-010 زمان نرمال · TS-011/TS-012 استاندارد (دو قرارداد مجاز) · ST-001 انحراف معیار ·
                  ST-010 کفایت نمونه
                </TabsContent>
                <TabsContent value="assumptions" className="mt-3 text-xs leading-6 text-muted-foreground">
                  کار تکرارپذیر و روش‌شده · اپراتور آموزش‌دیده · ضرایب به شرایط سازمان وابسته‌اند · دقت ثبت محدود به
                  مرورگر/دستگاه است
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
