import type { NextRequest } from "next/server";
import { jsonOk, routeParam, withApi } from "@/shared/http";
import { requireSessionUser } from "@/modules/identity/application/session";
import { authorizeProjectAction } from "@/modules/projects/application/project-service";
import { getSessionCycles } from "@/modules/timing/application/timing-service";

interface Ctx {
  params: Promise<{ id: string; sessionId: string }>;
}

/**
 * GET /api/projects/[id]/timing/sessions/[sessionId]/cycles
 * چرخه‌های مشتق — پیش از نهایی‌سازی زنده از رویدادها (همان هسته مشترک)؛
 * پس از نهایی‌سازی از رکوردهای ذخیره‌شده (ورودی پایدار تحلیل فاز ۵).
 */
export const GET = withApi<Ctx>(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const id = await routeParam(ctx, "id");
  const sessionId = await routeParam(ctx, "sessionId");
  await authorizeProjectAction(id, user.id, "observations:read");
  return jsonOk(await getSessionCycles(id, sessionId));
});
