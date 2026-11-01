import { NextRequest, NextResponse } from "next/server";
import { routeParam, withApi, parseQuery } from "@/shared/http";
import { requireSessionUser } from "@/modules/identity/application/session";
import { authorizeProjectAction } from "@/modules/projects/application/project-service";
import { exportReport } from "@/modules/analysis/application/analysis-service";
import { exportQuerySchema } from "@/modules/analysis/application/analysis-service";

interface Ctx {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/projects/[id]/analysis/export?template=X&format=csv|xls|json
 * خروجی گزارش با داده واقعی و ردیابی کامل (بند ۸ فاز ۵):
 *  - csv: UTF-8 با BOM — فارسی در Excel سالم می‌ماند
 *  - xls: SpreadsheetML 2003 با RightToLeft — بدون وابستگی خارجی
 *  - json: ردیابی کامل (نسخه پیکربندی/فرمول/تنظیمات/ورودی)
 * هر خروجی: رکورد CalculationResult ثبت + ممیزی (append-only).
 */
export const GET = withApi<Ctx>(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const id = await routeParam(ctx, "id");
  await authorizeProjectAction(id, user.id, "analysis:read");
  const q = parseQuery(req, exportQuerySchema);
  const result = await exportReport(id, user.id, q.template as "study-summary" | "raw-observations" | "element-analysis" | "sample-quality" | "standard-time" | "formula-outputs", q.format as "csv" | "xls" | "json");

  return new NextResponse(result.body, {
    status: 200,
    headers: {
      "Content-Type": `${result.contentType}`,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(result.fileName)}"; filename*=UTF-8''${encodeURIComponent(result.fileName)}`,
      "X-Analysis-Result-Id": result.resultId ?? "",
      "Cache-Control": "no-store",
    },
  });
});
