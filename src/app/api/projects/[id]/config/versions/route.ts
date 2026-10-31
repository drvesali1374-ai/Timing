import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonOk, routeParam, withApi, readJsonBody } from "@/shared/http";
import { requireSessionUser } from "@/modules/identity/application/session";
import { authorizeProjectAction } from "@/modules/projects/application/project-service";
import { applyChanges } from "@/modules/config/application/config-service";

interface Ctx {
  params: Promise<{ id: string }>;
}

const bodySchema = z.object({
  reason: z.string().min(3, "دلیل ثبت نسخه الزامی است (حداقل ۳ نویسه)"),
  operations: z.array(z.record(z.string(), z.unknown())).min(1, "حداقل یک عملیات لازم است"),
});

/**
 * POST /api/projects/[id]/config/versions — اعمال دسته عملیات تغییر پیکربندی.
 * هر فراخوانی یک ConfigVersion جدید append-only می‌سازد (ADR-005)؛
 * اعتبارسنجی کامل snapshot + کشف چرخه فرمول پیش از ذخیره انجام می‌شود.
 */
export const POST = withApi<Ctx>(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const id = await routeParam(ctx, "id");
  await authorizeProjectAction(id, user.id, "config:write");
  const body = await readJsonBody(req, bodySchema);
  const result = await applyChanges({
    projectId: id,
    userId: user.id,
    reason: body.reason,
    operations: body.operations as never[],
  });
  return jsonOk(result, 201);
});
