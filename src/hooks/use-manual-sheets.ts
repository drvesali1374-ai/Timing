"use client";

/**
 * هوک‌های داده برگه ثبت زمان دستی (ADR-017) — فراخوانی API + toast فارسی.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/auth-client";
import { useSession } from "@/hooks/use-api";
import type {
  ManualSheetDetailDto,
  ManualSheetSummaryDto,
} from "@/shared/contracts/manual-study";

export interface SaveCellsPayload {
  cells: Array<{ activityId: string; sampleIndex: number; value?: string | null; durationMs?: number; note?: string | null }>;
  source?: "manual" | "paste" | "import";
}

export function useManualSheets(projectId: string | null) {
  const session = useSession();
  return useQuery({
    queryKey: ["manual-sheets", projectId],
    queryFn: () => api<{ items: ManualSheetSummaryDto[] }>(`/api/projects/${projectId}/manual-sheets`).then((r) => r.items),
    enabled: !!session.data && !!projectId,
  });
}

export function useManualSheet(projectId: string | null, sheetId: string | null) {
  const session = useSession();
  return useQuery({
    queryKey: ["manual-sheet", projectId, sheetId],
    queryFn: () => api<ManualSheetDetailDto>(`/api/projects/${projectId}/manual-sheets/${sheetId}`),
    enabled: !!session.data && !!projectId && !!sheetId,
  });
}

export function useCreateManualSheet(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { title: string; note?: string }) =>
      api<ManualSheetSummaryDto>(`/api/projects/${projectId}/manual-sheets`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ["manual-sheets", projectId] });
      toast.success(`برگه «${s.title}» ایجاد شد.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateManualSheet(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      sheetId: string;
      title?: string;
      note?: string | null;
      status?: "draft" | "completed" | "finalized";
      reason?: string;
    }) => {
      const { sheetId, ...patch } = input;
      return api<ManualSheetSummaryDto>(`/api/projects/${projectId}/manual-sheets/${sheetId}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
    },
    onSuccess: (s, vars) => {
      qc.invalidateQueries({ queryKey: ["manual-sheets", projectId] });
      qc.invalidateQueries({ queryKey: ["manual-sheet", projectId, vars.sheetId] });
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      if (vars.status) toast.success(`وضعیت برگه: ${s.statusFa}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteManualSheet(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sheetId: string) =>
      api<{ deleted: boolean }>(`/api/projects/${projectId}/manual-sheets/${sheetId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["manual-sheets", projectId] });
      toast.success("برگه حذف شد.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSaveSheetCells(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { sheetId: string } & SaveCellsPayload) => {
      const { sheetId, ...payload } = input;
      return api<{ saved: number; removed: number; rejected: Array<{ activityId: string; sampleIndex: number; reasonFa: string }>; sampleCount: number }>(
        `/api/projects/${projectId}/manual-sheets/${sheetId}/observations`,
        {
          method: "PUT",
          body: JSON.stringify(payload),
        },
      );
    },
    onSuccess: (r, vars) => {
      qc.invalidateQueries({ queryKey: ["manual-sheet", projectId, vars.sheetId] });
      qc.invalidateQueries({ queryKey: ["manual-sheets", projectId] });
      const parts: string[] = [];
      if (r.saved > 0) parts.push(`${r.saved} مقدار ذخیره شد`);
      if (r.removed > 0) parts.push(`${r.removed} مقدار پاک شد`);
      if (r.rejected.length > 0) parts.push(`${r.rejected.length} مورد نامعتبر رد شد`);
      if (parts.length > 0) toast.success(parts.join(" · "));
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSetSheetSampleCount(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { sheetId: string; sampleCount: number }) => {
      const { sheetId, sampleCount } = input;
      return api<{ sampleCount: number; removedObservations: number }>(
        `/api/projects/${projectId}/manual-sheets/${sheetId}/observations`,
        {
          method: "PUT",
          body: JSON.stringify({ cells: [], sampleCount }),
        },
      );
    },
    onSuccess: (r, vars) => {
      qc.invalidateQueries({ queryKey: ["manual-sheet", projectId, vars.sheetId] });
      if (r.removedObservations > 0) {
        toast.warning(`تعداد نمونه ${r.sampleCount} شد — ${r.removedObservations} مقدار اضافی حذف شد.`);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCorrectObservation(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { sheetId: string; observationId: string; value?: string; durationMs?: number; reason?: string }) => {
      const { sheetId, observationId, ...patch } = input;
      return api<ManualSheetDetailDto>(`/api/projects/${projectId}/manual-sheets/${sheetId}/observations/${observationId}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["manual-sheet", projectId, d.id] });
      qc.invalidateQueries({ queryKey: ["analysis", projectId] });
      toast.success("مقدار اصلاح شد و در تاریخچه ثبت گردید.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useMarkManualObservation(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { sheetId: string; observationId: string; outlierMarked: boolean; excluded: boolean; reason?: string }) => {
      const { sheetId, observationId, ...patch } = input;
      return api<ManualSheetDetailDto>(`/api/projects/${projectId}/manual-sheets/${sheetId}/observations/${observationId}/mark`, {
        method: "POST",
        body: JSON.stringify(patch),
      });
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["manual-sheet", projectId, d.id] });
      qc.invalidateQueries({ queryKey: ["analysis", projectId] });
      toast.success("علامت مشاهده ثبت شد.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export interface AddInterruptionPayload {
  sheetId: string;
  activityId?: string | null;
  reason: string;
  reasonOther?: string | null;
  durationValue?: string | null;
  durationKnown?: boolean;
  note?: string;
  sampleIndex?: number | null;
}

export function useAddInterruption(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: AddInterruptionPayload) => {
      const { sheetId, ...body } = payload;
      return api<ManualSheetDetailDto>(`/api/projects/${projectId}/manual-sheets/${sheetId}/interruptions`, {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["manual-sheet", projectId, d.id] });
      toast.success("وقفه ثبت شد.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateInterruption(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      sheetId: string;
      interruptionId: string;
      reason?: string;
      reasonOther?: string | null;
      durationValue?: string | null;
      durationKnown?: boolean;
      note?: string;
    }) => {
      const { sheetId, interruptionId, ...patch } = input;
      return api<ManualSheetDetailDto>(`/api/projects/${projectId}/manual-sheets/${sheetId}/interruptions/${interruptionId}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["manual-sheet", projectId, d.id] });
      toast.success("وقفه به‌روزرسانی شد.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRemoveInterruption(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { sheetId: string; interruptionId: string }) =>
      api<ManualSheetDetailDto>(`/api/projects/${projectId}/manual-sheets/${input.sheetId}/interruptions/${input.interruptionId}`, {
        method: "DELETE",
      }),
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["manual-sheet", projectId, d.id] });
      toast.success("وقفه حذف شد.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDiagramActivityLink(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { activityStableKey: string; diagramId: string; symbol: string; title?: string }) =>
      api<unknown>(`/api/projects/${projectId}/diagrams/activity-links`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activity-links", projectId] });
      qc.invalidateQueries({ queryKey: ["project-diagrams", projectId] });
      toast.success("گام نمودار مرتبط ایجاد شد.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUnlinkDiagramStep(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { activityStableKey: string; diagramId: string; nodeId: string }) =>
      api<unknown>(`/api/projects/${projectId}/diagrams/activity-links`, {
        method: "DELETE",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activity-links", projectId] });
      qc.invalidateQueries({ queryKey: ["project-diagrams", projectId] });
      toast.success("ارجاع گام قطع شد.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
