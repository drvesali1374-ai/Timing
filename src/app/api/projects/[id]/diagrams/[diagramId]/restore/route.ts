import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonOk, routeParam, withApi, readJsonBody } from "@/shared/http";
import { requireSessionUser } from "@/modules/identity/application/session";
import { authorizeProjectAction } from "@/modules/projects/application/project-service";
import { restoreRevision } from "@/modules/diagrams/application/diagram-service";

interface Ctx {
  params: Promise<{ id: string; diagramId: string }>;
}

const bodySchema = z.object({
  revNo: z.number().int().min(1),
});

/** POST /api/projects/[id]/diagrams/[diagramId]/restore — بازیابی نسخه قبلی (revision جدید، append-only حفظ می‌شود). */
export const POST = withApi<Ctx>(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const id = await routeParam(ctx, "id");
  const diagramId = await routeParam(ctx, "diagramId");
  await authorizeProjectAction(id, user.id, "diagrams:write");
  const body = await readJsonBody(req, bodySchema);
  return jsonOk(await restoreRevision(id, user.id, diagramId, body.revNo));
});
