import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonOk, routeParam, withApi, readJsonBody } from "@/shared/http";
import { requireSessionUser } from "@/modules/identity/application/session";
import { authorizeProjectAction } from "@/modules/projects/application/project-service";
import { setObservationMark } from "@/modules/manual-study/application/manual-service";

interface Ctx {
  params: Promise<{ id: string; sheetId: string; observationId: string }>;
}

const markSchema = z.object({
  outlierMarked: z.boolean(),
  excluded: z.boolean(),
  reason: z.string().optional(),
});

/** POST — علامت «داده پرت» / حذف از محاسبه (حذف نیازمند علت). */
export const POST = withApi<Ctx>(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const { id, sheetId, observationId } = await ctx.params;
  await authorizeProjectAction(id, user.id, "analysis:write");
  const body = await readJsonBody(req, markSchema);
  return jsonOk(
    await setObservationMark({
      projectId: id,
      sheetId,
      observationId,
      userId: user.id,
      outlierMarked: body.outlierMarked,
      excluded: body.excluded,
      reason: body.reason,
    }),
  );
});
