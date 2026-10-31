import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonOk, routeParam, withApi, readJsonBody } from "@/shared/http";
import { requireSessionUser } from "@/modules/identity/application/session";
import { authorizeProjectAction } from "@/modules/projects/application/project-service";
import { validateDiagramNow, validateDoc } from "@/modules/diagrams/application/diagram-service";

interface Ctx {
  params: Promise<{ id: string; diagramId: string }>;
}

const bodySchema = z.object({
  /** اگر doc ارسال شود، همان اعتبارسنجی می‌شود (پیش‌نمایش بدون ذخیره)؛ وگرنه نسخه ذخیره‌شده */
  doc: z.unknown().optional(),
});

/**
 * POST /api/projects/[id]/diagrams/[diagramId]/validate — اجرای موتور اعتبارسنجی.
 * مرجع فعالیت‌های پروژه در ارزیابی لحاظ می‌شود (unknown-activity).
 */
export const POST = withApi<Ctx>(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const id = await routeParam(ctx, "id");
  const diagramId = await routeParam(ctx, "diagramId");
  await authorizeProjectAction(id, user.id, "diagrams:read");
  const body = await readJsonBody(req, bodySchema);
  if (body.doc !== undefined) {
    return jsonOk(await validateDoc(id, body.doc));
  }
  return jsonOk(await validateDiagramNow(id, diagramId));
});
