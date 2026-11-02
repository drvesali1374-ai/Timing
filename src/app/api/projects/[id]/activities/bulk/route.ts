import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonOk, routeParam, withApi, readJsonBody } from "@/shared/http";
import { requireSessionUser } from "@/modules/identity/application/session";
import { authorizeProjectAction } from "@/modules/projects/application/project-service";
import { createActivitiesBulk } from "@/modules/activities/application/activity-service";

interface Ctx {
  params: Promise<{ id: string }>;
}

const bulkSchema = z.object({
  items: z
    .array(
      z.object({
        name: z.string().min(1),
        stableKey: z.string().optional(),
        description: z.string().optional(),
        workType: z.string().optional(),
        stationId: z.string().nullable().optional(),
        sourceOfTime: z.string().optional(),
      }),
    )
    .min(1)
    .max(200),
});

/** POST /api/projects/[id]/activities/bulk — ورود گروهی فعالیت‌ها (شناسه فنی خودکار). */
export const POST = withApi<Ctx>(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const id = await routeParam(ctx, "id");
  await authorizeProjectAction(id, user.id, "config:write");
  const body = await readJsonBody(req, bulkSchema);
  return jsonOk(await createActivitiesBulk(id, user.id, body.items), 201);
});
