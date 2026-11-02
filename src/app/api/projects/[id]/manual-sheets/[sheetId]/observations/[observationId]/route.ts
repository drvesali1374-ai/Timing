import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonOk, routeParam, withApi, readJsonBody } from "@/shared/http";
import { requireSessionUser } from "@/modules/identity/application/session";
import { authorizeProjectAction } from "@/modules/projects/application/project-service";
import { correctObservation } from "@/modules/manual-study/application/manual-service";

interface Ctx {
  params: Promise<{ id: string; sheetId: string; observationId: string }>;
}

const patchSchema = z.object({
  value: z.string().optional(),
  durationMs: z.number().optional(),
  reason: z.string().optional(),
});

/**
 * PATCH /api/projects/[id]/manual-sheets/[sheetId]/observations/[observationId]
 * اصلاح مقدار یک مشاهده — پس از نهایی‌سازی برگه، دلیل الزامی است.
 */
export const PATCH = withApi<Ctx>(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const { id, sheetId, observationId } = await ctx.params;
  await authorizeProjectAction(id, user.id, "observations:write");
  const body = await readJsonBody(req, patchSchema);
  return jsonOk(
    await correctObservation({
      projectId: id,
      sheetId,
      observationId,
      userId: user.id,
      value: body.value,
      durationMs: body.durationMs,
      reason: body.reason,
    }),
  );
});
