"use client";

/**
 * هوک‌های داده کارگاه تحلیل — فاز ۵ (B9/B4).
 * الگو مطابق use-timing.ts: خطاهای سرور با پیام فارسی → toast؛
 * کلیدهای query پروژه‌محور؛ بعد از هر علامت/زمینه، تحلیل نامعتبر می‌شود.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/auth-client";
import { useSession } from "@/hooks/use-api";
import type { AnalysisDto, MarkHistoryDto } from "@/shared/contracts/analysis";

export function useAnalysis(projectId: string | null) {
  const session = useSession();
  return useQuery({
    queryKey: ["analysis", projectId],
    queryFn: () => api<AnalysisDto>(`/api/projects/${projectId}/analysis`),
    enabled: !!session.data && !!projectId,
  });
}

export interface MarkInput {
  sessionId: string;
  readingEventId: string;
  cycleSeq: number;
  elementKey: string;
  outlierMarked: boolean;
  excluded: boolean;
  reason?: string | null;
}

export function useMarkObservation(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: MarkInput) => {
      if (!projectId) throw new Error("پروژه مشخص نیست.");
      return api<MarkHistoryDto>(`/api/projects/${projectId}/analysis/marks`, {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    onSuccess: (data, input) => {
      toast.success(input.excluded ? "مشاهده از محاسبه حذف شد" : input.outlierMarked ? "مشاهده «داده پرت» علامت خورد" : "علامت‌ها برداشته شد", {
        description: input.excluded
          ? `علت ثبت شد: ${input.reason ?? "—"} — تاریخچه کامل در ممیزی پروژه موجود است.`
          : "علامت‌گذاری فقط برچسب است؛ حذف از محاسبه عمل جداگانه‌ای است.",
      });
      void qc.invalidateQueries({ queryKey: ["analysis", projectId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useSessionContext(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { sessionId: string; values: Array<{ stableKey: string; value: string | number | boolean | null }> }) => {
      if (!projectId) throw new Error("پروژه مشخص نیست.");
      return api<{ saved: string[] }>(`/api/projects/${projectId}/analysis/session-context`, {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    onSuccess: (data) => {
      toast.success("زمینه جلسه ثبت شد", { description: `${data.saved.length} پارامتر — تحلیل بر اساس آنها فیلترپذیر است.` });
      void qc.invalidateQueries({ queryKey: ["analysis", projectId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

/** دانلود خروجی گزارش (CSV/XLS/JSON) — فایل واقعی از سرور. */
export async function downloadAnalysisExport(projectId: string, template: string, format: string): Promise<void> {
  const res = await fetch(`/api/projects/${projectId}/analysis/export?template=${encodeURIComponent(template)}&format=${encodeURIComponent(format)}`, {
    credentials: "same-origin",
  });
  if (!res.ok) {
    let messageFa = "خطا در تولید خروجی گزارش.";
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      if (body.error?.message) messageFa = body.error.message;
    } catch {
      /* بدنه غیر JSON */
    }
    throw new Error(messageFa);
  }
  const blob = await res.blob();
  const blobWithType = blob.type ? blob : new Blob([blob], { type: res.headers.get("Content-Type") ?? "application/octet-stream" });
  const url = URL.createObjectURL(blobWithType);
  const a = document.createElement("a");
  a.href = url;
  // نام فایل از Content-Disposition (filename*=UTF-8'') — با decodeURIComponent
  const cd = res.headers.get("Content-Disposition") ?? "";
  const star = /filename\*=UTF-8''([^;]+)/i.exec(cd);
  const plain = /filename="([^"]+)"/i.exec(cd);
  let fileName = `${template}.${format}`;
  if (star?.[1]) fileName = decodeURIComponent(star[1]);
  else if (plain?.[1]) fileName = plain[1];
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5_000);
}
