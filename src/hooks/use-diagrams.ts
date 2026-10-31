"use client";

/**
 * هوک‌های داده فاز ۳ — طراح نمودارهای OPC/FPC (فراخوانی API + آفلاین‌صف).
 * الگو مطابق use-config.ts: خطاهای سرور با پیام فارسی → toast؛ کلیدهای query پروژه‌محور.
 * ذخیره آفلاین: صف IndexedDB با clientOpId idempotent (ADR-006) — flush خودکار هنگام آنلاین.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { uuidv7 } from "@/shared/ids";
import { api } from "@/lib/auth-client";
import { useSession } from "@/hooks/use-api";
import {
  enqueueSave,
  flushQueue,
  listQueue,
  type FlushResult,
  type QueuedSave,
} from "@/lib/diagram-local-store";
import type {
  DiagramDetailDto,
  DiagramListItemDto,
  DiagramRevisionDto,
  DiagramValidationReportDto,
  SaveRevisionResponseDto,
  VariantCompareDto,
} from "@/shared/contracts/diagrams";
import type { DiagramDoc } from "@/shared/diagrams/types";

// ── فهرست/جزئیات ──────────────────────────────────────────────

export function useDiagrams(projectId: string | null, includeArchived = false) {
  const session = useSession();
  return useQuery({
    queryKey: ["project-diagrams", projectId, includeArchived],
    queryFn: () => api<{ items: DiagramListItemDto[] }>(`/api/projects/${projectId}/diagrams?includeArchived=${includeArchived}`),
    enabled: !!session.data && !!projectId,
    select: (d) => d.items,
  });
}

export function useDiagram(projectId: string | null, diagramId: string | null) {
  const session = useSession();
  return useQuery({
    queryKey: ["diagram", projectId, diagramId],
    queryFn: () => api<DiagramDetailDto>(`/api/projects/${projectId}/diagrams/${diagramId}`),
    enabled: !!session.data && !!projectId && !!diagramId,
  });
}

export function useDiagramRevisions(projectId: string | null, diagramId: string | null) {
  const session = useSession();
  return useQuery({
    queryKey: ["diagram-revisions", projectId, diagramId],
    queryFn: () => api<{ items: DiagramRevisionDto[] }>(`/api/projects/${projectId}/diagrams/${diagramId}/revisions`),
    enabled: !!session.data && !!projectId && !!diagramId,
    select: (d) => d.items,
  });
}

export function useVariantCompare(projectId: string | null, diagramId: string | null, enabled: boolean) {
  const session = useSession();
  return useQuery({
    queryKey: ["diagram-compare", projectId, diagramId],
    queryFn: () => api<VariantCompareDto>(`/api/projects/${projectId}/diagrams/${diagramId}/compare`),
    enabled: !!session.data && !!projectId && !!diagramId && enabled,
  });
}

// ── ایجاد/ذخیره/وضعیت ─────────────────────────────────────────

function useInvalidateDiagramScope(projectId: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["project-diagrams", projectId] });
    qc.invalidateQueries({ queryKey: ["diagram", projectId] });
    qc.invalidateQueries({ queryKey: ["diagram-revisions", projectId] });
    qc.invalidateQueries({ queryKey: ["diagram-compare", projectId] });
    qc.invalidateQueries({ queryKey: ["project", projectId] });
    qc.invalidateQueries({ queryKey: ["projects"] });
  };
}

export interface CreateDiagramInput {
  kind: "opc" | "fpc";
  variant?: "current" | "proposed";
  title: string;
  description?: string | null;
  subject?: "material" | "person" | "equipment" | null;
  distanceUnit?: string;
  variantOfId?: string | null;
  doc?: DiagramDoc;
  layout?: { positions: Record<string, { x: number; y: number }> };
}

export function useCreateDiagram(projectId: string) {
  const invalidate = useInvalidateDiagramScope(projectId);
  return useMutation({
    mutationFn: (input: CreateDiagramInput) =>
      api<DiagramDetailDto>(`/api/projects/${projectId}/diagrams`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      invalidate();
      toast.success("نمودار ساخته شد — نسخه ۱ ثبت شد.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export interface SaveRevisionVars {
  diagramId: string;
  doc: DiagramDoc;
  layout: { positions: Record<string, { x: number; y: number }> };
  reason?: string | null;
  appliedSuggestions?: Array<{ id: string; version: string; title: string }>;
}

export function useSaveRevision(projectId: string) {
  const invalidate = useInvalidateDiagramScope(projectId);
  return useMutation({
    mutationFn: async (vars: SaveRevisionVars): Promise<SaveRevisionResponseDto> => {
      const payload = {
        doc: vars.doc,
        layout: vars.layout,
        reason: vars.reason ?? null,
        appliedSuggestions: vars.appliedSuggestions,
        origin: "normal",
      };
      return api<SaveRevisionResponseDto>(`/api/projects/${projectId}/diagrams/${vars.diagramId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (res) => {
      invalidate();
      if (!res.duplicate) toast.success(`نسخه ${res.revision.revNo} ذخیره شد.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function usePatchDiagram(projectId: string) {
  const invalidate = useInvalidateDiagramScope(projectId);
  return useMutation({
    mutationFn: (vars: { diagramId: string; title?: string; description?: string | null; status?: "draft" | "confirmed" | "archived" }) =>
      api<DiagramListItemDto>(`/api/projects/${projectId}/diagrams/${vars.diagramId}`, {
        method: "PATCH",
        body: JSON.stringify({ title: vars.title, description: vars.description, status: vars.status }),
      }),
    onSuccess: (_d, vars) => {
      invalidate();
      if (vars.status === "confirmed") toast.success("نمودار تأیید شد — ویرایش بعدی نسخه جدید می‌سازد.");
      else if (vars.status === "archived") toast.success("نمودار بایگانی شد.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRestoreRevision(projectId: string) {
  const invalidate = useInvalidateDiagramScope(projectId);
  return useMutation({
    mutationFn: (vars: { diagramId: string; revNo: number }) =>
      api<SaveRevisionResponseDto>(`/api/projects/${projectId}/diagrams/${vars.diagramId}/restore`, {
        method: "POST",
        body: JSON.stringify({ revNo: vars.revNo }),
      }),
    onSuccess: (res) => {
      invalidate();
      toast.success(`نسخه ${res.revision.revNo} بازیابی شد (به‌صورت نسخه جدید).`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// اعتبارسنجی زنده سمت کاربر با همان موتور خالص مشترک (validateDiagram) انجام می‌شود —
// منبع واحد ارزیابی سرور/کلاینت (ADR-011)؛ سنجش مستقل سرور هنگام ذخیره اجرا و در revision ذخیره می‌شود.

// ── وضعیت آنلاین ─────────────────────────────────────────────

export function useOnline() {
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

// ── صف آفلاین ────────────────────────────────────────────────

export interface OfflineQueueState {
  count: number;
  items: QueuedSave[];
  flushing: boolean;
  lastFlush: FlushResult[] | null;
}

export function useOfflineQueue(projectId: string) {
  const [state, setState] = useState<OfflineQueueState>({ count: 0, items: [], flushing: false, lastFlush: null });
  const online = useOnline();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryClient = useQueryClient();

  const refresh = useCallback(async () => {
    try {
      const items = await listQueue(projectId);
      setState((s) => ({ ...s, count: items.length, items }));
    } catch {
      setState((s) => ({ ...s, count: 0, items: [] }));
    }
  }, [projectId]);

  useEffect(() => {
    // بارگذاری اولیه صف از IndexedDB — خارج از همگام‌سازی رندر (قاعده setState-in-effect)
    const t = setTimeout(() => {
      void refresh();
    }, 0);
    return () => clearTimeout(t);
  }, [refresh]);

  // افزودن به صف + شمارش فوری
  const enqueue = useCallback(
    async (item: Omit<QueuedSave, "clientOpId" | "queuedAt">) => {
      const full: QueuedSave = { ...item, clientOpId: uuidv7(), queuedAt: new Date().toISOString() };
      await enqueueSave(full);
      setState((s) => ({ ...s, count: s.count + 1, items: [...s.items, full] }));
      return full;
    },
    [],
  );

  // flush خودکار هنگام بازگشت آنلاین (با تاخیر کوتاه برای پایداری)
  useEffect(() => {
    if (!online || state.count === 0 || state.flushing) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setState((s) => ({ ...s, flushing: true }));
      try {
        const results = await flushQueue(projectId);
        setState((s) => ({ ...s, flushing: false, lastFlush: results }));
        const synced = results.filter((r) => r.status === "synced").length;
        const conflicts = results.filter((r) => r.status === "conflict").length;
        if (synced > 0) toast.success(`${synced} ذخیره آفلاین همگام شد.`);
        if (conflicts > 0) toast.warning(`${conflicts} ذخیره آفلاین نیازمند بازبینی است (در صف می‌ماند).`);
        await refresh();
        // نوسازی کش داده پس از همگام‌سازی موفق (نمایش نسخه/وضعیت به‌روز)
        if (synced > 0) {
          queryClient.invalidateQueries({ queryKey: ["diagram", projectId] });
          queryClient.invalidateQueries({ queryKey: ["diagram-revisions", projectId] });
          queryClient.invalidateQueries({ queryKey: ["project-diagrams", projectId] });
        }
      } catch {
        setState((s) => ({ ...s, flushing: false }));
      }
    }, 1500);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [online, state.count, state.flushing, projectId, refresh, queryClient]);

  return { ...state, online, enqueue, refresh, flush: () => flushQueue(projectId) };
}
