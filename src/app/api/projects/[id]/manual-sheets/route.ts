import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonOk, routeParam, withApi, readJsonBody } from "@/shared/http";
import { requireSessionUser } from "@/modules/identity/application/session";
import { authorizeProjectAction } from "@/modules/projects/application/project-service";
import { createManualSheet, listManualSheets } from "@/modules/manual-study/application/manual-service";

interface Ctx {
  params: Promise<{ id: string }>;
}

/** GET /api/projects/[id]/manual-sheets — فهرست برگه‌های ثبت زمان. */
export const GET = withApi<Ctx>(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const id = await routeParam(ctx, "id");
  await authorizeProjectAction(id, user.id, "observations:read");
  return jsonOk({ items: await listManualSheets(id) });
});

const createSchema = z.object({
  title: z.string().min(1),
  note: z.string().optional(),
});

/** POST /api/projects/[id]/manual-sheets — ایجاد برگه ثبت زمان جدید. */
export const POST = withApi<Ctx>(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const id = await routeParam(ctx, "id");
  await authorizeProjectAction(id, user.id, "observations:write");
  const body = await readJsonBody(req, createSchema);
  return jsonOk(await createManualSheet({ projectId: id, userId: user.id, title: body.title, note: body.note }), 201);
});
