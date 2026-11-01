import type { NextRequest } from "next/server";
import { jsonOk, routeParam, withApi, readJsonBody } from "@/shared/http";
import { requireSessionUser } from "@/modules/identity/application/session";
import { authorizeProjectAction } from "@/modules/projects/application/project-service";
import { solveScenario } from "@/modules/balance/application/balance-service";
import { solveSchema } from "@/modules/balance/application/balance-service";

interface Ctx {
  params: Promise<{ id: string; scenarioId: string }>;
}

/**
 * POST /api/projects/[id]/balance/[scenarioId]/solve — اجرای الگوریتم بالانس
 * (lcr | rpw | kilbridge-wester) روی مسئله ساخته‌شده از ورودی سناریو + داده پروژه.
 * نتیجه append-only ذخیره می‌شود (تاریخچه مقایسه). برای تخصیص دستی مسیر assignment.
 */
export const POST = withApi<Ctx>(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const id = await routeParam(ctx, "id");
  const scenarioId = await routeParam(ctx, "scenarioId");
  await authorizeProjectAction(id, user.id, "balance:write");
  const body = await readJsonBody(req, solveSchema);
  return jsonOk({ result: await solveScenario(id, scenarioId, user.id, body) }, 201);
});
