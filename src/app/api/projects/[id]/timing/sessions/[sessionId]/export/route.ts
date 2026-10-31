import { NextResponse, type NextRequest } from "next/server";
import { routeParam, withApi } from "@/shared/http";
import { requireSessionUser } from "@/modules/identity/application/session";
import { authorizeProjectAction } from "@/modules/projects/application/project-service";
import { getRawExport } from "@/modules/timing/application/timing-service";

interface Ctx {
  params: Promise<{ id: string; sessionId: string }>;
}

/**
 * GET /api/projects/[id]/timing/sessions/[sessionId]/export
 * خروجی JSON خام جلسه + کل دفتر رویداد — بازیابی داده (معیار پذیرش فاز ۴).
 * دانلود با Content-Disposition انجام می‌شود (نیازی به query نیست).
 */
export const GET = withApi<Ctx>(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const id = await routeParam(ctx, "id");
  const sessionId = await routeParam(ctx, "sessionId");
  await authorizeProjectAction(id, user.id, "observations:read");
  const data = await getRawExport(id, sessionId);
  return new NextResponse(JSON.stringify({ exportedAt: new Date().toISOString(), ...data }, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="timing-session-${sessionId}.json"`,
    },
  });
});
