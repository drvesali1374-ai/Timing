import type { NextRequest } from "next/server";
import { jsonOk, routeParam, withApi, readJsonBody } from "@/shared/http";
import { requireSessionUser } from "@/modules/identity/application/session";
import { authorizeProjectAction } from "@/modules/projects/application/project-service";
import { getBalanceOverview, createScenario } from "@/modules/balance/application/balance-service";
import { createScenarioSchema } from "@/modules/balance/application/balance-service";

interface Ctx {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/projects/[id]/balance — نمای کلی بالانس (فاز ۶):
 * سناریوها + نتیجه جاری هر کدام + آمادگی داده (فعالیت‌ها/زمان‌ها/گراف تقدم).
 */
export const GET = withApi<Ctx>(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const id = await routeParam(ctx, "id");
  await authorizeProjectAction(id, user.id, "balance:read");
  return jsonOk(await getBalanceOverview(id));
});

/** POST /api/projects/[id]/balance — ایجاد سناریوی بالانس (ورودی‌های B10). */
export const POST = withApi<Ctx>(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const id = await routeParam(ctx, "id");
  await authorizeProjectAction(id, user.id, "balance:write");
  const body = await readJsonBody(req, createScenarioSchema);
  return jsonOk(await createScenario(id, user.id, body), 201);
});
