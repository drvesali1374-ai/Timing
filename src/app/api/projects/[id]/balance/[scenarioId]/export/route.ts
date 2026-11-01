import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { routeParam, withApi, parseQuery } from "@/shared/http";
import { requireSessionUser } from "@/modules/identity/application/session";
import { authorizeProjectAction } from "@/modules/projects/application/project-service";
import { exportScenarioReport, recordBalanceExport } from "@/modules/balance/application/balance-service";
import { BALANCE_REPORT_TEMPLATES, BALANCE_EXPORT_FORMATS } from "@/shared/contracts/balance";

interface Ctx {
  params: Promise<{ id: string; scenarioId: string }>;
}

const exportQuerySchema = z.object({
  template: z.enum(BALANCE_REPORT_TEMPLATES).default("balance-summary"),
  format: z.enum(BALANCE_EXPORT_FORMATS).default("csv"),
});

/**
 * GET /api/projects/[id]/balance/[scenarioId]/export?template=X&format=csv|xls|json
 * خروجی گزارش بالانس (بند ۸ فاز ۶ · B11) — الگوی فاز ۵:
 *  - csv: UTF-8 با BOM · xls: SpreadsheetML با RightToLeft · json: ردیابی کامل
 * هر خروجی: رکورد CalculationResult + ممیزی (append-only).
 */
export const GET = withApi<Ctx>(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const id = await routeParam(ctx, "id");
  const scenarioId = await routeParam(ctx, "scenarioId");
  await authorizeProjectAction(id, user.id, "balance:read");
  const q = parseQuery(req, exportQuerySchema);
  const result = await exportScenarioReport(id, scenarioId, q.template, q.format);
  await recordBalanceExport(id, user.id, scenarioId, q.template, q.format, result.body.length);

  return new NextResponse(result.body, {
    status: 200,
    headers: {
      "Content-Type": `${result.contentType}`,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(result.fileName)}"; filename*=UTF-8''${encodeURIComponent(result.fileName)}`,
      "Cache-Control": "no-store",
    },
  });
});
