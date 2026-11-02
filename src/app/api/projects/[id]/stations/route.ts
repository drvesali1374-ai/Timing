import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonOk, routeParam, withApi, readJsonBody, parseQuery } from "@/shared/http";
import { requireSessionUser } from "@/modules/identity/application/session";
import { authorizeProjectAction } from "@/modules/projects/application/project-service";
import { createStation, createStationsBulk, listStations } from "@/modules/stations/application/station-service";

interface Ctx {
  params: Promise<{ id: string }>;
}

const listQuerySchema = z.object({
  includeArchived: z.coerce.boolean().default(false),
});

/** GET /api/projects/[id]/stations — فهرست ایستگاه‌های کاری خط تولید. */
export const GET = withApi<Ctx>(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const id = await routeParam(ctx, "id");
  await authorizeProjectAction(id, user.id, "config:read");
  const q = parseQuery(req, listQuerySchema);
  return jsonOk({ items: await listStations(id, q.includeArchived) });
});

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

/** POST /api/projects/[id]/stations — ایجاد ایستگاه (تکی). */
export const POST = withApi<Ctx>(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const id = await routeParam(ctx, "id");
  await authorizeProjectAction(id, user.id, "config:write");
  const body = await readJsonBody(req, createSchema);
  return jsonOk(await createStation({ projectId: id, userId: user.id, name: body.name, description: body.description }), 201);
});

const bulkSchema = z.object({
  names: z.array(z.string()).min(1).max(100),
});

/** PUT /api/projects/[id]/stations — ورود گروهی نام ایستگاه‌ها (هر سطر یک نام). */
export const PUT = withApi<Ctx>(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const id = await routeParam(ctx, "id");
  await authorizeProjectAction(id, user.id, "config:write");
  const body = await readJsonBody(req, bulkSchema);
  return jsonOk(await createStationsBulk({ projectId: id, userId: user.id, names: body.names }));
});
