"use client";

/**
 * هوک‌های داده کارگاه بالانس — فاز ۶ (B10).
 * الگو مطابق use-analysis.ts: خطاهای سرور با پیام فارسی → toast؛
 * کلیدهای query پروژه‌محور؛ بعد از هر اجرا/تخصیص، نمای کلی و جزئیات نامعتبر می‌شوند.
 * خطای ۴۲۲ تخصیص نامعتبر: پیام‌های دلیل نقض قید جداگانه به کاربر نشان داده می‌شود.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/auth-client";
import { useSession } from "@/hooks/use-api";
import type {
  BalanceOverviewDto,
  BalanceScenarioDetailDto,
  BalanceResultDto,
} from "@/shared/contracts/balance";
import type { BalanceScenarioInputs } from "@/shared/contracts/balance";
import type { BalanceAlgorithmId } from "@/shared/balance/types";

export function useBalanceOverview(projectId: string | null) {
  const session = useSession();
  return useQuery({
    queryKey: ["balance-overview", projectId],
    queryFn: () => api<BalanceOverviewDto>(`/api/projects/${projectId}/balance`),
    enabled: !!session.data && !!projectId,
  });
}

export function useBalanceScenario(projectId: string | null, scenarioId: string | null) {
  const session = useSession();
  return useQuery({
    queryKey: ["balance-scenario", projectId, scenarioId],
    queryFn: () => api<BalanceScenarioDetailDto>(`/api/projects/${projectId}/balance/${scenarioId}`),
    enabled: !!session.data && !!projectId && !!scenarioId,
  });
}

export interface CreateScenarioBody {
  name: string;
  inputs: BalanceScenarioInputs;
  notes?: string | null;
}

export function useCreateBalanceScenario(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateScenarioBody) => {
      if (!projectId) throw new Error("پروژه مشخص نیست.");
      return api<BalanceScenarioDetailDto>(`/api/projects/${projectId}/balance`, {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      toast.success("سناریوی بالانس ساخته شد.");
      void qc.invalidateQueries({ queryKey: ["balance-overview", projectId] });
      void qc.invalidateQueries({ queryKey: ["balance-scenario", projectId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export interface UpdateScenarioBody {
  name?: string;
  inputs?: BalanceScenarioInputs;
  notes?: string | null;
  status?: "active" | "archived";
}

export function useUpdateBalanceScenario(projectId: string | null, scenarioId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateScenarioBody) => {
      if (!projectId || !scenarioId) throw new Error("سناریو مشخص نیست.");
      return api<BalanceScenarioDetailDto>(`/api/projects/${projectId}/balance/${scenarioId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      toast.success("سناریو به‌روزرسانی شد.");
      void qc.invalidateQueries({ queryKey: ["balance-overview", projectId] });
      void qc.invalidateQueries({ queryKey: ["balance-scenario", projectId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useSolveBalance(projectId: string | null, scenarioId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { algorithm: BalanceAlgorithmId; timeBudgetMs?: number }) => {
      if (!projectId || !scenarioId) throw new Error("سناریو مشخص نیست.");
      return api<{ result: BalanceResultDto }>(`/api/projects/${projectId}/balance/${scenarioId}/solve`, {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    onSuccess: (data) => {
      const r = data.result;
      toast.success(`${r.algorithmLabelFa} اجرا شد — ${r.metrics.stationCount} ایستگاه`, {
        description:
          r.violations.length > 0
            ? `${r.violations.length} هشدار قید — تب «شاخص‌ها/ماتریس» را ببینید.`
            : "بدون نقض قید گزارش‌شده.",
      });
      void qc.invalidateQueries({ queryKey: ["balance-scenario", projectId, scenarioId] });
      void qc.invalidateQueries({ queryKey: ["balance-overview", projectId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useSaveManualAssignment(projectId: string | null, scenarioId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (assignments: Record<string, number>) => {
      if (!projectId || !scenarioId) throw new Error("سناریو مشخص نیست.");
      return api<{ result: BalanceResultDto; hardViolationsFa: string[] }>(
        `/api/projects/${projectId}/balance/${scenarioId}/assignment`,
        {
          method: "PUT",
          body: JSON.stringify({ assignments }),
        },
      );
    },
    onSuccess: (data) => {
      toast.success("تخصیص دستی ذخیره شد — شاخص‌ها فوری بازمحاسبه شدند.");
      void qc.invalidateQueries({ queryKey: ["balance-scenario", projectId, scenarioId] });
      void qc.invalidateQueries({ queryKey: ["balance-overview", projectId] });
    },
    onError: (err: Error & { details?: { violations?: string[] } }) => {
      // دلیل نامعتبری صریح نمایش داده می‌شود (بند ۹) — هرگز بی‌هشدار پذیرفته نمی‌شود
      const violations = err.details?.violations;
      if (violations && violations.length > 0) {
        toast.error("تخصیص نامعتبر است — ذخیره نشد", {
          description: violations.slice(0, 4).join(" ◆ "),
        });
      } else {
        toast.error(err.message);
      }
    },
  });
}

/** دانلود خروجی — با نشست (کوکی) از API؛ خطا → toast. */
export async function downloadBalanceExport(
  projectId: string,
  scenarioId: string,
  template: string,
  format: "csv" | "xls" | "json",
): Promise<void> {
  const res = await fetch(
    `/api/projects/${projectId}/balance/${scenarioId}/export?template=${template}&format=${format}`,
    { credentials: "include" },
  );
  if (!res.ok) {
    let message = `خطای خروجی (${res.status})`;
    try {
      const payload = (await res.json()) as { error?: { message?: string } };
      message = payload.error?.message ?? message;
    } catch {
      /* بدون بدنه */
    }
    toast.error(message);
    return;
  }
  const blob = await res.blob();
  const cd = res.headers.get("Content-Disposition") ?? "";
  const match = /filename\*=UTF-8''([^;]+)/.exec(cd);
  const fileName = match ? decodeURIComponent(match[1]) : `balance-report.${format}`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast.success(`خروجی ${format.toUpperCase()} دانلود شد.`);
}
