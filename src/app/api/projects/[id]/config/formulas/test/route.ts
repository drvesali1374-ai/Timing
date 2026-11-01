import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonOk, routeParam, withApi, readJsonBody } from "@/shared/http";
import { requireSessionUser } from "@/modules/identity/application/session";
import { authorizeProjectAction } from "@/modules/projects/application/project-service";
import { testExpr, testFormulaByKey } from "@/modules/config/application/config-service";

interface Ctx {
  params: Promise<{ id: string }>;
}

/** مقدار نمونه مجاز — با داده واقعی پروژه مخلوط نمی‌شود (B2/فاز۲: داده نمونه جدا). */
const sampleValueSchema = z.union([
  z.number(),
  z.string().max(512),
  z.boolean(),
  z.null(),
  z.array(z.union([z.number(), z.string().max(512), z.boolean(), z.null()])).max(200),
]);

const bodySchema = z
  .object({
    expr: z.string().min(1).max(2048).optional(),
    formulaKey: z.string().min(1).max(128).optional(),
    sampleValues: z.record(z.string().max(128), sampleValueSchema).optional(),
    sampleUnits: z.record(z.string().max(128), z.string().max(32)).optional(),
  })
  .refine((b) => (b.expr ? 1 : 0) + (b.formulaKey ? 1 : 0) === 1, {
    message: "دقیقاً یکی از expr یا formulaKey باید ارسال شود.",
  });

/**
 * POST /api/projects/[id]/config/formulas/test — آزمون فرمول با داده نمونه.
 * نتیجه ذخیره نمی‌شود (برخلاف evaluate) — داده نمونه هرگز با داده واقعی مخلوط نمی‌شود.
 * پشتیبانی دو حالت: expr خام یا formulaKey ثبت‌شده در snapshot (با قرارداد ورودی خودش).
 */
export const POST = withApi<Ctx>(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const id = await routeParam(ctx, "id");
  await authorizeProjectAction(id, user.id, "config:read");
  const body = await readJsonBody(req, bodySchema);
  const result = body.formulaKey
    ? await testFormulaByKey(id, body.formulaKey, body.sampleValues ?? {}, body.sampleUnits)
    : await testExpr(id, body.expr as string, body.sampleValues ?? {}, body.sampleUnits);
  return jsonOk(result);
});
