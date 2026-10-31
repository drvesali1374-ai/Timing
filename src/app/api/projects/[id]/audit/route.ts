import type { NextRequest } from "next/server";
import { jsonOk, routeParam, withApi } from "@/shared/http";
import { requireSessionUser } from "@/modules/identity/application/session";
import { getAuditTrail } from "@/modules/projects/application/project-service";

interface Ctx {
  params: Promise<{ id: string }>;
}

/** GET /api/projects/[id]/audit — ردپوی ممیزی عملیات حساس پروژه. */
export const GET = withApi<Ctx>(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const id = await routeParam(ctx, "id");
  return jsonOk({ items: await getAuditTrail(id, user.id) });
});
