"use client";

import { useState } from "react";
import { GitBranch, GripVertical, Info, Scale } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { KpiCard, PanelCard, SectionTitle } from "../ui-bits";
import { demoBalance, faDigits } from "../data";

const partColors = ["bg-primary/80", "bg-chart-2/70", "bg-chart-3/70"];

export function BalanceView() {
  const [algorithm, setAlgorithm] = useState("rpw");
  const takt = demoBalance.takt;

  return (
    <div className="space-y-5">
      <SectionTitle
        title="بالانس خط تولید و نیروی کاری"
        sub="خروجی همیشه «بهترین راهکار یافت‌شده» است مگر بهینگی اثبات‌شده — قیود تقدم/تأخر هرگز بی‌گزارش نقض نمی‌شوند (بند B10)"
        tag
      />

      {/* ورودی‌های سناریو */}
      <PanelCard
        title="سناریو: پایه (v2)"
        titleExtra={
          <Badge variant="outline" className="text-[10px]">
            مقایسه با وضع موجود فعال
          </Badge>
        }
      >
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="demand" className="text-xs">تقاضا (واحد/شیفت)</Label>
            <Input id="demand" defaultValue="۴۵۰" className="h-9 text-xs" dir="ltr" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="net" className="text-xs">زمان خالص در دسترس (ثانیه)</Label>
            <Input id="net" defaultValue="۲۷۰۰۰" className="h-9 text-xs" dir="ltr" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="shifts" className="text-xs">تعداد شیفت</Label>
            <Input id="shifts" defaultValue="۱" className="h-9 text-xs" dir="ltr" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="takt" className="text-xs">تاکت‌تایم (محاسبه‌شده)</Label>
            <div className="flex h-9 items-center justify-between rounded-md border bg-muted/40 px-3 text-xs">
              <span dir="ltr">{faDigits(takt)}s</span>
              <span className="text-[10px] text-muted-foreground">TS-013 v1.0.0</span>
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-muted-foreground">الگوریتم:</span>
          {[
            { id: "lcr", name: "LCR — قاعده نامزد بزرگ" },
            { id: "rpw", name: "RPW — وزن موقعیتی (Helgeson–Birnie)" },
            { id: "kw", name: "Kilbridge–Wester" },
            { id: "manual", name: "تخصیص دستی" },
          ].map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setAlgorithm(a.id)}
              aria-pressed={algorithm === a.id}
              className={cn(
                "rounded-full border px-3 py-1 text-[11px] transition-colors",
                algorithm === a.id ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-accent",
              )}
            >
              {a.name}
            </button>
          ))}
        </div>
      </PanelCard>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Yamazumi */}
        <PanelCard
          title="نمودار Yamazumi — پشته فعالیت هر ایستگاه"
          className="lg:col-span-2"
          titleExtra={
            <Badge variant="outline" className="text-[10px]">
              روش رایج Lean (LEI)
            </Badge>
          }
        >
          <div className="rounded-xl border-2 border-dashed bg-muted/20 p-4">
            <div className="relative flex h-64 items-end justify-around gap-4 sm:gap-8">
              {/* خط تاکت */}
              <div
                className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-destructive"
                style={{ bottom: "80%" }}
              >
                <span className="absolute -top-2 start-2 rounded bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-white">
                  خط تاکت {faDigits(takt)}ث
                </span>
              </div>
              {demoBalance.stations.map((st, si) => {
                const total = st.parts.reduce((a, p) => a + p[1], 0);
                const over = total > takt;
                return (
                  <div key={st.name} className="flex h-full w-24 flex-col justify-end sm:w-32">
                    <div className="relative flex h-full flex-col justify-end overflow-hidden rounded-t-lg border">
                      {st.parts.map((p, pi) => (
                        <div
                          key={p[0]}
                          className={cn("relative w-full", partColors[pi % partColors.length])}
                          style={{ height: `${(p[1] / takt) * 100}%` }}
                          title={`${p[0]} — ${p[1]} ثانیه`}
                        >
                          <GripVertical className="absolute start-1 top-1 size-3 text-white/60" aria-hidden />
                          <span className="absolute inset-x-1 top-1/2 -translate-y-1/2 rotate-0 truncate text-center text-[9px] leading-3 text-white">
                            {p[0]} · {faDigits(p[1])}ث
                          </span>
                        </div>
                      ))}
                      {over ? (
                        <div
                          className="w-full bg-destructive/80"
                          style={{ height: `${((total - takt) / takt) * 100}%` }}
                          title="فراتر از تاکت"
                        />
                      ) : null}
                    </div>
                    <div className="mt-1.5 text-center">
                      <p className="text-[10px] font-semibold">{st.name}</p>
                      <p className={cn("text-[10px]", over ? "text-destructive font-bold" : "text-muted-foreground")}>
                        Σ = {faDigits(total)}ث {over ? "(فراتر از تاکت!)" : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-center text-[10px] text-muted-foreground">
              هر ستون بار به اجزای سازنده قابل مشاهده است · تخصیص دستی: کشیدن فعالیت بین ایستگاه‌ها با اعتبارسنجی فوری
            </p>
          </div>
        </PanelCard>

        {/* شاخص‌ها */}
        <PanelCard title="شاخص‌ها و برآورد نیرو">
          <div className="space-y-2.5">
            {demoBalance.metrics.map((m) => (
              <KpiCard key={m.k} k={m.k} v={m.v} note={m.note} />
            ))}
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-dashed bg-muted/30 p-2.5 text-[10px] leading-5 text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <p>
              «تعداد ایستگاه» و «تعداد نیرو در هر شیفت» دو مفهوم مرتبط اما غیرهمسان‌اند و جداگانه با فرض‌های روشن گزارش
              می‌شوند. زمان خودکار ماشین به‌عنوان کار دستی جمع نمی‌شود.
            </p>
          </div>
        </PanelCard>
      </div>

      <Tabs defaultValue="precedence">
        <TabsList className="h-9">
          <TabsTrigger value="precedence" className="gap-1 text-xs">
            <GitBranch className="size-3.5" /> گراف تقدم و تأخر
          </TabsTrigger>
          <TabsTrigger value="allocation" className="gap-1 text-xs">
            <Scale className="size-3.5" /> ماتریس تخصیص
          </TabsTrigger>
          <TabsTrigger value="compare" className="text-xs">مقایسه قبل/بعد</TabsTrigger>
        </TabsList>

        <TabsContent value="precedence" className="mt-3">
          <PanelCard title="گراف تقدم (DAG — بدون چرخه)">
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed bg-muted/20 p-4 text-[11px]">
              {["برداشتن قطعه", "جای‌گذاری", "نصب درب", "اتصال کانکتور", "پرس سرد", "بازرسی", "بسته‌بندی"].map((a, i, arr) => (
                <span key={a} className="flex items-center gap-2">
                  <span className="rounded-full border bg-card px-3 py-1 font-semibold">{a}</span>
                  {i < arr.length - 1 ? <span className="text-muted-foreground" aria-hidden>←</span> : null}
                </span>
              ))}
              <Badge variant="outline" className="text-[10px] text-emerald-700 dark:text-emerald-400">
                بررسی چرخه: بدون چرخه ✓ · تناقض: ندارد ✓
              </Badge>
            </div>
          </PanelCard>
        </TabsContent>

        <TabsContent value="allocation" className="mt-3">
          <PanelCard title="نقشه تخصیص فعالیت → ایستگاه/اپراتور">
            <div className="grid gap-2 sm:grid-cols-3">
              {demoBalance.stations.map((st) => (
                <div key={st.name} className="rounded-lg border p-3">
                  <p className="text-xs font-bold">{st.name}</p>
                  <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                    {st.parts.map((p) => (
                      <li key={p[0]} className="flex justify-between gap-2">
                        <span>{p[0]}</span>
                        <span dir="ltr">{faDigits(p[1])}s</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </PanelCard>
        </TabsContent>

        <TabsContent value="compare" className="mt-3">
          <PanelCard title="مقایسه وضع موجود و سناریوهای پیشنهادی">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border p-3">
                <p className="text-xs font-bold">وضع موجود</p>
                <p className="mt-2 text-[11px] leading-6 text-muted-foreground">
                  ۴ ایستگاه · راندمان ۷۶٪ · گلوگاه ۷۸ث (فراتر از تاکت) · نیروی نظری ۳٫۲
                </p>
              </div>
              <div className="rounded-lg border border-primary/40 bg-primary/5 p-3">
                <p className="text-xs font-bold">سناریوی پیشنهادی (RPW)</p>
                <p className="mt-2 text-[11px] leading-6 text-muted-foreground">
                  ۳ ایستگاه · راندمان ۸۹٫۴٪ · گلوگاه ۵۲ث (زیر تاکت) · نیروی نظری ۲٫۸ — با فرض‌های نمایش‌داده‌شده
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed bg-muted/30 p-2.5 text-[11px] text-muted-foreground">
              <span>اثر تغییر تقاضا/ترکیب محصول: قابل آزمون در سناریوی جدید بدون دست‌کاری داده خام</span>
              <Select defaultValue="rpw">
                <SelectTrigger className="h-8 w-40 text-[11px]" aria-label="انتخاب الگوریتم مقایسه">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lcr">LCR</SelectItem>
                  <SelectItem value="rpw">RPW</SelectItem>
                  <SelectItem value="kw">Kilbridge–Wester</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </PanelCard>
        </TabsContent>
      </Tabs>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed bg-muted/30 p-3 text-[11px] leading-6 text-muted-foreground">
        <span>
          <span className="font-semibold text-foreground">در محصول نهایی (فاز ۶):</span> ورودی‌های قابل پیکربندی B10،
          چند تابع هدف وزن‌دهی‌شده، چند سناریو/پارتو، تخصیص دستی با هشدار نقض قید، رابط افزونه برای حل‌گرهای دقیق آتی
          (بدون MILP در پایه — ADR-008).
        </span>
        <Button size="sm" className="gap-1.5">
          سناریوی جدید
        </Button>
      </div>
    </div>
  );
}
