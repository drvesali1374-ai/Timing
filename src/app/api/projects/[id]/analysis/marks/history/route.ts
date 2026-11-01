import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonOk, routeParam, withApi, parseQuery } from "@/shared/http";
import { requireSessionUser } from "@/modules/identity/application/session";
import { authorizeProjectAction } from "@/modules/projects/application/project-service";
import { getMarkHistory } from "@/modules/analysis/application/analysis-service";

interface Ctx {
  params: Promise<{ id: string }>;
}

const historyQuerySchema = z.object({
  sessionId: z.string().min(8).max(64),
  readingEventId: z.string().min(8).max(64),
});

/**
 * GET /api/projects/[id]/analysis/marks/history?sessionId=&readingEventId=
 * تاریخچه کامل علامت‌های یک مشاهده — شاهد «اثر و تاریخچه روشن» (R5-2).
 */
export const GET = withApi<Ctx>(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const id = await routeParam(ctx, "id");
  await authorizeProjectAction(id, user.id, "analysis:read");
  const q = parseQuery(req, historyQuerySchema);
  return jsonOk(await getMarkHistory(id, q.sessionId, q.readingEventId));
});
