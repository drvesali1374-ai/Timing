import type { NextRequest } from "next/server";
import { jsonOk, routeParam, withApi, readJsonBody } from "@/shared/http";
import { requireSessionUser } from "@/modules/identity/application/session";
import { authorizeProjectAction } from "@/modules/projects/application/project-service";
import { getSessionDetail, patchSession, patchSessionSchema } from "@/modules/timing/application/timing-service";

interface Ctx {
  params: Promise<{ id: string; sessionId: string }>;
}

/** GET /api/projects/[id]/timing/sessions/[sessionId] — جزئیات جلسه + رویدادها + مشتق زنده. */
export const GET = withApi<Ctx>(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const id = await routeParam(ctx, "id");
  const sessionId = await routeParam(ctx, "sessionId");
  await authorizeProjectAction(id, user.id, "observations:read");
  return jsonOk(await getSessionDetail(id, sessionId));
});

/** PATCH /api/projects/[id]/timing/sessions/[sessionId] — ویرایش یادداشت جلسه. */
export const PATCH = withApi<Ctx>(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const id = await routeParam(ctx, "id");
  const sessionId = await routeParam(ctx, "sessionId");
  await authorizeProjectAction(id, user.id, "observations:write");
  const body = await readJsonBody(req, patchSessionSchema);
  return jsonOk(await patchSession(id, sessionId, user.id, body));
});
