import type { NextRequest } from "next/server";
import { jsonOk, routeParam, withApi, readJsonBody } from "@/shared/http";
import { requireSessionUser } from "@/modules/identity/application/session";
import { authorizeProjectAction } from "@/modules/projects/application/project-service";
import { saveSessionContext } from "@/modules/analysis/application/analysis-service";
import { sessionContextSchema } from "@/modules/analysis/application/analysis-service";

interface Ctx {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/projects/[id]/analysis/session-context — ثبت زمینه جلسه (فاز ۵ بند ۶).
 * پارامترهای سفارشی (مثل study.operator/shift/machine/workstation) با
 * scopeType=session ذخیره می‌شوند تا تحلیل بر اساس آنها فیلتر/تفکیک شود.
 */
export const POST = withApi<Ctx>(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const id = await routeParam(ctx, "id");
  await authorizeProjectAction(id, user.id, "analysis:write");
  const body = await readJsonBody(req, sessionContextSchema);
  return jsonOk(await saveSessionContext(id, user.id, body));
});
