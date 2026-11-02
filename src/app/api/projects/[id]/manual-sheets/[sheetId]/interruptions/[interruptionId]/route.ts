import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonOk, routeParam, withApi, readJsonBody } from "@/shared/http";
import { requireSessionUser } from "@/modules/identity/application/session";
import { authorizeProjectAction } from "@/modules/projects/application/project-service";
import { removeInterruption, updateInterruption } from "@/modules/manual-study/application/manual-service";

interface Ctx {
  params: Promise<{ id: string; sheetId: string; interruptionId: string }>;
}

const patchSchema = z.object({
  activityId: z.string().nullable().optional(),
  reason: z.string().optional(),
  reasonOther: z.string().nullable().optional(),
  durationValue: z.string().nullable().optional(),
  durationKnown: z.boolean().optional(),
  note: z.string().optional(),
  sampleIndex: z.number().int().nullable().optional(),
});

/** PATCH — ویرایش وقفه. */
export const PATCH = withApi<Ctx>(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const { id, sheetId, interruptionId } = await ctx.params;
  await authorizeProjectAction(id, user.id, "observations:write");
  const body = await readJsonBody(req, patchSchema);
  return jsonOk(
    await updateInterruption({
      projectId: id,
      sheetId,
      interruptionId,
      userId: user.id,
      activityId: body.activityId,
      reason: body.reason,
      reasonOther: body.reasonOther,
      durationValue: body.durationValue,
      durationKnown: body.durationKnown,
      note: body.note,
      sampleIndex: body.sampleIndex,
    }),
  );
});

/** DELETE — حذف وقفه (پیش از نهایی‌سازی برگه). */
export const DELETE = withApi<Ctx>(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const { id, sheetId, interruptionId } = await ctx.params;
  await authorizeProjectAction(id, user.id, "observations:write");
  return jsonOk(await removeInterruption(id, sheetId, interruptionId, user.id));
});
