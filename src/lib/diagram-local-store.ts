/**
 * ذخیره محلی سمت کاربر برای نمودارها (ADR-006 — فاز ۳):
 *  - بافر پیش‌نویس نمودار فعال (بازیابی پس از reload)
 *  - صف ذخیره آفلاین با کلید idempotent (clientOpId) — retry/کلیک تکراری دوباره‌شماری نمی‌کند
 * IndexedDB خام (بدون وابستگی) — DB اختصاصی «timing-diagrams».
 *
 * این لایه فقط زیرساخت کلاینت است؛ منطق دامنه در shared/diagrams است.
 */

"use client";

const DB_NAME = "timing-diagrams";
const DB_VERSION = 1;
const STORE_DRAFTS = "drafts"; // پیش‌نویس نمودار فعال هر پروژه
const STORE_QUEUE = "queue"; // صف ذخیره‌های آفلاین

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB در این مرورگر در دسترس نیست."));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_DRAFTS)) {
        db.createObjectStore(STORE_DRAFTS, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        db.createObjectStore(STORE_QUEUE, { keyPath: "clientOpId" });
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

// ─────────────────────── پیش‌نویس نمودار فعال ───────────────────────

export interface DiagramDraft {
  key: string; // `${projectId}:${diagramId}`
  projectId: string;
  diagramId: string;
  /** مدل معنایی + چیدمان محلی کاربر */
  doc: unknown;
  layout: unknown;
  savedAt: string; // ISO — برای نمایش «بازیابی‌شده»
}

export async function putDraft(draft: DiagramDraft): Promise<void> {
  await tx(STORE_DRAFTS, "readwrite", (s) => s.put(draft));
}

export async function getDraft(projectId: string, diagramId: string): Promise<DiagramDraft | null> {
  const result = await tx<DiagramDraft | undefined>(STORE_DRAFTS, "readonly", (s) => s.get(`${projectId}:${diagramId}`));
  return result ?? null;
}

export async function deleteDraft(projectId: string, diagramId: string): Promise<void> {
  await tx(STORE_DRAFTS, "readwrite", (s) => s.delete(`${projectId}:${diagramId}`));
}

// ─────────────────────── صف ذخیره آفلاین ───────────────────────

export interface QueuedSave {
  clientOpId: string; // UUIDv7 — idempotency سمت سرور
  projectId: string;
  diagramId: string;
  doc: unknown;
  layout: unknown;
  reason: string | null;
  appliedSuggestions?: Array<{ id: string; version: string; title: string }>;
  queuedAt: string;
}

export async function enqueueSave(item: QueuedSave): Promise<void> {
  await tx(STORE_QUEUE, "readwrite", (s) => s.put(item));
}

export async function listQueue(projectId?: string): Promise<QueuedSave[]> {
  const all = await tx<QueuedSave[]>(STORE_QUEUE, "readonly", (s) => s.getAll());
  return projectId ? all.filter((q) => q.projectId === projectId) : all;
}

export async function removeFromQueue(clientOpId: string): Promise<void> {
  await tx(STORE_QUEUE, "readwrite", (s) => s.delete(clientOpId));
}

export async function clearQueue(): Promise<void> {
  await tx(STORE_QUEUE, "readwrite", (s) => s.clear());
}

// ─────────────────────── flush صف پس از بازگشت آنلاین ───────────────────────

export type QueueItemStatus = "synced" | "conflict" | "error";

export interface FlushResult {
  clientOpId: string;
  status: QueueItemStatus;
  detailFa: string;
}

/**
 * ارسال صف به سرور — هر آیتم با clientOpId خود؛ سرور تکراری را بی‌اثر برمی‌گرداند.
 * آیتم موفق/تکراری حذف می‌شود؛ خطا در صف می‌ماند (شامل تعارض معنایی که کاربر باید ببیند).
 */
export async function flushQueue(projectId: string): Promise<FlushResult[]> {
  const items = await listQueue(projectId);
  const results: FlushResult[] = [];
  for (const item of items) {
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(item.projectId)}/diagrams/${encodeURIComponent(item.diagramId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doc: item.doc,
          layout: item.layout,
          reason: item.reason,
          appliedSuggestions: item.appliedSuggestions,
          origin: "offline-synced",
          clientOpId: item.clientOpId,
        }),
      });
      if (res.ok) {
        const body = (await res.json().catch(() => null)) as { duplicate?: boolean } | null;
        await removeFromQueue(item.clientOpId);
        await deleteDraft(item.projectId, item.diagramId);
        results.push({
          clientOpId: item.clientOpId,
          status: "synced",
          detailFa: body?.duplicate ? "قبلاً همگام شده بود (بدون دوباره‌شماری)" : "همگام شد",
        });
      } else if (res.status === 409 || res.status === 400) {
        // تعارض/رد معنایی — آیتم در صف می‌ماند تا کاربر ببیند؛ نه حذف بی‌صدا
        results.push({
          clientOpId: item.clientOpId,
          status: "conflict",
          detailFa: `سرور این ذخیره را نپذیرفت (${res.status}) — نیازمند بازبینی دستی`,
        });
      } else {
        results.push({ clientOpId: item.clientOpId, status: "error", detailFa: `خطای شبکه/سرور (${res.status})` });
      }
    } catch {
      results.push({ clientOpId: item.clientOpId, status: "error", detailFa: "ارتباط برقرار نشد — در صف می‌ماند" });
    }
  }
  return results;
}
