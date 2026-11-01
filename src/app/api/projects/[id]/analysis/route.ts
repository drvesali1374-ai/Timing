import type { NextRequest } from "next/server";
import { jsonOk, routeParam, withApi } from "@/shared/http";
import { requireSessionUser } from "@/modules/identity/application/session";
import { authorizeProjectAction } from "@/modules/projects/application/project-service";
import { getAnalysis } from "@/modules/analysis/application/analysis-service";

interface Ctx {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/projects/[id]/analysis — تحلیل کامل مهندسی زمان (فاز ۵).
 * شامل: تنظیمات صریح + منابع، جلسات، مشاهدات نشانه‌خورده، آمار B9،
 * زنجیره زمان B4 (با ردیابی نسخه فرمول)، کیفیت نمونه، کاتالوگ فرمول‌ها و راهنما.
 */
export const GET = withApi<Ctx>(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const id = await routeParam(ctx, "id");
  await authorizeProjectAction(id, user.id, "analysis:read");
  return jsonOk(await getAnalysis(id));
});
