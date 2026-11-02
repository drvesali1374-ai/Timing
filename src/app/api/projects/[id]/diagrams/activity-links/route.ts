import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonOk, routeParam, withApi, readJsonBody } from "@/shared/http";
import { requireSessionUser } from "@/modules/identity/application/session";
import { authorizeProjectAction } from "@/modules/projects/application/project-service";
import { addDiagramStepForActivity, getActivityLinks, unlinkDiagramStep } from "@/modules/diagrams/application/activity-links-service";

interface Ctx {
  params: Promise<{ id: string }>;
}

/** GET /api/projects/[id]/diagrams/activity-links — نقشه دوطرفه فعالیت↔گام نمودار. */
export const GET = withApi<Ctx>(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const id = await routeParam(ctx, "id");
  await authorizeProjectAction(id, user.id, "diagrams:read");
  return jsonOk(await getActivityLinks(id));
});

const linkSchema = z.object({
  activityStableKey: z.string().min(1),
  diagramId: z.string().min(1),
  symbol: z.string().min(1),
  title: z.string().optional(),
  reason: z.string().optional(),
});

/** POST — افزودن گام نمودار مرتبط از سمت فعالیت. */
export const POST = withApi<Ctx>(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const id = await routeParam(ctx, "id");
  await authorizeProjectAction(id, user.id, "diagrams:write");
  const body = await readJsonBody(req, linkSchema);
  return jsonOk(
    await addDiagramStepForActivity({
      projectId: id,
      userId: user.id,
      activityStableKey: body.activityStableKey,
      diagramId: body.diagramId,
      symbol: body.symbol,
      title: body.title,
      reason: body.reason,
    }),
    201,
  );
});

const unlinkSchema = z.object({
  activityStableKey: z.string().min(1),
  diagramId: z.string().min(1),
  nodeId: z.string().min(1),
  reason: z.string().optional(),
});

/** DELETE — قطع ارجاع گام از فعالیت. */
export const DELETE = withApi<Ctx>(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const id = await routeParam(ctx, "id");
  await authorizeProjectAction(id, user.id, "diagrams:write");
  const body = await readJsonBody(req, unlinkSchema);
  return jsonOk(
    await unlinkDiagramStep(id, user.id, body.activityStableKey, body.diagramId, body.nodeId, body.reason),
  );
});
