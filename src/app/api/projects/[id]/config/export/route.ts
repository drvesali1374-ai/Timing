import type { NextRequest } from "next/server";
import { jsonOk, routeParam, withApi } from "@/shared/http";
import { requireSessionUser } from "@/modules/identity/application/session";
import { authorizeProjectAction } from "@/modules/projects/application/project-service";
import { exportConfig, assertCurrentConfigExportable } from "@/modules/config/application/config-service";

interface Ctx {
  params: Promise<{ id: string }>;
}

/** GET /api/projects/[id]/config/export — خروجی JSON پیکربندی (قالب timing-config-snapshot v2). */
export const GET = withApi<Ctx>(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const id = await routeParam(ctx, "id");
  await authorizeProjectAction(id, user.id, "config:read");
  await assertCurrentConfigExportable(id);
  const payload = await exportConfig(id);
  return jsonOk(payload);
});
