import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonOk, routeParam, withApi, readJsonBody } from "@/shared/http";
import { requireSessionUser } from "@/modules/identity/application/session";
import { authorizeProjectAction } from "@/modules/projects/application/project-service";
import { validateExpr } from "@/modules/config/application/config-service";

interface Ctx {
  params: Promise<{ id: string }>;
}

const bodySchema = z.object({
  expr: z.string().min(1).max(2048),
});

/** POST /api/projects/[id]/config/formulas/validate — تحلیل ایستای عبارت در برابر نمادهای پروژه. */
export const POST = withApi<Ctx>(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const id = await routeParam(ctx, "id");
  await authorizeProjectAction(id, user.id, "config:read");
  const body = await readJsonBody(req, bodySchema);
  return jsonOk(await validateExpr(id, body.expr));
});
