import type { NextRequest } from "next/server";
import { jsonOk, routeParam, withApi } from "@/shared/http";
import { requireSessionUser } from "@/modules/identity/application/session";
import { authorizeProjectAction } from "@/modules/projects/application/project-service";
import { compareVariants } from "@/modules/diagrams/application/diagram-service";

interface Ctx {
  params: Promise<{ id: string; diagramId: string }>;
}

/** GET /api/projects/[id]/diagrams/[diagramId]/compare — مقایسه روش فعلی/پیشنهادی (خلاصه‌ها + دلتا). */
export const GET = withApi<Ctx>(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const id = await routeParam(ctx, "id");
  const diagramId = await routeParam(ctx, "diagramId");
  await authorizeProjectAction(id, user.id, "diagrams:read");
  return jsonOk(await compareVariants(id, diagramId));
});
