import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonOk, routeParam, withApi, readJsonBody } from "@/shared/http";
import { requireSessionUser } from "@/modules/identity/application/session";
import { authorizeProjectAction } from "@/modules/projects/application/project-service";
import { evaluateFormulaAtProjectScope } from "@/modules/params/application/value-service";

interface Ctx {
  params: Promise<{ id: string }>;
}

const bodySchema = z.object({
  formulaKey: z.string().min(1),
});

/**
 * POST /api/projects/[id]/formulas/evaluate — ارزیابی فرمول سطح پروژه با مقادیر واقعی.
 * نتیجه به‌صورت CalculationResult append-only ذخیره می‌شود (A7 — نتیجه قبلی حفظ می‌شود).
 */
export const POST = withApi<Ctx>(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const id = await routeParam(ctx, "id");
  await authorizeProjectAction(id, user.id, "config:write");
  const body = await readJsonBody(req, bodySchema);
  return jsonOk(await evaluateFormulaAtProjectScope({ projectId: id, userId: user.id, formulaKey: body.formulaKey }), 201);
});
