import type { NextRequest } from "next/server";
import { jsonOk, routeParam, withApi } from "@/shared/http";
import { requireSessionUser } from "@/modules/identity/application/session";
import { duplicateProject } from "@/modules/projects/application/project-service";

interface Ctx {
  params: Promise<{ id: string }>;
}

/** POST /api/projects/[id]/duplicate — تکثیر ساختار/پیکربندی بدون داده خام (editor+). */
export const POST = withApi<Ctx>(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const id = await routeParam(ctx, "id");
  return jsonOk(await duplicateProject(id, user.id), 201);
});
