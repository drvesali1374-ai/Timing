import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonOk, routeParam, withApi, readJsonBody } from "@/shared/http";
import { requireSessionUser } from "@/modules/identity/application/session";
import { authorizeProjectAction } from "@/modules/projects/application/project-service";
import { getDiagramDetail, patchDiagram, saveRevision, saveRevisionSchema } from "@/modules/diagrams/application/diagram-service";

interface Ctx {
  params: Promise<{ id: string; diagramId: string }>;
}

/** GET /api/projects/[id]/diagrams/[diagramId] — جزئیات + سند + چیدمان + اعتبارسنجی. */
export const GET = withApi<Ctx>(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const id = await routeParam(ctx, "id");
  const diagramId = await routeParam(ctx, "diagramId");
  await authorizeProjectAction(id, user.id, "diagrams:read");
  return jsonOk(await getDiagramDetail(id, diagramId));
});

/** PUT /api/projects/[id]/diagrams/[diagramId] — ذخیره revision جدید (append-only؛ idempotent با clientOpId). */
export const PUT = withApi<Ctx>(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const id = await routeParam(ctx, "id");
  const diagramId = await routeParam(ctx, "diagramId");
  await authorizeProjectAction(id, user.id, "diagrams:write");
  const body = await readJsonBody(req, saveRevisionSchema);
  const result = await saveRevision(id, user.id, diagramId, body);
  return jsonOk(result);
});

const patchSchema = z.object({
  title: z.string().min(1).max(160).optional(),
  description: z.string().max(2000).nullable().optional(),
  status: z.enum(["draft", "confirmed", "archived"]).optional(),
});

/** PATCH /api/projects/[id]/diagrams/[diagramId] — عنوان/توضیح/وضعیت (تأیید/بایگانی). */
export const PATCH = withApi<Ctx>(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const id = await routeParam(ctx, "id");
  const diagramId = await routeParam(ctx, "diagramId");
  await authorizeProjectAction(id, user.id, "diagrams:write");
  const body = await readJsonBody(req, patchSchema);
  return jsonOk(await patchDiagram(id, user.id, diagramId, body));
});
