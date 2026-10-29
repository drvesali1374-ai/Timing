"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Pause, Play, RotateCcw, Save, Square, Tag } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { KpiCard, PanelCard, SectionTitle } from "../ui-bits";
import { demoReadings, demoTimingElements, faClock, faDigits } from "../data";

type ChronoState = "idle" | "running" | "paused" | "stopped";

/**
 * نمایش زنده «مفهوم» موتور کرنومتر فاز صفر:
 * - فاصله‌ها از performance.now() یکنواخت (نه شمارنده ثانیه‌ای) — ADR-004
 * - قرائت‌ها append-only با شناسه idempotent (اینجا: شماره ترتیبی نمایشی)
 * این کامپوننت صرفاً وایرفریم/دموی مفهومی است و موتور واقعی فاز ۴ است.
 */
function useConceptChrono() {
  const [state, setState] = useState<ChronoState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [readings, setReadings] = useState<number[]>([]);
  const [integrity, setIntegrity] = useState<string[]>([]);
  const startRef = useRef<number | null>(null);
  const accRef = useRef(0);
  const hiddenAtRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const tick = () => {
      if (startRef.current !== null) {
        setElapsed(accRef.current + (performance.now() - startRef.current) / 1000);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        hiddenAtRef.current = performance.now();
      } else if (hiddenAtRef.current !== null) {
        const gap = (performance.now() - hiddenAtRef.current) / 1000;
        if (gap > 2 && state === "running") {
          setIntegrity((prev) =>
            prev.includes("visibilityLoss") ? prev : [...prev, "visibilityLoss"],
          );
        }
        hiddenAtRef.current = null;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [state]);

  const start = () => {
    startRef.current = performance.now();
    setState("running");
    setIntegrity([]);
  };
  const pause = () => {
    if (startRef.current !== null) {
      accRef.current += (performance.now() - startRef.current) / 1000;
      startRef.current = null;
    }
    setState("paused");
  };
  const resume = () => {
    startRef.current = performance.now();
    setState("running");
  };
  const stop = () => {
    if (startRef.current !== null) {
      accRef.current += (performance.now() - startRef.current) / 1000;
      startRef.current = null;
    }
    setState("stopped");
  };
  const reset = () => {
    startRef.current = null;
    accRef.current = 0;
    setElapsed(0);
    setReadings([]);
    setIntegrity([]);
    setState("idle");
  };
  const record = () => {
    if (state !== "running") return;
    const t = accRef.current + (performance.now() - (startRef.current ?? performance.now())) / 1000;
    setReadings((prev) => [...prev, t]);
  };

  return { state, elapsed, readings, integrity, start, pause, resume, stop, reset, record };
}

const stateLabel: Record<ChronoState, string> = {
  idle: "آماده",
  running: "در حال ثبت",
  paused: "مکث",
  stopped: "پایان‌یافته",
};

export function TimingView() {
  const chrono = useConceptChrono();
  const [currentElement, setCurrentElement] = useState(2);
  const [cycle, setCycle] = useState(12);
  const [interruption, setInterruption] = useState("خرابی فیکسچر");
  const [saveState, setSaveState] = useState("ذخیره محلی ✓ — همگام با سرور");

  const diffs = chrono.readings
    .map((r, i) => (i === 0 ? r : r - chrono.readings[i - 1]))
    .slice(-8)
    .map((d) => d.toFixed(2));

  return (
    <div className="space-y-5">
      <SectionTitle
        title="صفحه زمان‌سنجی"
        sub="موتور کرنومتر از UI جدا است؛ فاصله‌ها از performance.now() یکنواخت سنجیده می‌شوند — نه شمارنده ثانیه‌ای (ADR-004)"
        tag
      />

      <PanelCard
        title="جلسه شماره ۷ — روش: پیوسته"
        titleExtra={
          <Badge variant="outline" className="gap-1 text-[11px]">
            وضعیت: {stateLabel[chrono.state]}
          </Badge>
        }
      >
        {/* نمایشگر بزرگ */}
        <div className="rounded-xl border-2 border-primary/30 bg-gradient-to-bl from-primary/5 to-transparent p-6 text-center">
          <p
            className="font-mono text-4xl font-black tracking-wider text-foreground sm:text-6xl"
            dir="ltr"
            aria-live="off"
          >
            {faClock(chrono.elapsed)}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            زمان یکنواخت سپری‌شده (monotonic) — نمایش میلی‌ثانیه · چرخه {faDigits(cycle)} · عنصر جاری:{" "}
            <span className="font-semibold text-foreground">
              {faDigits(currentElement + 1)}/۷ — {demoTimingElements[currentElement].name}
            </span>
          </p>
          {chrono.integrity.includes("visibilityLoss") ? (
            <p className="mx-auto mt-3 flex max-w-md items-center justify-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-400">
              <AlertTriangle className="size-4 shrink-0" aria-hidden />
              تب صفحه مخفی شد — کیفیت ثبت «نیازمند بررسی» علامت خورد (رفتار واقعی ADR-004)
            </p>
          ) : null}
        </div>

        {/* کنترل‌ها */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {chrono.state === "idle" ? (
            <Button size="lg" className="min-w-28 gap-2" onClick={chrono.start}>
              <Play className="size-5" /> شروع
            </Button>
          ) : chrono.state === "running" ? (
            <Button size="lg" variant="outline" className="min-w-28 gap-2" onClick={chrono.pause}>
              <Pause className="size-5" /> مکث
            </Button>
          ) : chrono.state === "paused" ? (
            <Button size="lg" className="min-w-28 gap-2" onClick={chrono.resume}>
              <Play className="size-5" /> ادامه
            </Button>
          ) : null}
          <Button
            size="lg"
            variant="secondary"
            className="min-w-28 gap-2"
            onClick={chrono.record}
            disabled={chrono.state !== "running"}
            aria-keyshortcuts="Space"
          >
            <Tag className="size-5" /> ثبت قرائت
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="min-w-28 gap-2 text-destructive"
            onClick={chrono.stop}
            disabled={chrono.state === "idle" || chrono.state === "stopped"}
          >
            <Square className="size-5" /> توقف
          </Button>
          <Button size="lg" variant="ghost" className="gap-2" onClick={chrono.reset} aria-label="بازنشانی جلسه نمایشی">
            <RotateCcw className="size-5" /> بازنشانی
          </Button>
        </div>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          کلید میانبر قابل تنظیم: <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">Space</kbd> = ثبت
          · ثبت معمول بدون عبور از فرم چندمرحله‌ای (بند B8)
        </p>
      </PanelCard>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* فهرست عناصر */}
        <PanelCard
          title="عناصر کار (لمسی — هدف ≥۴۴px)"
          className="lg:col-span-2"
          titleExtra={
            <Button variant="outline" size="sm" className="h-7 text-[11px]">
              حرکت خودکار/دستی
            </Button>
          }
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {demoTimingElements.map((el, i) => (
              <button
                key={el.no}
                type="button"
                onClick={() => setCurrentElement(i)}
                aria-pressed={currentElement === i}
                className={cn(
                  "flex min-h-11 items-center justify-between rounded-lg border px-3 py-2 text-right transition-colors",
                  currentElement === i
                    ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                    : "border-border hover:bg-accent",
                )}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      "grid size-6 place-items-center rounded-full text-[11px] font-bold",
                      currentElement === i ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {faDigits(el.no)}
                  </span>
                  <span className="text-xs font-semibold sm:text-[13px]">{el.name}</span>
                </span>
                <Badge variant="outline" className="text-[10px]">
                  {el.hint}
                </Badge>
              </button>
            ))}
          </div>
        </PanelCard>

        {/* وقفه و وضعیت ذخیره */}
        <div className="space-y-4">
          <PanelCard title="وقفه و یادداشت سریع">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="ir-reason" className="text-xs">
                  علت وقفه
                </Label>
                <Select value={interruption} onValueChange={setInterruption}>
                  <SelectTrigger id="ir-reason" className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="خرابی فیکسچر">خرابی فیکسچر</SelectItem>
                    <SelectItem value="کمبود قطعه">کمبود قطعه</SelectItem>
                    <SelectItem value="گفت‌وگوی اپراتور">گفت‌وگوی اپراتور</SelectItem>
                    <SelectItem value="سایر">سایر</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ir-note" className="text-xs">
                  یادداشت
                </Label>
                <Input id="ir-note" placeholder="یادداشت سریع…" className="h-9 text-xs" />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1.5"
                onClick={() => setCycle((c) => c + 1)}
              >
                ثبت وقفه و شروع چرخه {faDigits(cycle + 1)}
              </Button>
            </div>
          </PanelCard>

          <PanelCard title="وضعیت ذخیره و همگام‌سازی">
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-2.5 text-[11px]">
                <Save className="size-4 shrink-0 text-primary" aria-hidden />
                <span>{saveState}</span>
              </div>
              <Select defaultValue={saveState} onValueChange={setSaveState}>
                <SelectTrigger className="h-8 text-[11px]" aria-label="شبیه‌سازی وضعیت ذخیره">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ذخیره محلی ✓ — همگام با سرور">ذخیره محلی ✓ — همگام با سرور</SelectItem>
                  <SelectItem value="آفلاین — در صف محلی (IndexedDB)">آفلاین — در صف محلی (IndexedDB)</SelectItem>
                  <SelectItem value="تعارض همگام‌سازی — نیازمند تصمیم">تعارض همگام‌سازی — نیازمند تصمیم</SelectItem>
                  <SelectItem value="بازیابی‌شده پس از reload — نیازمند بررسی">بازیابی‌شده پس از reload — نیازمند بررسی</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] leading-5 text-muted-foreground">
                هر رویداد شناسه idempotent دارد؛ کلیک تکراری یا retry شبکه باعث دوباره‌شماری نمی‌شود.
              </p>
            </div>
          </PanelCard>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <PanelCard title="قرائت‌های اخیر (زنده)" className="lg:col-span-2">
          {diffs.length === 0 ? (
            <p className="rounded-lg border border-dashed bg-muted/30 p-4 text-center text-xs text-muted-foreground">
              پس از «شروع»، با دکمه «ثبت قرائت» تفاضل‌های پیوسته را ببینید — {demoReadings.length} قرائت ذخیره‌شده جلسات قبل
              موجود است.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2" dir="rtl">
              {diffs.map((d, i) => (
                <Badge key={i} variant="outline" className="font-mono text-[11px]" dir="ltr">
                  {faDigits(d)}s
                </Badge>
              ))}
            </div>
          )}
          {diffs.length === 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {demoReadings.map((d, i) => (
                <Badge key={i} variant="secondary" className="font-mono text-[11px]" dir="ltr">
                  {faDigits(d.toFixed(2))}s
                </Badge>
              ))}
            </div>
          ) : null}
          <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
            در روش پیوسته، عنصر پس از ثبت تفکیک می‌شود و «جمع عناصر = مدت چرخه ± تلورانس» کنترل می‌شود (TS-005).
          </p>
        </PanelCard>

        <div className="space-y-3">
          <KpiCard k="چرخه‌های ثبت‌شده جلسه" v={faDigits(cycle)} note="۳ چرخه بازیابی‌شده با پرچم بررسی" tone="warning" />
          <KpiCard k="رویدادهای جلسه" v={faDigits(chrono.readings.length + 96)} note="append-only — بدون حذف فیزیکی" />
        </div>
      </div>

      <div className="rounded-lg border border-dashed bg-muted/30 p-3 text-[11px] leading-6 text-muted-foreground">
        <span className="font-semibold text-foreground">در محصول نهایی (فاز ۴):</span> زمان‌سنجی پیوسته/بازگشت به صفر/lap،
        ثبت فعالیت موازی اپراتور–ماشین، چند جریان هم‌زمان، بازیابی پس از reload/خواب دستگاه با پرچم کیفیت، شبیه‌سازی
        تعویض تب و قطع اینترنت در آزمون‌ها.
      </div>
    </div>
  );
}
