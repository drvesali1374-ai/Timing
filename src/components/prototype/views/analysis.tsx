"use client";

import { AlertTriangle, ArrowLeft, EyeOff, Filter } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { KpiCard, PanelCard, SectionTitle } from "../ui-bits";
import { demoAnalysis, demoOutliers, faDigits } from "../data";

export function AnalysisView() {
  const maxBar = Math.max(...demoAnalysis.histogram);

  return (
    <div className="space-y-5">
      <SectionTitle
        title="تحلیل مهندسی زمان"
        sub="زنجیره «مشاهده‌شده → نماینده → نرمال → استاندارد» با روش و نسخه فرمول روی هر گام — قابل ردیابی (بند B9 و A7)"
        tag
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Select defaultValue="op1">
              <SelectTrigger className="h-8 w-28 text-xs" aria-label="فیلتر اپراتور">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="op1">اپراتور ۱</SelectItem>
                <SelectItem value="op2">اپراتور ۲</SelectItem>
                <SelectItem value="all">همه</SelectItem>
              </SelectContent>
            </Select>
            <Select defaultValue="morning">
              <SelectTrigger className="h-8 w-24 text-xs" aria-label="فیلتر شیفت">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="morning">شیفت صبح</SelectItem>
                <SelectItem value="evening">شیفت عصر</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
              <Filter className="size-3.5" /> گروه‌بندی سفارشی
            </Button>
          </div>
        }
      />

      {/* زنجیره زمان */}
      <PanelCard title={`زنجیره زمان — عنصر «${demoAnalysis.element}»`}>
        <ol className="flex flex-wrap items-stretch gap-2">
          {demoAnalysis.chain.map((c, i) => (
            <li key={c.label} className="flex items-stretch gap-2">
              <div className="w-40 rounded-xl border p-3 sm:w-48">
                <p className="text-[10px] text-muted-foreground sm:text-[11px]">{c.label}</p>
                <p className="mt-1 text-lg font-black text-primary sm:text-xl" dir="auto">
                  {c.value}
                </p>
                <p className="mt-1.5 text-[10px] leading-4 text-muted-foreground sm:text-[11px]">{c.method}</p>
              </div>
              {i < demoAnalysis.chain.length - 1 ? (
                <div className="grid w-5 place-items-center text-muted-foreground" aria-hidden>
                  <ArrowLeft className="size-4" />
                </div>
              ) : null}
            </li>
          ))}
        </ol>
        <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 text-[11px] leading-6">
          <p>
            ⚠ نرخ مجاز ۱۵٪ «پیشنهاد قابل ویرایش» است — خروجی وابسته به آن با برچسب «تأییدنشده سازمانی» نمایش داده می‌شود.
            اگر ارزیابی عملکرد غیرفعال باشد، خروجی «زمان خام» نامیده می‌شود و زمان نرمال قطعی تلقی نمی‌گردد (بند B4).
          </p>
        </div>
      </PanelCard>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* آمار */}
        <PanelCard title="آمار توصیفی مشاهدات معتبر">
          <div className="grid grid-cols-2 gap-2.5">
            {demoAnalysis.stats.map((s) => (
              <KpiCard key={s.k} k={s.k} v={s.v} />
            ))}
          </div>
          <p className="mt-3 text-[10px] leading-5 text-muted-foreground">
            کفایت نمونه با فرض تقریب نرمال (ST-010) — «کافی» جهت ادامه است نه سقف قطعی.
          </p>
        </PanelCard>

        {/* هیستوگرام */}
        <PanelCard title="توزیع مشاهدات (هیستوگرام)">
          <div className="flex h-40 items-end justify-center gap-1.5 rounded-lg border border-dashed bg-muted/20 p-3">
            {demoAnalysis.histogram.map((h, i) => (
              <div key={i} className="flex w-full flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-primary/70"
                  style={{ height: `${(h / maxBar) * 100}%` }}
                  aria-hidden
                />
                <span className="text-[9px] text-muted-foreground">{faDigits(i + 1)}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-center text-[10px] text-muted-foreground">
            طبقه‌ها (زمان مشاهده — ثانیه) · بازتولید از داده خام
          </p>
        </PanelCard>

        {/* روند */}
        <PanelCard title="روند به ترتیب چرخه">
          <div className="flex h-40 items-end gap-1 rounded-lg border border-dashed bg-muted/20 p-3" dir="ltr">
            {[9, 11, 10, 12, 14, 13, 11, 15, 16, 12, 11, 13, 14, 12, 10, 13, 24, 12, 11, 13, 12, 5, 11, 12].map((v, i) => (
              <div
                key={i}
                className={`w-full rounded-t ${v >= 20 ? "bg-destructive/70" : v <= 6 ? "bg-amber-500/70" : "bg-primary/60"}`}
                style={{ height: `${(v / 24) * 100}%` }}
                title={`چرخه ${i + 1}: ${v * 0.1} ث`}
                aria-hidden
              />
            ))}
          </div>
          <p className="mt-2 text-center text-[10px] text-muted-foreground" dir="rtl">
            قرمز/کهربایی: مشکوک به پرت — تفکیک برچسب‌گذاری از حذف
          </p>
        </PanelCard>
      </div>

      {/* داده پرت */}
      <PanelCard
        title="داده‌های پرت/مشکوک"
        titleExtra={
          <Badge variant="outline" className="gap-1 text-[10px]">
            <EyeOff className="size-3" /> حذف ≠ علامت‌گذاری
          </Badge>
        }
      >
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-right text-[11px]">چرخه</TableHead>
                <TableHead className="text-right text-[11px]">مقدار</TableHead>
                <TableHead className="text-right text-[11px]">علت ثبت‌شده</TableHead>
                <TableHead className="text-right text-[11px]">اقدام</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {demoOutliers.map((o) => (
                <TableRow key={o.cycle}>
                  <TableCell className="text-[11px]">{faDigits(o.cycle)}</TableCell>
                  <TableCell className="text-[11px] font-mono">{o.value}</TableCell>
                  <TableCell className="text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <AlertTriangle className="size-3.5 text-amber-600" aria-hidden />
                      {o.reason}
                    </span>
                  </TableCell>
                  <TableCell className="text-[11px]">
                    <Button variant="outline" size="sm" className="h-7 text-[11px]">
                      {o.action}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="mt-3 text-[11px] leading-6 text-muted-foreground">
          تشخیص پرت به حذف خودکار منجر نمی‌شود؛ حذف از محاسبه فقط بر اساس قاعده انتخابی پروژه و با ثبت علت انجام
          می‌شود و در AuditLog و گزارش «تعداد مشاهدات حذف‌شده + علت» باقی می‌ماند.
        </p>
      </PanelCard>

      <div className="rounded-lg border border-dashed bg-muted/30 p-3 text-[11px] leading-6 text-muted-foreground">
        <span className="font-semibold text-foreground">در محصول نهایی (فاز ۵):</span> انتخاب روش تجمیع، چندک‌ها، فاصله
        اطمینان با شرط اعتبار فرض‌ها، تفکیک بر پایه پارامترهای سفارشی، مقایسه دوره/ایستگاه/سناریو، گزارش‌های نسخه‌دار و
        خروجی CSV/Excel/PDF با حفظ فارسی و RTL.
      </div>
    </div>
  );
}
