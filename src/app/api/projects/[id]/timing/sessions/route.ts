import type { NextRequest } from "next/server";
import { jsonOk, routeParam, withApi, readJsonBody } from "@/shared/http";
import { requireSessionUser } from "@/modules/identity/application/session";
import { authorizeProjectAction } from "@/modules/projects/application/project-service";
import { createSession, createSessionSchema, listSessions } from "@/modules/timing/application/timing-service";

interface Ctx {
  params: Promise<{ id: string }>;
}

/** GET /api/projects/[id]/timing/sessions — فهرست جلسات زمان‌سنجی پروژه (فاز ۴). */
export const GET = withApi<Ctx>(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const id = await routeParam(ctx, "id");
  await authorizeProjectAction(id, user.id, "observations:read");
  return jsonOk({ items: await listSessions(id) });
});

/** POST /api/projects/[id]/timing/sessions — ایجاد جلسه زمان‌سنجی (اسنپ‌شات عناصر + تلورانس). */
export const POST = withApi<Ctx>(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const id = await routeParam(ctx, "id");
  await authorizeProjectAction(id, user.id, "observations:write");
  const body = await readJsonBody(req, createSessionSchema);
  const deviceMeta = req.headers.get("user-agent")?.slice(0, 180) ?? null;
  return jsonOk(await createSession(id, user.id, body, deviceMeta), 201);
});
