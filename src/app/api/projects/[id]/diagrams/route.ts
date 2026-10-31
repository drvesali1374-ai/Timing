import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonOk, routeParam, withApi, readJsonBody, parseQuery } from "@/shared/http";
import { requireSessionUser } from "@/modules/identity/application/session";
import { authorizeProjectAction } from "@/modules/projects/application/project-service";
import { createDiagram, listDiagrams, createMetaSchema } from "@/modules/diagrams/application/diagram-service";

interface Ctx {
  params: Promise<{ id: string }>;
}

const listQuerySchema = z.object({
  includeArchived: z.coerce.boolean().default(false),
});

/** GET /api/projects/[id]/diagrams — فهرست نمودارهای پروژه (OPC/FPC — فاز ۳). */
export const GET = withApi<Ctx>(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const id = await routeParam(ctx, "id");
  await authorizeProjectAction(id, user.id, "diagrams:read");
  const q = parseQuery(req, listQuerySchema);
  return jsonOk({ items: await listDiagrams(id, q.includeArchived) });
});

/** POST /api/projects/[id]/diagrams — ایجاد نمودار جدید + revision اول. */
export const POST = withApi<Ctx>(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const id = await routeParam(ctx, "id");
  await authorizeProjectAction(id, user.id, "diagrams:write");
  const body = await readJsonBody(req, createMetaSchema);
  return jsonOk(await createDiagram(id, user.id, body), 201);
});
