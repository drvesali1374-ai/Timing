import type { NextRequest } from "next/server";
import { jsonOk, readJsonBody, routeParam, withApi } from "@/shared/http";
import { requireSessionUser } from "@/modules/identity/application/session";
import { removeMember, updateMemberRole } from "@/modules/projects/application/project-service";
import { memberUpdateSchema } from "@/shared/validation/project";

interface Ctx {
  params: Promise<{ id: string; memberId: string }>;
}

/** PATCH /api/projects/[id]/members/[memberId] — تغییر نقش عضو (فقط owner). */
export const PATCH = withApi<Ctx>(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const id = await routeParam(ctx, "id");
  const memberId = await routeParam(ctx, "memberId");
  const input = await readJsonBody(req, memberUpdateSchema);
  await updateMemberRole(id, user.id, memberId, input.role);
  return jsonOk({ ok: true });
});

/** DELETE /api/projects/[id]/members/[memberId] — حذف عضو (فقط owner). */
export const DELETE = withApi<Ctx>(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const id = await routeParam(ctx, "id");
  const memberId = await routeParam(ctx, "memberId");
  await removeMember(id, user.id, memberId);
  return jsonOk({ ok: true });
});
