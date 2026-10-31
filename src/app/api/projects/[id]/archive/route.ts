import type { NextRequest } from "next/server";
import { jsonOk, readJsonBody, routeParam, withApi } from "@/shared/http";
import { requireSessionUser } from "@/modules/identity/application/session";
import { setProjectArchived } from "@/modules/projects/application/project-service";
import { projectArchiveSchema } from "@/shared/validation/project";

interface Ctx {
  params: Promise<{ id: string }>;
}

/** POST /api/projects/[id]/archive — بایگانی/خروج از بایگانی (فقط owner). */
export const POST = withApi<Ctx>(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const id = await routeParam(ctx, "id");
  const body = await readJsonBody(req, projectArchiveSchema);
  return jsonOk(await setProjectArchived(id, user.id, body.archived));
});
