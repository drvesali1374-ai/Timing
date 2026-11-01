import type { NextRequest } from "next/server";
import { jsonOk, routeParam, withApi } from "@/shared/http";
import { requireSessionUser } from "@/modules/identity/application/session";
import { authorizeProjectAction } from "@/modules/projects/application/project-service";
import { listResults } from "@/modules/balance/application/balance-service";

interface Ctx {
  params: Promise<{ id: string; scenarioId: string }>;
}

/** GET /api/projects/[id]/balance/[scenarioId]/results — تاریخچه نتایج (جدید → قدیم). */
export const GET = withApi<Ctx>(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const id = await routeParam(ctx, "id");
  const scenarioId = await routeParam(ctx, "scenarioId");
  await authorizeProjectAction(id, user.id, "balance:read");
  return jsonOk({ items: await listResults(id, scenarioId) });
});
