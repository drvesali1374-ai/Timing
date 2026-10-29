"use client";

import { useState } from "react";
import {
  CirclePlus,
  ClipboardList,
  FileText,
  Layers,
  LayoutGrid,
  Menu,
  Settings,
  Timer,
  TrendingUp,
  Wifi,
  WifiOff,
  Workflow,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { phaseBadge, type ViewId } from "./data";

const navIcons: Record<ViewId, typeof LayoutGrid> = {
  dashboard: LayoutGrid,
  "new-project": CirclePlus,
  config: Settings,
  timing: Timer,
  diagrams: Workflow,
  analysis: TrendingUp,
  balance: Layers,
  reports: FileText,
};

const navLabels: Record<ViewId, { label: string; route: string }> = {
  dashboard: { label: "مدیریت پروژه‌ها", route: "/" },
  "new-project": { label: "ایجاد پروژه", route: "/projects/new" },
  config: { label: "کارگاه پیکربندی", route: "/projects/[id]/config" },
  timing: { label: "صفحه زمان‌سنجی", route: "/projects/[id]/timing" },
  diagrams: { label: "نمودارهای OPC/FPC", route: "/projects/[id]/diagrams" },
  analysis: { label: "تحلیل زمان", route: "/projects/[id]/analysis" },
  balance: { label: "بالانس خط", route: "/projects/[id]/balance" },
  reports: { label: "گزارش‌ها", route: "/projects/[id]/reports" },
};

const order: ViewId[] = [
  "dashboard",
  "new-project",
  "config",
  "timing",
  "diagrams",
  "analysis",
  "balance",
  "reports",
];

export interface ShellProps {
  current: ViewId;
  onNavigate: (v: ViewId) => void;
  children: React.ReactNode;
}

export function PrototypeShell({ current, onNavigate, children }: ShellProps) {
  const [online, setOnline] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* هدر */}
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-6 sm:py-3">
          <button
            type="button"
            className="rounded-md p-2 text-muted-foreground hover:bg-accent lg:hidden"
            aria-label="باز کردن منوی ناوبری"
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground sm:size-10">
              <ClipboardList className="size-5 sm:size-6" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-extrabold sm:text-base">زمان‌سنجی صنعتی و بالانس خط تولید</h1>
              <p className="hidden truncate text-[11px] text-muted-foreground sm:block sm:text-xs">
                پلتفرم ماژولار مطالعه کار، نمودارهای فرایندی و بالانس — {phaseBadge.phase}
              </p>
            </div>
          </div>
          <div className="ms-auto flex items-center gap-1.5 sm:gap-2">
            <Badge variant="outline" className="gap-1 border-dashed px-2 py-0.5 text-[10px] font-normal sm:text-[11px]">
              {phaseBadge.phase} — وایرفریم
            </Badge>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 px-2 text-[11px] sm:text-xs"
              onClick={() => setOnline((v) => !v)}
              aria-pressed={online}
              title="شبیه‌سازی وضعیت اتصال (نمایش رفتار آفلاین)"
            >
              {online ? <Wifi className="size-4 text-primary" /> : <WifiOff className="size-4 text-destructive" />}
              <span className="hidden sm:inline">{online ? "آنلاین" : "آفلاین — صف محلی"}</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-0 px-0 lg:gap-6 lg:px-6 lg:py-6">
        {/* سایدبار ناوبری */}
        <nav
          aria-label="ناوبری نمونه اولیه"
          className={cn(
            "w-full shrink-0 border-e lg:block lg:w-60",
            menuOpen ? "block" : "hidden",
          )}
        >
          <ul className="flex gap-1 overflow-x-auto p-3 lg:flex-col lg:overflow-visible lg:p-0">
            {order.map((id, i) => {
              const Icon = navIcons[id];
              const active = current === id;
              return (
                <li key={id} className="shrink-0 lg:shrink">
                  <button
                    type="button"
                    onClick={() => {
                      onNavigate(id);
                      setMenuOpen(false);
                    }}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-right text-xs transition-colors lg:text-[13px]",
                      active
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-foreground hover:bg-accent",
                    )}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden />
                    <span className="truncate font-medium">{navLabels[id].label}</span>
                    <span
                      className={cn(
                        "ms-auto hidden rounded px-1 text-[10px] lg:inline",
                        active ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground",
                      )}
                      dir="ltr"
                    >
                      {i + 1}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="mt-4 hidden rounded-lg border border-dashed bg-muted/40 p-3 text-[11px] leading-5 text-muted-foreground lg:block">
            <p className="font-semibold text-foreground">مسیر نمایش‌داده‌شده:</p>
            <p dir="ltr" className="mt-1 text-left font-mono text-[10px]">
              {navLabels[current].route}
            </p>
            <p className="mt-2">
              در محیط توسعه، همه نماها در یک صفحه قابل بررسی‌اند؛ در محصول نهایی هر مسیر صفحه مستقل خود را دارد.
            </p>
          </div>
        </nav>

        {/* محتوا */}
        <main className="min-w-0 flex-1 border-x px-3 py-4 sm:px-5 sm:py-6 lg:border-x-0 lg:px-0">
          {children}
        </main>
      </div>

      {/* فوتر چسبان */}
      <footer className="mt-auto border-t bg-background">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-3 py-3 text-[11px] text-muted-foreground sm:px-6">
          <span>نسخه ۰٫۱٫۰ — فاز صفر (پژوهش، تحلیل و طراحی نهایی)</span>
          <span className="flex items-center gap-2">
            <span>مستندات: docs/ در مخزن Timing</span>
            <span aria-hidden>·</span>
            <span>نمایش تقویم جلالی — داده ذخیره‌شده استاندارد ISO</span>
          </span>
        </div>
      </footer>
    </div>
  );
}
