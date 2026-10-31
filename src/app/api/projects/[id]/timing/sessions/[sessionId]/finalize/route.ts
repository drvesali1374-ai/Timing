import type { NextRequest } from "next/server";
import { jsonOk, routeParam, withApi } from "@/shared/http";
import { requireSessionUser } from "@/modules/identity/application/session";
import { authorizeProjectAction } from "@/modules/projects/application/project-service";
import { finalizeSession } from "@/modules/timing/application/timing-service";

interface Ctx {
  params: Promise<{ id: string; sessionId: string }>;
}

/**
 * POST /api/projects/[id]/timing/sessions/[sessionId]/finalize
 * نهایی‌سازی جلسه: مشتق چرخه‌ها → ذخیره پایدار (ورودی تحلیل فاز ۵) → قفل.
 * فقط پس از stop مجاز است؛ رویداد finalize تولید سرور در دفتر ثبت می‌شود.
 */
export const POST = withApi<Ctx>(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const id = await routeParam(ctx, "id");
  const sessionId = await routeParam(ctx, "sessionId");
  await authorizeProjectAction(id, user.id, "observations:write");
  return jsonOk(await finalizeSession(id, sessionId, user.id));
});
