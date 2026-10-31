"use client";

/**
 * پوسته برنامه — هدر + ناوبری (دسکتاپ: کنار، موبایل: Sheet) + فوتر چسبان.
 * ساختار فاز ۱: داشبورد پروژه‌ها و ایجاد پروژه؛ بخش‌های فازهای بعد منو می‌شوند
 * با برچسب فاز مربوطه (نمایش صادقانه — بدون لینک ساختگی).
 */
import { useEffect, useState } from "react";
import { FolderPlus, LayoutDashboard, Menu, Timer, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { SessionUserDto } from "@/shared/contracts/api";
import { useLogout } from "@/hooks/use-api";
import { Spinner } from "./ui-bits";

export type ViewName = "dashboard" | "new-project" | "project" | "project-config" | "project-diagrams";

export interface AppShellProps {
  user: SessionUserDto;
  view: ViewName;
  onNavigate: (view: ViewName, projectId?: string) => void;
  children: React.ReactNode;
  /** در نمای پروژه: عنوان برای ناوبری بازگشت */
  projectTitle?: string | null;
}

function useOnlineStatus() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

const NAV_ITEMS: Array<{ key: ViewName; label: string; icon: React.ElementType }> = [
  { key: "dashboard", label: "داشبورد پروژه‌ها", icon: LayoutDashboard },
  { key: "new-project", label: "ایجاد پروژه جدید", icon: FolderPlus },
];

function NavList({ view, onNavigate, onPick }: { view: ViewName; onNavigate: (v: ViewName) => void; onPick?: () => void }) {
  return (
    <nav aria-label="ناوبری اصلی" className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active =
      view === item.key ||
      (item.key === "dashboard" && (view === "project" || view === "project-config" || view === "project-diagrams"));
        return (
          <Button
            key={item.key}
            variant={active ? "secondary" : "ghost"}
            className={cn("justify-start gap-2 font-medium", active && "bg-secondary")}
            onClick={() => {
              onNavigate(item.key);
              onPick?.();
            }}
          >
            <Icon className="size-4" aria-hidden />
            {item.label}
          </Button>
        );
      })}
      <div className="mt-2 rounded-lg border border-dashed p-3 text-xs leading-relaxed text-muted-foreground">
        <p className="mb-1 font-medium">فازهای بعدی محصول:</p>
        <p>کرنومتر و ثبت مشاهدات (فاز ۴) · تحلیل زمان (فاز ۵) · بالانس خط (فاز ۶)</p>
      </div>
    </nav>
  );
}

export function AppShell({ user, view, onNavigate, children, projectTitle }: AppShellProps) {
  const online = useOnlineStatus();
  const logout = useLogout();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
          {/* موبایل: منو */}
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="باز کردن منو">
                <Menu className="size-5" aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetTitle className="mb-4 flex items-center gap-2 text-base">
                <span aria-hidden>⏱</span> زمان‌سنجی صنعتی
              </SheetTitle>
              <NavList view={view} onNavigate={onNavigate} onPick={() => setMobileNavOpen(false)} />
            </SheetContent>
          </Sheet>

          {/* لوگو */}
          <button
            className="flex items-center gap-2 font-bold"
            onClick={() => onNavigate("dashboard")}
            aria-label="بازگشت به داشبورد"
          >
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Timer className="size-4" aria-hidden />
            </span>
            <span className="hidden text-sm sm:inline">زمان‌سنجی صنعتی</span>
            <Badge variant="secondary" className="hidden font-mono text-[10px] sm:inline-flex">فاز ۳</Badge>
          </button>

          <div className="flex-1" />

          {/* وضعیت آنلاین */}
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium",
              online
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                : "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
            )}
            role="status"
            aria-live="polite"
          >
            {online ? <Wifi className="size-3" aria-hidden /> : <WifiOff className="size-3" aria-hidden />}
            {online ? "آنلاین" : "آفلاین"}
          </span>

          {/* منوی کاربر */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2 font-normal">
                <span
                  className="flex size-7 items-center justify-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground"
                  aria-hidden
                >
                  {(user.name ?? user.email).trim().charAt(0) || "؟"}
                </span>
                <span className="hidden max-w-32 truncate md:inline">{user.name ?? user.email}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="flex flex-col">
                <span>{user.name ?? "بدون نام"}</span>
                <span className="text-xs font-normal text-muted-foreground" dir="ltr">{user.email}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => logout.mutate()} disabled={logout.isPending} className="gap-2 text-red-600 focus:text-red-600 dark:text-red-400">
                {logout.isPending ? <Spinner /> : null}
                خروج از حساب
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-4 py-6">
        {/* سایدبار دسکتاپ */}
        <aside className="hidden w-60 shrink-0 lg:block" aria-label="ناوبری کناری">
          <div className="sticky top-20 space-y-4">
            <NavList view={view} onNavigate={onNavigate} />
          </div>
        </aside>

        {/* محتوا */}
        <main className="min-w-0 flex-1" aria-live="polite">
          {projectTitle && (view === "project" || view === "project-config" || view === "project-diagrams") ? (
            <nav aria-label="مسیر" className="mb-4 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
              <button className="hover:text-foreground hover:underline" onClick={() => onNavigate("dashboard")}>
                پروژه‌ها
              </button>
              <span aria-hidden>›</span>
              <span className="max-w-48 truncate font-medium text-foreground">{projectTitle}</span>
              {view === "project-config" ? (
                <>
                  <span aria-hidden>›</span>
                  <span className="font-medium text-foreground">کارگاه پیکربندی</span>
                </>
              ) : null}
              {view === "project-diagrams" ? (
                <>
                  <span aria-hidden>›</span>
                  <span className="font-medium text-foreground">طراح نمودارهای فرایندی</span>
                </>
              ) : null}
            </nav>
          ) : null}
          {children}
        </main>
      </div>

      {/* فوتر چسبان */}
      <footer className="mt-auto border-t bg-background">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs text-muted-foreground">
          <span>زمان‌سنجی صنعتی — نسخه ۰٫۴٫۰ (فاز ۳: طراح OPC/FPC و دستیار آفلاین)</span>
          <span className="flex items-center gap-2">
            <span className="inline-block size-1.5 rounded-full bg-emerald-500" aria-hidden />
            داده‌ها روی سرور ذخیره می‌شوند؛ پیش‌نویس نمودار برای کار آفلاین روی دستگاه می‌ماند
          </span>
        </div>
      </footer>
    </div>
  );
}
