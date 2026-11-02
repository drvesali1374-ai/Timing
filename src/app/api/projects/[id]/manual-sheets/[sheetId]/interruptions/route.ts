import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonOk, routeParam, withApi, readJsonBody } from "@/shared/http";
import { requireSessionUser } from "@/modules/identity/application/session";
import { authorizeProjectAction } from "@/modules/projects/application/project-service";
import { addInterruption } from "@/modules/manual-study/application/manual-service";

interface Ctx {
  params: Promise<{ id: string; sheetId: string }>;
}

const addSchema = z.object({
  activityId: z.string().nullable().optional(),
  reason: z.string().min(1),
  reasonOther: z.string().nullable().optional(),
  durationValue: z.string().nullable().optional(),
  durationKnown: z.boolean().optional(),
  note: z.string().optional(),
  sampleIndex: z.number().int().nullable().optional(),
});

/** POST — ثبت وقفه (علت از فهرست؛ «سایر» نیازمند متن؛ مدت نامشخص مجاز). */
export const POST = withApi<Ctx>(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const { id, sheetId } = await ctx.params;
  await authorizeProjectAction(id, user.id, "observations:write");
  const body = await readJsonBody(req, addSchema);
  return jsonOk(
    await addInterruption({
      projectId: id,
      sheetId,
      userId: user.id,
      activityId: body.activityId ?? null,
      reason: body.reason,
      reasonOther: body.reasonOther ?? null,
      durationValue: body.durationValue ?? null,
      durationKnown: body.durationKnown,
      note: body.note,
      sampleIndex: body.sampleIndex ?? null,
    }),
    201,
  );
});
