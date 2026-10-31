import type { NextRequest } from "next/server";
import { jsonOk, readJsonBody, routeParam, withApi } from "@/shared/http";
import { requireSessionUser } from "@/modules/identity/application/session";
import { addMember, listMembers } from "@/modules/projects/application/project-service";
import { memberAddSchema } from "@/shared/validation/project";

interface Ctx {
  params: Promise<{ id: string }>;
}

/** GET /api/projects/[id]/members — فهرست اعضا و نقش‌ها. */
export const GET = withApi<Ctx>(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const id = await routeParam(ctx, "id");
  return jsonOk({ items: await listMembers(id, user.id) });
});

/** POST /api/projects/[id]/members — افزودن عضو با نقش (فقط owner). */
export const POST = withApi<Ctx>(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const id = await routeParam(ctx, "id");
  const input = await readJsonBody(req, memberAddSchema);
  return jsonOk(await addMember(id, user.id, input), 201);
});
