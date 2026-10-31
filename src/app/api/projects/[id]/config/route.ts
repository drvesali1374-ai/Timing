import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonOk, routeParam, withApi, readJsonBody } from "@/shared/http";
import { requireSessionUser } from "@/modules/identity/application/session";
import { authorizeProjectAction } from "@/modules/projects/application/project-service";
import { getCurrentConfig } from "@/modules/config/application/config-service";

interface Ctx {
  params: Promise<{ id: string }>;
}

/** GET /api/projects/[id]/config — snapshot جاری پیکربندی (v2 — با ارتقای v1 در حافظه). */
export const GET = withApi<Ctx>(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const id = await routeParam(ctx, "id");
  await authorizeProjectAction(id, user.id, "config:read");
  return jsonOk(await getCurrentConfig(id));
});
