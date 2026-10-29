"use client";

import { Download, FileDown, FileSpreadsheet, FileText, History, Printer } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PanelCard, SectionTitle, SourceBadge } from "../ui-bits";
import { demoReports } from "../data";

const formatIcons: Record<string, typeof FileText> = {
  PDF: FileText,
  CSV: FileDown,
  XLSX: FileSpreadsheet,
  HTML: FileText,
  PNG: FileDown,
};

export function ReportsView() {
  return (
    <div className="space-y-5">
      <SectionTitle
        title="گزارش‌ها و خروجی‌ها"
        sub="هر گزارش به نسخه فرمول، نسخه پیکربندی و داده ورودی ارجاع دارد — خروجی با حفظ فارسی/RTL و مشخص‌بودن زمان تولید (بند B11)"
        tag
      />

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3 text-[11px]">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <History className="size-3" /> روش: ConfigVersion v1.3 · TS-011 v1.1.0
          </Badge>
          <span className="text-muted-foreground">تولید: ۱۴۰۵/۰۸/۰۷ — ۱۶:۲۰ · تولیدکننده: مهندس مطالعه زمان</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Select defaultValue="saved">
            <SelectTrigger className="h-8 w-40 text-[11px]" aria-label="قالب ذخیره‌شده">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="saved">قالب سازمان — نسخه ۲</SelectItem>
              <SelectItem value="default">قالب پیش‌فرض</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" className="h-8 gap-1 text-[11px]">
            <Printer className="size-3.5" /> چاپ (RTL)
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {demoReports.map((r) => (
          <Card key={r.name} className="gap-0 py-0 transition-shadow hover:shadow-md">
            <CardContent className="flex h-full flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold">{r.name}</h3>
                  <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{r.desc}</p>
                </div>
                <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              </div>
              <div className="mt-auto flex flex-wrap items-center gap-1.5">
                {r.formats.map((f) => {
                  const Icon = formatIcons[f] ?? FileDown;
                  return (
                    <Button key={f} variant="outline" size="sm" className="h-8 gap-1 text-[11px]">
                      <Icon className="size-3.5" /> {f}
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <PanelCard title="قالب گزارش قابل سفارشی‌سازی">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            "شناسه مشاهده (idempotent)",
            "چرخه و عنصر",
            "زمان مشاهده‌شده",
            "ضریب ارزیابی",
            "زمان نرمال",
            "زمان استاندارد + برچسب تأیید",
            "اپراتور / شیفت",
            "علت حذف از محاسبه",
            "نسخه فرمول مؤثر",
          ].map((c) => (
            <label key={c} className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed p-2.5 text-[11px] hover:bg-accent/40">
              <Checkbox defaultChecked={c.includes("مشاهده") || c.includes("استاندارد")} />
              <span>{c}</span>
            </label>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Label className="text-xs">ترتیب:</Label>
          <span className="rounded-md border bg-muted/40 px-2 py-1 font-mono text-[10px]" dir="ltr">
            cycle → element → observed
          </span>
          <Button variant="outline" size="sm" className="ms-auto h-8 gap-1 text-[11px]">
            <Download className="size-3.5" /> ذخیره قالب جدید
          </Button>
        </div>
      </PanelCard>

      <div className="space-y-2 rounded-lg border border-dashed bg-muted/30 p-3 text-[11px] leading-6 text-muted-foreground">
        <p>
          <span className="font-semibold text-foreground">قواعد صداقت خروجی:</span> تولید گزارش از داده واقعی انجام
          می‌شود؛ در نبود داده/ضریب، بخش وابسته با وضعیت «تکمیل‌نشده» ظاهر می‌شود. هیچ گزارشی بدون نمایش نسخه روش تولید
          نمی‌شود.
        </p>
        <p className="flex flex-wrap items-center gap-1.5">
          <SourceBadge label="PDF چاپ — حفظ RTL فارسی" />
          <SourceBadge label="CSV/XLSX — UTF-8 با BOM" />
          <SourceBadge label="ردیابی: inputRefs + formulaVersion" />
        </p>
      </div>
    </div>
  );
}
