"use client";

/**
 * هوک‌های داده کارگاه زمان‌سنجی — فهرست جلسات، ایجاد، نهایی‌سازی (فاز ۴).
 * الگو مطابق use-diagrams.ts: خطاهای سرور با پیام فارسی → toast؛ کلیدهای query پروژه‌محور.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/auth-client";
import { useSession } from "@/hooks/use-api";
import type { TimingSessionSummaryDto } from "@/shared/contracts/timing";
import type { CreateTimingSessionInput } from "@/shared/contracts/timing";

export function useTimingSessions(projectId: string | null) {
  const session = useSession();
  return useQuery({
    queryKey: ["timing-sessions", projectId],
    queryFn: () => api<{ items: TimingSessionSummaryDto[] }>(`/api/projects/${projectId}/timing/sessions`),
    enabled: !!session.data && !!projectId,
    select: (d) => d.items,
  });
}

export function useCreateTimingSession(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTimingSessionInput) => {
      if (!projectId) throw new Error("پروژه مشخص نیست.");
      return api<TimingSessionSummaryDto>(`/api/projects/${projectId}/timing/sessions`, {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    onSuccess: () => {
      toast.success("جلسه زمان‌سنجی ایجاد شد", { description: "صفحه ثبت آماده است — ثبت معمول بدون فرم اضافه." });
      void qc.invalidateQueries({ queryKey: ["timing-sessions", projectId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useFinalizeTimingSession(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      if (!projectId) throw new Error("پروژه مشخص نیست.");
      return api<{ status: string; cycles: number; completedCycles: number; suspectCycles: number }>(
        `/api/projects/${projectId}/timing/sessions/${sessionId}/finalize`,
        { method: "POST" },
      );
    },
    onSuccess: (data) => {
      toast.success("جلسه نهایی شد", {
        description: `${data.completedCycles} چرخه معتبر از ${data.cycles} چرخه برای تحلیل ذخیره شد.`,
      });
      void qc.invalidateQueries({ queryKey: ["timing-sessions", projectId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function usePatchTimingSession(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { sessionId: string; notes: string | null }) => {
      if (!projectId) throw new Error("پروژه مشخص نیست.");
      return api<TimingSessionSummaryDto>(`/api/projects/${projectId}/timing/sessions/${args.sessionId}`, {
        method: "PATCH",
        body: JSON.stringify({ notes: args.notes ?? undefined }),
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["timing-sessions", projectId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
