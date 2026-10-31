"use client";

/**
 * هوک جلسه زمان‌سنجی — سیم‌کشی موتور خالص به مرورگر (فاز ۴):
 *  - بازسازی engine از (رویدادهای سرور ∪ ژورنال محلی) — قطعی
 *  - نمایش زنده با rAF که مقدار را هر فریم از perf می‌خواند (شمارنده ثانیه‌ای ممنوع — C3-۴)
 *  - هر رویداد بلافاصله به IndexedDB سپرده می‌شود → صف همگام‌سازی (debounce + آنلاین)
 *  - یکپارچگی: مخفی‌شدن صفحه (auto-pause صادقانه) + تشخیص خواب (مقایسه دیواری/یکنواخت در سگمنت فعال)
 *  - بازیابی پس از reload: recover() با پرچم clockRecovery — زمان جعل نمی‌شود
 *
 * نکته پیاده‌سازی: engine در state نگه داشته می‌شود (نه ref) تا دسترسی حین رندر
 * با قواعد React Compiler سازگار بماند؛ جهش‌های درونی engine با شمارنده eventsVersion
 * رندر را به‌روز می‌کنند.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/auth-client";
import { useSession } from "@/hooks/use-api";
import { BrowserClock, detectSleep, visibilityReturnFlag } from "@/shared/timing/clock";
import { ChronoEngine } from "@/shared/timing/engine";
import { deriveSession } from "@/shared/timing/derive";
import type { ChronoEvent, IntegrityFlag, TimingElementRef, TimingMethod } from "@/shared/timing/types";
import type { TimingSessionDetailDto } from "@/shared/contracts/timing";
import {
  appendEvents,
  flushSessionQueue,
  listLocalEvents,
  newClientEventId,
  putSessionMeta,
  type LocalChronoEvent,
} from "@/lib/timing-local-store";

const FLUSH_DEBOUNCE_MS = 2_500;

export interface UseTimingSessionResult {
  isLoading: boolean;
  error: string | null;
  session: TimingSessionDetailDto | null;
  engine: ChronoEngine | null;
  eventsVersion: number;
  derived: ReturnType<typeof deriveSession> | null;
  saveState: "local" | "synced" | "queued" | "conflict" | "recovered";
  queuedCount: number;
  lastSyncDetail: string | null;
  online: boolean;
  start: () => void;
  record: (elementKey?: string) => void;
  lap: () => void;
  newCycle: () => void;
  pause: (reason?: string) => void;
  resume: () => void;
  stop: () => void;
  note: (text: string) => void;
  correct: (targetEventId: string, newValueMs: number, reason: string) => void;
  finalize: () => Promise<unknown>;
  flushNow: () => void;
}

export function useTimingSession(projectId: string | null, sessionId: string | null): UseTimingSessionResult {
  const session = useSession();
  const qc = useQueryClient();

  const detailQuery = useQuery({
    queryKey: ["timing-session", projectId, sessionId],
    queryFn: () => api<TimingSessionDetailDto>(`/api/projects/${projectId}/timing/sessions/${sessionId}`),
    enabled: !!session.data && !!projectId && !!sessionId,
    refetchInterval: false,
  });

  const [engine, setEngine] = useState<ChronoEngine | null>(null);
  // آینه ref برای دسترسی در callbackها (event handler) — دسترسی حین رندر ممنوع (React Compiler)
  const engineRef = useRef<ChronoEngine | null>(null);
  const [eventsVersion, setEventsVersion] = useState(0);
  const [queuedCount, setQueuedCount] = useState(0);
  const [lastSyncDetail, setLastSyncDetail] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [recovered, setRecovered] = useState(false);
  const [online, setOnline] = useState(true);
  const [tick, setTick] = useState(0);

  const detail = detailQuery.data ?? null;

  // سگمنت فعال ثبت (بین resume تا pause) برای تشخیص خواب بدون مثبت کاذبِ مکث‌های مجاز
  const segmentRef = useRef<{ wallMs: number; elapsedMs: number } | null>(null);

  // ── وضعیت آنلاین ──
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

  // ── flush صف به سرور ──
  const doFlush = useCallback(async () => {
    if (!projectId || !sessionId) return null;
    const outcome = await flushSessionQueue(projectId, sessionId);
    setLastSyncDetail(outcome.detailFa);
    setConflict(outcome.outcome === "conflict");
    const pending = await listLocalEvents(sessionId).catch(() => [] as LocalChronoEvent[]);
    setQueuedCount(pending.filter((e) => e.synced === 0).length);
    if (outcome.outcome === "synced" && outcome.ingested > 0) {
      void qc.invalidateQueries({ queryKey: ["timing-sessions", projectId] });
    }
    return outcome;
  }, [projectId, sessionId, qc]);

  // ── ذخیره محلی + زمان‌بندی flush ──
  const persist = useCallback(
    async (events: ChronoEvent[]) => {
      if (events.length === 0 || !sessionId) return;
      const local: LocalChronoEvent[] = events.map((e) => ({ ...e, synced: 0 })) as LocalChronoEvent[];
      await appendEvents(local).catch(() => undefined);
      setQueuedCount((c) => c + local.length);
    },
    [sessionId],
  );

  // ── ساخت/بازسازی engine (رویدادهای سرور ∪ ژورنال محلی) ──
  useEffect(() => {
    if (!detail || !sessionId || !projectId) return;
    let cancelled = false;
    let flushTimer: ReturnType<typeof setTimeout> | null = null;

    (async () => {
      const localEvents = await listLocalEvents(sessionId).catch(() => [] as LocalChronoEvent[]);
      if (cancelled) return;

      const serverEvents = detail.events ?? [];
      const byId = new Map<string, ChronoEvent>();
      for (const ev of serverEvents) byId.set(ev.clientEventId, ev);
      for (const ev of localEvents) {
        if (!byId.has(ev.clientEventId)) byId.set(ev.clientEventId, ev as unknown as ChronoEvent);
      }
      const merged = [...byId.values()].sort((a, b) => a.seq - b.seq);

      const elements: TimingElementRef[] = detail.elements ?? [];
      const eng = new ChronoEngine({
        clock: new BrowserClock(),
        sessionId,
        method: (detail.method as TimingMethod) ?? "continuous",
        elements,
        idGen: newClientEventId,
      });
      eng.loadEvents(merged);

      // بازیابی پس از reload — یک‌بار در عمر صفحه؛ زمان جعل نمی‌شود (ADR-004)
      const ev = eng.recover();
      if (ev) {
        setRecovered(true);
        await appendEvents([{ ...(ev as unknown as LocalChronoEvent), synced: 0 }] as LocalChronoEvent[]).catch(
          () => undefined,
        );
        toast.info("جلسه بازیابی شد", {
          description:
            "زمان گذشته در غیاب صفحه قابل اندازه‌گیری قطعی نیست — این قطعه «نیازمند بررسی» علامت خورد. با «ادامه» ثبت را از همین لحظه ادامه دهید.",
        });
      } else if (eng.state().recovered || merged.some((e) => (e.integrity ?? []).includes("clockRecovery"))) {
        // بازگشایی جلسه‌ای که قبلاً بازیابی شده — نمایش صادقانه وضعیت «بازیابی‌شده»
        setRecovered(true);
      }

      segmentRef.current = null;
      engineRef.current = eng;
      setEngine(eng);
      setEventsVersion((v) => v + 1);
      const pending = await listLocalEvents(sessionId).catch(() => [] as LocalChronoEvent[]);
      setQueuedCount(pending.filter((e) => e.synced === 0).length);

      // فراداده محلی برای بازکردن آفلاین
      await putSessionMeta({
        sessionId,
        projectId,
        method: detail.method,
        observer: detail.observer,
        elements,
        elementAdvanceMode: detail.elementAdvanceMode,
        tolerancePct: detail.tolerancePct,
        status: detail.status,
        savedAt: new Date().toISOString(),
      }).catch(() => undefined);
    })();

    return () => {
      cancelled = true;
      if (flushTimer) clearTimeout(flushTimer);
    };
  }, [detail?.id, detail?.status, sessionId, projectId]);

  // ── زمان‌بندی flush (debounce روی صف) ──
  useEffect(() => {
    if (queuedCount === 0 || !projectId || !sessionId) return;
    const t = setTimeout(() => void doFlush(), FLUSH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [queuedCount, doFlush, projectId, sessionId]);

  // ── flush خودکار هنگام بازگشت آنلاین ──
  useEffect(() => {
    if (online && queuedCount > 0) {
      const t = setTimeout(() => void doFlush(), 600);
      return () => clearTimeout(t);
    }
  }, [online, queuedCount, doFlush]);

  // ── تیک نمایش زنده (rAF — فقط هنگام ثبت فعال) ──
  const phaseNow = engine?.state().phase ?? "idle";
  useEffect(() => {
    if (phaseNow !== "running") return;
    let raf = 0;
    const loop = () => {
      setTick((t) => (t + 1) % 1_000_000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phaseNow]);
  void tick;

  // ── یکپارچگی: مخفی‌شدن صفحه → auto-pause صادقانه + پرچم ──
  useEffect(() => {
    let hiddenAt: { perfMs: number } | null = null;
    const onVisibility = async () => {
      const eng = engine;
      if (!eng) return;
      if (document.hidden) {
        hiddenAt = { perfMs: performance.now() };
      } else if (hiddenAt) {
        const hiddenMs = performance.now() - hiddenAt.perfMs;
        hiddenAt = null;
        const flag = visibilityReturnFlag(hiddenMs);
        if (eng.state().phase === "running" && flag) {
          segmentRef.current = null;
          const ev = eng.pause("صفحه/تب هنگام ثبت مخفی شد", [flag]);
          setEventsVersion((v) => v + 1);
          await persist([ev]).catch(() => undefined);
          toast.warning("ثبت به‌علت مخفی‌شدن صفحه متوقف شد", {
            description: "کیفیت این قطعه «نیازمند بررسی» علامت خورد — با «ادامه» از همین لحظه ادامه دهید.",
          });
        } else {
          setEventsVersion((v) => v + 1);
        }
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [engine, persist]);

  // ── اجرای عملیات engine + تشخیص خواب + ذخیره ──
  // فقط از event handlerها فراخوانده می‌شود (نه حین رندر) — ref اینجا مجاز است
  const runEngineAction = useCallback(
    (fn: (eng: ChronoEngine) => ChronoEvent | ChronoEvent[]) => {
      const current = engineRef.current;
      if (!current) return;
      let result: ChronoEvent | ChronoEvent[];
      try {
        result = fn(current);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "عملیات نامعتبر است.");
        setEventsVersion((v) => v + 1);
        return;
      }
      const events = Array.isArray(result) ? result : [result];

      // تشخیص خواب در سگمنت فعال: انحراف دیواری/یکنواخت نسبت به شروع سگمنت
      const wasRunningBefore = current.state().phase === "running";
      let sleepFlag: IntegrityFlag | null = null;
      const seg = segmentRef.current;
      if (wasRunningBefore && seg) {
        const nowWall = Date.now();
        const nowElapsed = current.elapsedActiveMs(); // پس از عمل
        if (detectSleep(seg.wallMs, seg.elapsedMs, nowWall, nowElapsed)) {
          sleepFlag = "sleepSuspected";
        }
      }

      const flagged = sleepFlag
        ? events.map((ev) => ({ ...ev, integrity: [...(ev.integrity ?? []), sleepFlag] as IntegrityFlag[] }))
        : events;

      // به‌روزرسانی سگمنت فعال
      const phaseAfter = current.state().phase;
      if (phaseAfter === "running" && !wasRunningBefore) {
        segmentRef.current = { wallMs: Date.now(), elapsedMs: current.elapsedActiveMs() };
      } else if (phaseAfter !== "running") {
        segmentRef.current = null;
      }

      void persist(flagged);
      setEventsVersion((v) => v + 1);
    },
    [persist],
  );

  // ── عملیات عمومی ──
  const start = useCallback(() => {
    runEngineAction((eng) => {
      const ev = eng.start();
      segmentRef.current = { wallMs: Date.now(), elapsedMs: 0 };
      return ev;
    });
  }, [runEngineAction]);

  const record = useCallback(
    (elementKey?: string) => {
      runEngineAction((eng) => {
        // اگر چرخه باز نیست، این ثبت = شروع چرخه (r₀) — قرائت ثبت نمی‌شود
        // (روش پیوسته: r0 در آغاز چرخه؛ مدت عنصر ۱ = تفاضل قرائت بعدی با r0 — TS-003)
        if (!eng.state().hasOpenCycle && eng.state().phase === "running") {
          return [eng.cycleStart()];
        }
        const main = eng.method === "snapback" ? eng.recordElement(elementKey) : eng.recordReading(elementKey);
        return [main];
      });
    },
    [runEngineAction],
  );

  const lap = useCallback(() => {
    runEngineAction((eng) => eng.lap());
  }, [runEngineAction]);

  const newCycle = useCallback(() => {
    runEngineAction((eng) => eng.cycleStart());
  }, [runEngineAction]);

  const pause = useCallback(
    (reason?: string) => {
      runEngineAction((eng) => eng.pause(reason));
    },
    [runEngineAction],
  );

  const resume = useCallback(() => {
    runEngineAction((eng) => {
      const ev = eng.resume();
      segmentRef.current = { wallMs: Date.now(), elapsedMs: eng.elapsedActiveMs() };
      return ev;
    });
  }, [runEngineAction]);

  const stop = useCallback(() => {
    runEngineAction((eng) => eng.stop());
    setTimeout(() => void doFlush(), 300);
  }, [runEngineAction, doFlush]);

  const note = useCallback(
    (text: string) => {
      runEngineAction((eng) => eng.note(text));
    },
    [runEngineAction],
  );

  const correct = useCallback(
    (targetEventId: string, newValueMs: number, reason: string) => {
      runEngineAction((eng) => eng.correct(targetEventId, newValueMs, reason));
    },
    [runEngineAction],
  );

  // ── نهایی‌سازی ──
  const finalizeMutation = useMutation({
    mutationFn: async () => {
      if (!projectId || !sessionId) throw new Error("جلسه مشخص نیست.");
      await flushSessionQueue(projectId, sessionId);
      return api<{ status: string; cycles: number; completedCycles: number }>(
        `/api/projects/${projectId}/timing/sessions/${sessionId}/finalize`,
        { method: "POST" },
      );
    },
    onSuccess: () => {
      toast.success("جلسه نهایی شد", { description: "چرخه‌های مشتق برای تحلیل ذخیره و جلسه قفل شد." });
      void qc.invalidateQueries({ queryKey: ["timing-session", projectId, sessionId] });
      void qc.invalidateQueries({ queryKey: ["timing-sessions", projectId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const flushNow = useCallback(() => {
    void doFlush();
  }, [doFlush]);

  // ── مشتق برای رندر (فقط با تغییر رویدادها/جلسه بازمحاسبه — نه با تیک نمایش) ──
  const derived = useMemo(() => {
    if (!engine || !detail) return null;
    return deriveSession([...engine.events()], detail.elements ?? [], {
      method: (detail.method as TimingMethod) ?? "continuous",
      tolerancePct: detail.tolerancePct,
    });
  }, [engine, eventsVersion, detail]);

  const saveState: UseTimingSessionResult["saveState"] = conflict
    ? "conflict"
    : recovered
      ? "recovered"
      : queuedCount > 0
        ? "queued"
        : lastSyncDetail
          ? "synced"
          : "local";

  return {
    isLoading: detailQuery.isLoading,
    error: detailQuery.error ? (detailQuery.error as Error).message : null,
    session: detail,
    engine,
    eventsVersion,
    derived,
    saveState,
    queuedCount,
    lastSyncDetail,
    online,
    start,
    record,
    lap,
    newCycle,
    pause,
    resume,
    stop,
    note,
    correct,
    finalize: finalizeMutation.mutateAsync,
    flushNow,
  };
}
