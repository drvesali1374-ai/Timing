import type { NextRequest } from "next/server";
import { jsonOk, routeParam, withApi } from "@/shared/http";
import { requireSessionUser } from "@/modules/identity/application/session";
import { authorizeProjectAction } from "@/modules/projects/application/project-service";
import { listFormulaResults } from "@/modules/params/application/value-service";

interface Ctx {
  params: Promise<{ id: string }>;
}

/** GET /api/projects/[id]/formulas/results — آخرین نتیجه هر فرمول (بازیابی پس از بازکردن پروژه). */
export const GET = withApi<Ctx>(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const id = await routeParam(ctx, "id");
  await authorizeProjectAction(id, user.id, "config:read");
  return jsonOk({ items: await listFormulaResults(id) });
});
