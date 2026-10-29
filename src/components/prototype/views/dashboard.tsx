"use client";

import { Archive, CirclePlus, Filter, GraduationCap, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KpiCard, PanelCard, PhaseNote, SectionTitle, SourceBadge } from "../ui-bits";
import { demoProjects, type ViewId } from "../data";

const statusTone: Record<string, string> = {
  recording: "bg-primary/10 text-primary border-primary/30",
  active: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  archived: "bg-muted text-muted-foreground border-border",
  demo: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
};

export function DashboardView({ onNavigate }: { onNavigate: (v: ViewId) => void }) {
  return (
    <div className="space-y-5">
      <SectionTitle
        title="مدیریت پروژه‌ها"
        sub="هر پروژه یک فضای کاری مستقل است — ویرایش یک پروژه هیچ پروژه دیگری را تغییر نمی‌دهد (اصل A5)"
        tag
        action={
          <Button size="sm" className="gap-1.5" onClick={() => onNavigate("new-project")}>
            <CirclePlus className="size-4" /> پروژه جدید
          </Button>
        }
      />

      <PhaseNote />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard k="پروژه‌های فعال" v="۲" note="۱ در ثبت مشاهدات" tone="positive" />
        <KpiCard k="بایگانی‌شده" v="۱" tone="muted" />
        <KpiCard k="نمونه آموزشی" v="۱" note="ایزوله از داده واقعی" tone="warning" />
        <KpiCard k="نسخه پیکربندی جاری" v="v1.3" note="PRJ-1401 — append-only" />
      </div>

      <PanelCard
        title="فهرست پروژه‌ها"
        titleExtra={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute end-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input placeholder="جست‌وجو در عنوان/کد…" className="h-8 w-44 pe-8 text-xs sm:w-56" aria-label="جست‌وجوی پروژه" />
            </div>
            <Select defaultValue="all">
              <SelectTrigger className="h-8 w-32 text-xs sm:w-40" aria-label="فیلتر وضعیت">
                <SelectValue placeholder="همه وضعیت‌ها" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه وضعیت‌ها</SelectItem>
                <SelectItem value="active">فعال</SelectItem>
                <SelectItem value="recording">در ثبت</SelectItem>
                <SelectItem value="archived">بایگانی</SelectItem>
                <SelectItem value="demo">نمونه آموزشی</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
              <Filter className="size-3.5" /> فیلتر پیشرفته
            </Button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {demoProjects.map((p) => (
            <Card key={p.id} className="gap-0 py-0 transition-shadow hover:shadow-md">
              <CardContent className="flex h-full flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground" dir="ltr">
                      {p.code}
                    </p>
                    <h3 className="mt-0.5 truncate text-sm font-bold">{p.title}</h3>
                  </div>
                  {p.status === "demo" ? (
                    <GraduationCap className="size-5 shrink-0 text-amber-600" aria-hidden />
                  ) : p.status === "archived" ? (
                    <Archive className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                  ) : null}
                </div>

                <Badge variant="outline" className={`justify-center border ${statusTone[p.status]}`}>
                  {p.statusLabel}
                </Badge>

                <p className="text-[11px] leading-5 text-muted-foreground">{p.meta}</p>

                <div className="mt-auto space-y-2">
                  <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="font-semibold text-foreground">پروفایل:</span> {p.profile}
                  </p>
                  <div className="flex flex-wrap gap-1.5 text-[10px]">
                    <SourceBadge label={`آماده اندازه‌گیری ${p.readiness.measurement ? "✓" : "✗"}`} />
                    <SourceBadge label={`آماده تحلیل ${p.readiness.analysis ? "✓" : "✗"}`} />
                    <SourceBadge label={`تأییدشده ${p.readiness.approval ? "✓" : "✗"}`} />
                  </div>
                  <div className="flex items-center justify-between border-t pt-2 text-[11px] text-muted-foreground">
                    <span>به‌روزرسانی: {p.updatedAt}</span>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                      ورود به پروژه ←
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </PanelCard>

      <div className="rounded-lg border border-dashed bg-muted/30 p-3 text-[11px] leading-6 text-muted-foreground">
        <span className="font-semibold text-foreground">قابلیت‌های این صفحه در محصول نهایی:</span>{" "}
        ایجاد، ویرایش، کپی انتخابی (ساختار/پروفایل/فرمول/نمودار — داده خام فقط با انتخاب صریح)، بایگانی، جست‌وجو و
        فیلتر، مشاهده تاریخچه نسخه‌ها، نشانگرهای آمادگی. عملیات کپی از پروژه دیگر، نسخه مستقل و قابل ردیابی ایجاد
        می‌کند.
      </div>
    </div>
  );
}
