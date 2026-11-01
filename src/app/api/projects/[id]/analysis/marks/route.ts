import type { NextRequest } from "next/server";
import { jsonOk, routeParam, withApi, readJsonBody } from "@/shared/http";
import { requireSessionUser } from "@/modules/identity/application/session";
import { authorizeProjectAction } from "@/modules/projects/application/project-service";
import { markObservation } from "@/modules/analysis/application/analysis-service";
import { markObservationSchema } from "@/modules/analysis/application/analysis-service";

interface Ctx {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/projects/[id]/analysis/marks — علامت/حذف مشاهده (فاز ۵ بند ۲).
 * علامت‌گذاری «داده پرت» و «حذف از محاسبه» دو عمل جدا هستند؛
 * حذف بدون علت با ۴۰۰ رد می‌شود (B9). تاریخچه append-only + ممیزی.
 */
export const POST = withApi<Ctx>(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const id = await routeParam(ctx, "id");
  await authorizeProjectAction(id, user.id, "analysis:write");
  const body = await readJsonBody(req, markObservationSchema);
  return jsonOk(await markObservation(id, user.id, body));
});
