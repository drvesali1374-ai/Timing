/**
 * ذخیره محلی سمت کاربر برای زمان‌سنجی (ADR-006/013 — فاز ۴):
 *  - ژورنال رویدادهای append-only هر جلسه (بازیابی پس از reload)
 *  - صف همگام‌سازی با کلید idempotent (clientEventId) — retry/کلیک تکراری دوباره‌شماری نمی‌کند
 * IndexedDB خام (بدون وابستگی) — DB اختصاصی «timing-chrono».
 *
 * این لایه فقط زیرساخت کلاینت است؛ منطق دامنه در shared/timing است.
 */

"use client";

const DB_NAME = "timing-chrono";
const DB_VERSION = 1;
const STORE_SESSIONS = "sessions"; // فراداده جلسه + عناصر (بازکردن سریع آفلاین)
const STORE_EVENTS = "events"; // ژورنال رویداد append-only
const STORE_QUEUE = "queue"; // رویدادهای همگام‌نشده (batch های در انتظار ارسال)

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB در این مرورگر در دسترس نیست."));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
        db.createObjectStore(STORE_SESSIONS, { keyPath: "sessionId" });
      }
      if (!db.objectStoreNames.contains(STORE_EVENTS)) {
        const s = db.createObjectStore(STORE_EVENTS, { keyPath: "clientEventId" });
        s.createIndex("bySession", "sessionId", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        db.createObjectStore(STORE_QUEUE, { keyPath: "clientEventId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("باز کردن IndexedDB ناموفق بود."));
  });
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error("عملیات IndexedDB ناموفق بود."));
        t.oncomplete = () => db.close();
      }),
  );
}

// ─────────────────────── UUIDv7 مرورگر-امن (Web Crypto — RFC 9562) ───────────────────────

function uuidv7Browser(): string {
  const ts = Date.now();
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  // مهر زمان ۴۸-بیتی
  bytes[0] = (ts / 2 ** 40) & 0xff;
  bytes[1] = (ts / 2 ** 32) & 0xff;
  bytes[2] = (ts / 2 ** 24) & 0xff;
  bytes[3] = (ts / 2 ** 16) & 0xff;
  bytes[4] = (ts / 2 ** 8) & 0xff;
  bytes[5] = ts & 0xff;
  // نسخه ۷ + واریانت
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20, 32)].join("-");
}

export const newClientEventId = uuidv7Browser;

// ─────────────────────── فراداده جلسه (بازکردن آفلاین) ───────────────────────

export interface LocalSessionMeta {
  sessionId: string;
  projectId: string;
  method: string;
  observer: string;
  elements: Array<{ key: string; name: string; activityStableKey?: string; order: number }>;
  elementAdvanceMode: string;
  tolerancePct: number;
  status: string;
  savedAt: string;
}

export async function putSessionMeta(meta: LocalSessionMeta): Promise<void> {
  await tx(STORE_SESSIONS, "readwrite", (s) => s.put(meta));
}

export async function getSessionMeta(sessionId: string): Promise<LocalSessionMeta | null> {
  const result = await tx<LocalSessionMeta | undefined>(STORE_SESSIONS, "readonly", (s) => s.get(sessionId));
  return result ?? null;
}

export async function deleteSessionMeta(sessionId: string): Promise<void> {
  await tx(STORE_SESSIONS, "readwrite", (s) => s.delete(sessionId));
}

// ─────────────────────── ژورنال رویداد (append-only) ───────────────────────

export interface LocalChronoEvent {
  clientEventId: string;
  sessionId: string;
  seq: number;
  type: string;
  elementId?: string;
  cycleNo: number;
  elapsedActiveMs: number;
  splitMs?: number;
  wallClock: string;
  note?: string;
  interruptionReason?: string;
  correctionOf?: string;
  correctedValueMs?: number;
  correctionReason?: string;
  integrity?: string[];
  /** همگام شده با سرور؟ */
  synced: 0 | 1;
}

export async function appendEvents(events: LocalChronoEvent[]): Promise<void> {
  if (events.length === 0) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction([STORE_EVENTS, STORE_QUEUE], "readwrite");
    const evStore = t.objectStore(STORE_EVENTS);
    const qStore = t.objectStore(STORE_QUEUE);
    for (const ev of events) {
      evStore.put(ev); // کلید = clientEventId → تکراری بی‌اثر (idempotent)
      qStore.put(ev); // صف: رویداد همگام‌نشده
    }
    t.oncomplete = () => {
      db.close();
      resolve();
    };
    t.onerror = () => {
      db.close();
      reject(t.error ?? new Error("ثبت رویداد در ذخیره محلی ناموفق بود."));
    };
  });
}

export async function listLocalEvents(sessionId: string): Promise<LocalChronoEvent[]> {
  const db = await openDb();
  const events = await new Promise<LocalChronoEvent[]>((resolve, reject) => {
    const t = db.transaction(STORE_EVENTS, "readonly");
    const idx = t.objectStore(STORE_EVENTS).index("bySession");
    const req = idx.getAll(sessionId);
    req.onsuccess = () => resolve(req.result as LocalChronoEvent[]);
    req.onerror = () => reject(req.error ?? new Error("خواندن ژورنال محلی ناموفق بود."));
    t.oncomplete = () => db.close();
  });
  return events.sort((a, b) => a.seq - b.seq);
}

export async function countLocalEvents(sessionId: string): Promise<number> {
  const events = await listLocalEvents(sessionId);
  return events.length;
}

/** نشانه‌گذاری همگام‌شده + حذف از صف (پس از پذیرش سرور). */
export async function markSynced(sessionId: string, clientEventIds: string[]): Promise<void> {
  if (clientEventIds.length === 0) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction([STORE_EVENTS, STORE_QUEUE], "readwrite");
    const evStore = t.objectStore(STORE_EVENTS);
    const qStore = t.objectStore(STORE_QUEUE);
    for (const id of clientEventIds) {
      const getReq = evStore.get(id);
      getReq.onsuccess = () => {
        const ev = getReq.result as LocalChronoEvent | undefined;
        if (ev) {
          ev.synced = 1;
          evStore.put(ev);
        }
      };
      qStore.delete(id);
    }
    t.oncomplete = () => {
      db.close();
      resolve();
    };
    t.onerror = () => {
      db.close();
      reject(t.error ?? new Error("به‌روزرسانی وضعیت همگام‌سازی ناموفق بود."));
    };
  });
}

/** شمار رویدادهای در صف (نمایش «در صف محلی»). */
export async function countQueued(projectId?: string): Promise<number> {
  const all = await tx<LocalChronoEvent[]>(STORE_QUEUE, "readonly", (s) => s.getAll());
  return projectId ? all.length : all.length;
}

export async function listQueued(sessionId: string): Promise<LocalChronoEvent[]> {
  const all = await tx<LocalChronoEvent[]>(STORE_QUEUE, "readonly", (s) => s.getAll());
  return all.filter((e) => e.sessionId === sessionId).sort((a, b) => a.seq - b.seq);
}

// ─────────────────────── flush صف به سرور ───────────────────────

export type SyncOutcome = "synced" | "duplicate" | "conflict" | "error";

export interface FlushOutcome {
  sent: number;
  ingested: number;
  duplicates: number;
  outcome: SyncOutcome;
  detailFa: string;
}

/**
 * ارسال صف رویدادهای جلسه به سرور (batch) — idempotent:
 * سرور تکراری را duplicates برمی‌گرداند و دوباره‌شماری نمی‌کند.
 * تعارض (جلسه نهایی‌شده/رد معنایی) در صف می‌ماند و کاربر آن را می‌بیند.
 */
export async function flushSessionQueue(projectId: string, sessionId: string): Promise<FlushOutcome> {
  const pending = await listQueued(sessionId);
  if (pending.length === 0) {
    return { sent: 0, ingested: 0, duplicates: 0, outcome: "synced", detailFa: "صف خالی است — همه همگام شده‌اند." };
  }

  // batch حداکثر ۲۰۰ رویداد (حد قرارداد سرور)
  const batch = pending.slice(0, 200);
  try {
    const res = await fetch(
      `/api/projects/${encodeURIComponent(projectId)}/timing/sessions/${encodeURIComponent(sessionId)}/events`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          events: batch.map((e) => ({ ...e, synced: undefined })),
          origin: batch.some((e) => e.synced === 0) ? "offline-synced" : "normal",
        }),
      },
    );
    if (res.ok) {
      const body = (await res.json().catch(() => null)) as
        | { ingested?: number; duplicates?: number; rejected?: unknown[]; eventCount?: number }
        | null;
      const ingested = body?.ingested ?? 0;
      const duplicates = body?.duplicates ?? 0;
      const rejected = body?.rejected ?? [];
      // موفق/تکراری → حذف از صف و نشانه همگام‌شده (حتی reject جزئی: آن رویدادها علامت می‌خورند تا کاربر ببیند)
      const acceptedIds = batch.map((e) => e.clientEventId).filter((id) => !rejected.some((r) => (r as { clientEventId: string }).clientEventId === id));
      await markSynced(sessionId, acceptedIds);
      const rejectedCount = rejected.length;
      return {
        sent: batch.length,
        ingested,
        duplicates,
        outcome: rejectedCount > 0 ? "conflict" : "synced",
        detailFa:
          rejectedCount > 0
            ? `${rejectedCount} رویداد توسط سرور رد شد — نیازمند بازبینی`
            : duplicates > 0
              ? `همگام شد (${ingested} جدید · ${duplicates} تکراری بدون دوباره‌شماری)`
              : `همگام شد (${ingested} رویداد)`,
      };
    }
    if (res.status === 409 || res.status === 400) {
      return {
        sent: batch.length,
        ingested: 0,
        duplicates: 0,
        outcome: "conflict",
        detailFa: `سرور این batch را نپذیرفت (${res.status}) — در صف می‌ماند و نیازمند بازبینی است.`,
      };
    }
    return {
      sent: batch.length,
      ingested: 0,
      duplicates: 0,
      outcome: "error",
      detailFa: `خطای شبکه/سرور (${res.status}) — در صف می‌ماند.`,
    };
  } catch {
    return {
      sent: batch.length,
      ingested: 0,
      duplicates: 0,
      outcome: "error",
      detailFa: "ارتباط برقرار نشد — رویدادها در صف محلی می‌مانند.",
    };
  }
}
