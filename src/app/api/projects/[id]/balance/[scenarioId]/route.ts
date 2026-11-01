import type { NextRequest } from "next/server";
import { jsonOk, routeParam, withApi, readJsonBody } from "@/shared/http";
import { requireSessionUser } from "@/modules/identity/application/session";
import { authorizeProjectAction } from "@/modules/projects/application/project-service";
import { getScenarioDetail, updateScenario } from "@/modules/balance/application/balance-service";
import { updateScenarioSchema } from "@/modules/balance/application/balance-service";

interface Ctx {
  params: Promise<{ id: string; scenarioId: string }>;
}

/**
 * GET /api/projects/[id]/balance/[scenarioId] — جزئیات سناریو:
 * ورودی‌ها + مسئله ساخته‌شده (فعالیت‌ها/زمان‌ها/گراف) + نتیجه جاری + تاریخچه.
 */
export const GET = withApi<Ctx>(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const id = await routeParam(ctx, "id");
  const scenarioId = await routeParam(ctx, "scenarioId");
  await authorizeProjectAction(id, user.id, "balance:read");
  return jsonOk(await getScenarioDetail(id, scenarioId));
});

/** PATCH /api/projects/[id]/balance/[scenarioId] — به‌روزرسانی نام/ورودی‌ها/وضعیت. */
export const PATCH = withApi<Ctx>(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const id = await routeParam(ctx, "id");
  const scenarioId = await routeParam(ctx, "scenarioId");
  await authorizeProjectAction(id, user.id, "balance:write");
  const body = await readJsonBody(req, updateScenarioSchema);
  return jsonOk(await updateScenario(id, scenarioId, user.id, body));
});
