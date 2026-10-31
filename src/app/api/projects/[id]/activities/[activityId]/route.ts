import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonOk, routeParam, withApi, readJsonBody } from "@/shared/http";
import { requireSessionUser } from "@/modules/identity/application/session";
import { authorizeProjectAction } from "@/modules/projects/application/project-service";
import { setActivityArchived, updateActivity } from "@/modules/activities/application/activity-service";

interface Ctx {
  params: Promise<{ id: string; activityId: string }>;
}

const patchSchema = z.object({
  name: z.string().optional(),
  description: z.string().nullable().optional(),
  workType: z.string().optional(),
  vaClassification: z.string().nullable().optional(),
  stationHint: z.string().nullable().optional(),
  skillRequired: z.string().nullable().optional(),
  sourceOfTime: z.string().optional(),
  archived: z.boolean().optional(),
});

/** PATCH /api/projects/[id]/activities/[activityId] — ویرایش/بایگانی فعالیت. */
export const PATCH = withApi<Ctx>(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const id = await routeParam(ctx, "id");
  const activityId = await routeParam(ctx, "activityId");
  await authorizeProjectAction(id, user.id, "config:write");
  const body = await readJsonBody(req, patchSchema);

  if (body.archived !== undefined) {
    const result = await setActivityArchived(id, user.id, activityId, body.archived);
    return jsonOk(result);
  }
  const result = await updateActivity({
    projectId: id,
    userId: user.id,
    activityId,
    name: body.name,
    description: body.description,
    workType: body.workType,
    vaClassification: body.vaClassification,
    stationHint: body.stationHint,
    skillRequired: body.skillRequired,
    sourceOfTime: body.sourceOfTime,
  });
  return jsonOk(result);
});
