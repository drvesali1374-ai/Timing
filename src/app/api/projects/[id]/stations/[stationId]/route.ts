import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonOk, routeParam, withApi, readJsonBody } from "@/shared/http";
import { requireSessionUser } from "@/modules/identity/application/session";
import { authorizeProjectAction } from "@/modules/projects/application/project-service";
import { reorderStations, setStationArchived, updateStation } from "@/modules/stations/application/station-service";

interface Ctx {
  params: Promise<{ id: string; stationId: string }>;
}

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  archived: z.boolean().optional(),
  reorder: z.array(z.string()).optional(),
});

/** PATCH /api/projects/[id]/stations/[stationId] — ویرایش/بایگانی/جابه‌جایی ترتیب ایستگاه. */
export const PATCH = withApi<Ctx>(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const { id, stationId } = await ctx.params;
  await authorizeProjectAction(id, user.id, "config:write");
  const body = await readJsonBody(req, patchSchema);
  if (body.reorder) {
    return jsonOk({ items: await reorderStations(id, user.id, [stationId, ...body.reorder]) });
  }
  if (body.archived !== undefined) {
    return jsonOk(await setStationArchived(id, user.id, stationId, body.archived));
  }
  return jsonOk(
    await updateStation({
      projectId: id,
      userId: user.id,
      stationId,
      name: body.name,
      description: body.description,
    }),
  );
});
