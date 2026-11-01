"use client";

/**
 * هوک پیش‌نمایش گزارش برای چاپ/PDF (فاز ۵).
 * از همان مسیر خروجی JSON استفاده می‌کند (بدون دانلود) — داده یکسان با خروجی،
 * شامل بلوک ردیابی کامل. هر پیش‌نمایش = رکورد ردیابی append-only (بند ۵).
 */

import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/auth-client";
import type { ReportDto } from "@/shared/contracts/analysis";
import type { ReportTemplate } from "@/shared/contracts/analysis";

interface ReportJsonPayload {
  template: ReportTemplate;
  templateLabelFa: string;
  summaryFa: string[];
  columns: ReportDto["columns"];
  rows: ReportDto["rows"];
  trace: ReportDto["trace"];
}

export function useAnalysisPreview(projectId: string) {
  return useMutation({
    mutationFn: async (template: ReportTemplate): Promise<ReportDto> => {
      // خروجی json همان ساختار گزارش را برمی‌گرداند (دانلود نیست — fetch مستقیم)
      const payload = await api<ReportJsonPayload>(
        `/api/projects/${projectId}/analysis/export?template=${encodeURIComponent(template)}&format=json`,
      );
      return {
        template: payload.template,
        templateLabelFa: payload.templateLabelFa,
        columns: payload.columns,
        rows: payload.rows,
        summaryFa: payload.summaryFa,
        trace: payload.trace,
        fileNameBase: `${template}`,
      };
    },
  });
}
