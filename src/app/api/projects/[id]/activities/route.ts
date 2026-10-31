import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonOk, routeParam, withApi, readJsonBody, parseQuery } from "@/shared/http";
import { requireSessionUser } from "@/modules/identity/application/session";
import { authorizeProjectAction } from "@/modules/projects/application/project-service";
import { createActivity, listActivities } from "@/modules/activities/application/activity-service";

interface Ctx {
  params: Promise<{ id: string }>;
}

const listQuerySchema = z.object({
  includeArchived: z.coerce.boolean().default(false),
});

/** GET /api/projects/[id]/activities — فهرست فعالیت‌ها (مدل B5). */
export const GET = withApi<Ctx>(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const id = await routeParam(ctx, "id");
  await authorizeProjectAction(id, user.id, "config:read");
  const q = parseQuery(req, listQuerySchema);
  return jsonOk({ items: await listActivities(id, q.includeArchived) });
});

const createSchema = z.object({
  stableKey: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  workType: z.string().min(1),
  vaClassification: z.string().nullable().optional(),
  stationHint: z.string().nullable().optional(),
  skillRequired: z.string().nullable().optional(),
  sourceOfTime: z.string().optional(),
  predecessors: z.array(z.string()).optional(),
});

/** POST /api/projects/[id]/activities — ایجاد فعالیت/عنصر کاری. */
export const POST = withApi<Ctx>(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const id = await routeParam(ctx, "id");
  await authorizeProjectAction(id, user.id, "config:write");
  const body = await readJsonBody(req, createSchema);
  return jsonOk(
    await createActivity({
      projectId: id,
      userId: user.id,
      stableKey: body.stableKey,
      name: body.name,
      description: body.description,
      workType: body.workType,
      vaClassification: body.vaClassification ?? null,
      stationHint: body.stationHint ?? null,
      skillRequired: body.skillRequired ?? null,
      sourceOfTime: body.sourceOfTime,
      predecessors: body.predecessors,
    }),
    201,
  );
});
