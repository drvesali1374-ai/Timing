import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { jsonOk, routeParam, withApi, readJsonBody } from "@/shared/http";
import { requireSessionUser } from "@/modules/identity/application/session";
import { authorizeProjectAction } from "@/modules/projects/application/project-service";
import { saveManualAssignment } from "@/modules/balance/application/balance-service";
import { manualAssignmentSchema } from "@/modules/balance/application/balance-service";

interface Ctx {
  params: Promise<{ id: string; scenarioId: string }>;
}

/**
 * PUT /api/projects/[id]/balance/[scenarioId]/assignment — تخصیص دستی (بند ۹).
 * اعتبارسنجی فوری: قیود سخت (تقدم/ناسازگاری/ناموجود) → ۴۲۲ با دلیل هر نقض؛
 * قیود نرم (ظرفیت/سقف) → ذخیره با پرچم صادقانه. شاخص‌ها فوری بازمحاسبه می‌شوند.
 */
export const PUT = withApi<Ctx>(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const id = await routeParam(ctx, "id");
  const scenarioId = await routeParam(ctx, "scenarioId");
  await authorizeProjectAction(id, user.id, "balance:write");
  const body = await readJsonBody(req, manualAssignmentSchema);
  const { result, hardViolationsFa } = await saveManualAssignment(id, scenarioId, user.id, body);
  return jsonOk({ result, hardViolationsFa });
});

/** PUT ذخیره می‌کند؛ پیش‌نمایش بدون ذخیره در UI سمت کلاینت از همان موتور مشترک استفاده می‌کند. */
export const dynamic = "force-dynamic";
