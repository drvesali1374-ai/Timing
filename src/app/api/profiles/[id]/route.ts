import type { NextRequest } from "next/server";
import { jsonOk, routeParam, withApi } from "@/shared/http";
import { requireSessionUser } from "@/modules/identity/application/session";
import { getProfileDetail } from "@/modules/profiles/application/profile-service";

interface Ctx {
  params: Promise<{ id: string }>;
}

/** GET /api/profiles/[id] — جزئیات کامل پروفایل (جهت پیش‌نمایش پیش از ایجاد پروژه). */
export const GET = withApi<Ctx>(async (_req: NextRequest, ctx: Ctx) => {
  await requireSessionUser();
  const id = await routeParam(ctx, "id");
  return jsonOk(await getProfileDetail(id));
});
