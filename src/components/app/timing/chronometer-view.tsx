"use client";

/**
 * صفحه ثبت زنده — کرنومتر (فاز ۴ · B8 رابط کاربری):
 *  - زمان بزرگ خوانا + شماره چرخه + عنصر جاری + کنترل‌های واضح
 *  - عناصر لمسی ≥۴۴px + میانبر صفحه‌کلید + ثبت معمول بدون فرم کند
 *  - مکث با علت وقفه + یادداشت سریع + وضعیت ذخیره + پرچم‌های یکپارچگی
 *  - قرائت‌های اخیر با تفاضل زنده (TS-003)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Flag,
  Pause,
  Play,
  RotateCcw,
  Square,
  StickyNote,
  Tag,
  Timer as TimerIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useTimingSession } from "@/hooks/use-timing-session";
import {
  CHRONO_EVENT_LABELS_FA,
  formatShortMs,
  TIMING_METHOD_LABELS_FA,
  formatDurationMs,
  type TimingMethod,
} from "@/shared/timing/types";
import { BigTimer, IntegrityBanner, KpiCell, MethodBadge, SaveStateChip, ShortcutHint, SplitTimer, EventTypeBadge, faDigits } from "./timing-bits";

const INTERRUPTION_REASONS = [
  "خرابی فیکسچر",
  "کمبود قطعه",
  "گفت‌وگوی اپراتور",
  "خرابی تجهیز",
  "انتظار حمل",
  "تعویض ابزار",
  "سایر",
];

interface ChronometerViewProps {
  projectId: string;
  sessionId: string;
  onExit: () => void; // بازگشت به فهرست جلسات
}

export function ChronometerView({ projectId, sessionId, onExit }: ChronometerViewProps) {
  const ts = useTimingSession(projectId, sessionId);
  const [noteText, setNoteText] = useState("");
  const [interruptionReason, setInterruptionReason] = useState(INTERRUPTION_REASONS[0]);
  const [manualElement, setManualElement] = useState<string | null>(null); // حالت دستی
  const noteInputRef = useRef<HTMLInputElement>(null);

  const engine = ts.engine;
  const state = engine?.state();
  const phase = state?.phase ?? "idle";
  const running = phase === "running";
  const method = (ts.session?.method as TimingMethod) ?? "continuous";
  const advanceMode = ts.session?.elementAdvanceMode ?? "auto";
  const elements = ts.session?.elements ?? [];

  // ثبت با کیبورد: Space=ثبت، Enter=چرخه جدید، P=مکث، R=ادامه
  // الگوی ref: closure تازه در effect (بدون دسترسی به ref حین رندر — سازگار با React Compiler)
  const keyHandlerRef = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    keyHandlerRef.current = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (running) ts.record(advanceMode === "manual" ? (manualElement ?? undefined) : undefined);
      } else if (e.code === "Enter") {
        e.preventDefault();
        if (running) ts.newCycle();
      } else if (e.key.toLowerCase() === "p" || e.key === "پ") {
        if (running) ts.pause();
      } else if (e.key.toLowerCase() === "r" || e.key === "ق") {
        if (phase === "paused") ts.resume();
      } else if (e.code === "Escape") {
        if (phase === "running" || phase === "paused") ts.stop();
      }
    };
  });

  useEffect(() => {
    const fn = (e: KeyboardEvent) => keyHandlerRef.current(e);
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);

  // رویدادهای اخیر (برای فید زنده) — محاسبه سبک در هر رندر (بدون useMemo با وابستگی ناپایدار)
  const recentEvents = engine ? [...engine.events()].slice(-10).reverse() : [];
  void ts.eventsVersion;

  // عنصر جاری (نمایش)
  const currentElement = elements.find((el) => el.key === state?.currentElementKey) ?? null;
  const nextElement = elements.find((el) => el.key === state?.nextElementKey) ?? null;
  const selectedKey = advanceMode === "manual" ? manualElement ?? state?.currentElementKey ?? null : state?.currentElementKey ?? null;

  // آخرین مرز (cycleStart/reading/element/lap) — برای نمایش split بازگشت به صفر
  const lastBoundary = (() => {
    if (!engine) return 0;
    const evs = engine.events();
    for (let i = evs.length - 1; i >= 0; i -= 1) {
      const t = evs[i].type;
      if (t === "cycleStart" || t === "reading" || t === "element" || t === "lap") return evs[i].elapsedActiveMs;
    }
    return 0;
  })();

  if (ts.isLoading) {
    return (
      <div className="flex min-h-64 items-center justify-center rounded-xl border bg-muted/20 p-8 text-sm text-muted-foreground">
        بارگذاری جلسه زمان‌سنجی…
      </div>
    );
  }
  if (ts.error || !ts.session || !engine) {
    return (
      <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300" role="alert">
        {ts.error ?? "جلسه یافت نشد."}
        <Button variant="outline" size="sm" className="mt-3 block" onClick={onExit}>
          بازگشت به فهرست
        </Button>
      </div>
    );
  }

  const elapsed = engine.elapsedActiveMs();
  const splitNow = Math.max(0, elapsed - lastBoundary);
  const finalized = ts.session.status === "finalized";
  const derivedFlags = ts.derived?.flags ?? [];

  return (
    <div className="space-y-4">
      {/* هدر جلسه */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <MethodBadge method={method} />
          <Badge variant="outline" className="text-[11px]">ناظر: {ts.session.observer}</Badge>
          <Badge variant="outline" className="text-[11px]">تلورانس: {faDigits(ts.session.tolerancePct)}٪</Badge>
          <Badge variant="outline" className="text-[11px]">پیش‌روی: {advanceMode === "auto" ? "خودکار" : "دستی"}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <SaveStateChip state={ts.saveState} queuedCount={ts.queuedCount} detail={ts.lastSyncDetail} />
          <Button variant="outline" size="sm" onClick={onExit}>
            فهرست جلسات
          </Button>
        </div>
      </div>

      {/* بنر بازیابی/یکپارچگی */}
      {ts.saveState === "recovered" ? (
        <div role="alert" className="rounded-lg border border-violet-300 bg-violet-50/70 px-3 py-2 text-xs text-violet-800 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300">
          <p className="flex items-center gap-1.5 font-semibold">
            <RotateCcw className="size-4" aria-hidden /> جلسه بازیابی‌شده — نیازمند بررسی
          </p>
          <p className="mt-0.5 leading-5">
            زمان گذشته در غیاب صفحه قابل اندازه‌گیری قطعی نیست؛ قطعه مربوط علامت خورده است. با «ادامه» ثبت را از همین لحظه
            ادامه دهید.
          </p>
        </div>
      ) : null}
      <IntegrityBanner flags={derivedFlags} />

      {/* نمایشگر بزرگ */}
      <div className="rounded-xl border-2 border-primary/30 bg-gradient-to-bl from-primary/5 to-transparent p-5 text-center sm:p-7">
        <BigTimer ms={elapsed} active={running} />
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>چرخه: <span className="font-bold text-foreground">{faDigits(state?.cycleNo ?? 0)}</span></span>
          <span>
            عنصر جاری:{" "}
            <span className="font-semibold text-foreground">
              {currentElement ? `${faDigits(elements.findIndex((e) => e.key === currentElement.key) + 1)}/${faDigits(elements.length)} — ${currentElement.name}` : "—"}
            </span>
          </span>
          {nextElement && running ? <span>بعدی: {nextElement.name}</span> : null}
          <span>{TIMING_METHOD_LABELS_FA[method]}</span>
        </div>

        {method === "snapback" ? (
          <div className="mt-3 flex items-center justify-center gap-8">
            <SplitTimer ms={splitNow} label="بازگشت به صفر (عنصر جاری)" />
            <SplitTimer ms={elapsed} label="جمعی جلسه" />
          </div>
        ) : null}
      </div>

      {/* کنترل‌های اصلی — لمسی بزرگ */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {phase === "idle" ? (
          <Button size="lg" className="min-w-32 gap-2" onClick={ts.start} disabled={finalized} aria-keyshortcuts="S">
            <Play className="size-5" aria-hidden /> شروع جلسه
          </Button>
        ) : null}
        {running ? (
          <>
            <Button
              size="lg"
              className="min-w-36 gap-2 text-base"
              onClick={() => ts.record(advanceMode === "manual" ? (manualElement ?? undefined) : undefined)}
              aria-keyshortcuts="Space"
            >
              <Tag className="size-5" aria-hidden />
              {method === "snapback" ? "ثبت عنصر" : "ثبت قرائت"}
            </Button>
            <Button size="lg" variant="outline" className="min-w-28 gap-2" onClick={ts.newCycle} aria-keyshortcuts="Enter">
              <Flag className="size-5" aria-hidden /> شروع چرخه
            </Button>
            {method === "laps" ? (
              <Button size="lg" variant="secondary" className="min-w-24 gap-2" onClick={ts.lap}>
                <TimerIcon className="size-5" aria-hidden /> حلقه
              </Button>
            ) : null}
            <Button size="lg" variant="outline" className="min-w-24 gap-2 text-amber-700 dark:text-amber-400" onClick={() => ts.pause()}>
              <Pause className="size-5" aria-hidden /> مکث
            </Button>
          </>
        ) : null}
        {phase === "paused" ? (
          <Button size="lg" className="min-w-32 gap-2" onClick={ts.resume} aria-keyshortcuts="R">
            <Play className="size-5" aria-hidden /> ادامه
          </Button>
        ) : null}
        {phase === "running" || phase === "paused" ? (
          <Button
            size="lg"
            variant="outline"
            className="min-w-24 gap-2 text-destructive"
            onClick={ts.stop}
            aria-keyshortcuts="Escape"
          >
            <Square className="size-5" aria-hidden /> پایان جلسه
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
        <ShortcutHint keys={["Space"]} label="ثبت" />
        <ShortcutHint keys={["Enter"]} label="چرخه جدید" />
        <ShortcutHint keys={["P"]} label="مکث" />
        <ShortcutHint keys={["R"]} label="ادامه" />
      </div>

      {/* عناصر + پنل وقفه/یادداشت */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* عناصر — لمسی */}
        <div className="rounded-xl border bg-card p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">عناصر کار (لمسی)</h3>
            <span className="text-[11px] text-muted-foreground">
              {advanceMode === "auto" ? "پس از ثبت، عنصر بعدی فعال می‌شود" : "عنصر را انتخاب و ثبت کنید"}
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {elements.map((el, i) => {
              const isSelected = selectedKey === el.key;
              return (
                <button
                  key={el.key}
                  type="button"
                  onClick={() => {
                    if (advanceMode === "manual") {
                      setManualElement(el.key);
                      if (running) ts.record(el.key);
                    } else if (running) {
                      // در حالت خودکار: ثبت صریح همین عنصر
                      ts.record(el.key);
                    }
                  }}
                  disabled={!running}
                  aria-pressed={isSelected}
                  className={cn(
                    "flex min-h-11 items-center justify-between rounded-lg border px-3 py-2 text-right transition-colors disabled:opacity-50",
                    isSelected
                      ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                      : "border-border hover:bg-accent",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        "grid size-6 place-items-center rounded-full text-[11px] font-bold",
                        isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {faDigits(i + 1)}
                    </span>
                    <span className="text-xs font-semibold sm:text-[13px]">{el.name}</span>
                  </span>
                  {el.activityStableKey ? (
                    <Badge variant="outline" className="text-[9px]">فعالیت</Badge>
                  ) : null}
                </button>
              );
            })}
            {elements.length === 0 ? (
              <p className="col-span-2 rounded-lg border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
                جلسه بدون عنصر است — ثبت قرائت بدون عنصر هم انجام می‌شود.
              </p>
            ) : null}
          </div>
        </div>

        {/* وقفه و یادداشت سریع */}
        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold">وقفه و یادداشت سریع</h3>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="ir-reason" className="text-xs">علت وقفه (برای مکث)</Label>
                <Select value={interruptionReason} onValueChange={setInterruptionReason}>
                  <SelectTrigger id="ir-reason" className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERRUPTION_REASONS.map((r) => (
                      <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1.5"
                disabled={!running}
                onClick={() => ts.pause(interruptionReason)}
              >
                <Pause className="size-4" aria-hidden /> مکث با این علت
              </Button>
              <div className="space-y-1.5">
                <Label htmlFor="quick-note" className="text-xs">یادداشت سریع</Label>
                <div className="flex gap-2">
                  <Input
                    id="quick-note"
                    ref={noteInputRef}
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="مثلاً: تعویض اپراتور…"
                    className="h-9 text-xs"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-9 shrink-0"
                    aria-label="ثبت یادداشت"
                    disabled={!noteText.trim()}
                    onClick={() => {
                      ts.note(noteText);
                      setNoteText("");
                    }}
                  >
                    <StickyNote className="size-4" aria-hidden />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* KPI جلسه */}
          <div className="grid grid-cols-2 gap-2">
            <KpiCell k="چرخه‌های کامل" v={faDigits(ts.derived?.completedCycles ?? 0)} note={`از ${faDigits(ts.derived?.cycles.length ?? 0)} چرخه`} />
            <KpiCell k="وقفه‌ها" v={faDigits(ts.derived?.interruptions.length ?? 0)} note={ts.derived?.pausedMs != null ? `مجموع ${formatShortMs(ts.derived.pausedMs)}` : "شامل جزء نامشخص"} tone={ts.derived?.pausedMs == null && (ts.derived?.interruptions.length ?? 0) > 0 ? "warning" : "default"} />
          </div>
        </div>
      </div>

      {/* فید رویدادهای اخیر */}
      <div className="rounded-xl border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold">رویدادهای اخیر (append-only)</h3>
        {recentEvents.length === 0 ? (
          <p className="rounded-lg border border-dashed bg-muted/30 p-3 text-center text-xs text-muted-foreground">
            پس از «شروع جلسه»، رویدادها اینجا زنده نمایش داده می‌شوند.
          </p>
        ) : (
          <ul className="max-h-64 space-y-1.5 overflow-y-auto text-xs" aria-live="polite">
            {recentEvents.map((ev) => (
              <li key={ev.clientEventId} className="flex items-center justify-between gap-2 rounded-lg border bg-muted/20 px-2.5 py-1.5">
                <span className="flex items-center gap-2">
                  <EventTypeBadge type={ev.type} />
                  <span className="text-muted-foreground">{CHRONO_EVENT_LABELS_FA[ev.type]}</span>
                  {ev.elementId ? (
                    <span className="font-medium">{elements.find((e) => e.key === ev.elementId)?.name ?? ev.elementId}</span>
                  ) : null}
                  {ev.interruptionReason ? <span className="text-amber-700 dark:text-amber-400">({ev.interruptionReason})</span> : null}
                  {ev.note ? <span className="text-muted-foreground">— {ev.note}</span> : null}
                  {ev.integrity && ev.integrity.length > 0 ? (
                    <AlertTriangle className="size-3.5 text-amber-600" aria-label="پرچم کیفیت" />
                  ) : null}
                </span>
                <span dir="ltr" className="font-mono tabular-nums text-muted-foreground">
                  {formatDurationMs(ev.elapsedActiveMs)}
                  {ev.splitMs !== undefined ? ` · Δ${formatShortMs(ev.splitMs)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
        {ts.saveState === "conflict" ? (
          <div role="alert" className="mt-3 rounded-lg border border-red-300 bg-red-50 p-2.5 text-[11px] text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
            تعارض همگام‌سازی: {ts.lastSyncDetail} — رویدادها در صف محلی امن هستند؛ پس از رفع مشکل «همگام‌سازی» را بزنید.
            <Button variant="outline" size="sm" className="mt-2 block" onClick={ts.flushNow}>
              همگام‌سازی مجدد
            </Button>
          </div>
        ) : null}
      </div>

      {/* پایان جلسه → نهایی‌سازی */}
      {phase === "stopped" && !finalized ? (
        <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 text-center">
          <p className="text-sm font-semibold">جلسه پایان یافت — {faDigits(ts.derived?.completedCycles ?? 0)} چرخه کامل ثبت شد</p>
          <p className="mt-1 text-xs text-muted-foreground">
            نهایی‌سازی چرخه‌های مشتق را برای تحلیل فاز ۵ ذخیره و جلسه را قفل می‌کند؛ پیش از آن اصلاح رویدادها مجاز است.
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <Button variant="outline" onClick={onExit}>بازگشت (بدون نهایی‌سازی)</Button>
            <Button onClick={() => void ts.finalize()}>نهایی‌سازی جلسه</Button>
          </div>
        </div>
      ) : null}
      {finalized ? (
        <div className="rounded-xl border bg-muted/30 p-4 text-center text-sm">
          <p className="font-semibold">این جلسه نهایی شده است (قفل برای تحلیل)</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={onExit}>بازگشت به فهرست</Button>
        </div>
      ) : null}
    </div>
  );
}
