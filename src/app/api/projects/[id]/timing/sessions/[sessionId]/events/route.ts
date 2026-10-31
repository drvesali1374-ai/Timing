import type { NextRequest } from "next/server";
import { jsonOk, routeParam, withApi, readJsonBody } from "@/shared/http";
import { requireSessionUser } from "@/modules/identity/application/session";
import { authorizeProjectAction } from "@/modules/projects/application/project-service";
import { ingestEvents, ingestEventsSchema } from "@/modules/timing/application/timing-service";

interface Ctx {
  params: Promise<{ id: string; sessionId: string }>;
}

/**
 * POST /api/projects/[id]/timing/sessions/[sessionId]/events
 * دریافت batch رویدادها — idempotent بر اساس clientEventId:
 * retry شبکه/کلیک تکراری دوباره‌شماری نمی‌کند (ADR-004 قید ۶).
 */
export const POST = withApi<Ctx>(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const id = await routeParam(ctx, "id");
  const sessionId = await routeParam(ctx, "sessionId");
  await authorizeProjectAction(id, user.id, "observations:write");
  const body = await readJsonBody(req, ingestEventsSchema);
  return jsonOk(await ingestEvents(id, sessionId, user.id, body));
});
