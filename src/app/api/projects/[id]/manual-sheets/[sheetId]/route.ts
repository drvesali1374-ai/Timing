import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonOk, routeParam, withApi, readJsonBody } from "@/shared/http";
import { requireSessionUser } from "@/modules/identity/application/session";
import { authorizeProjectAction } from "@/modules/projects/application/project-service";
import { deleteManualSheet, getManualSheet, setSheetStatus, updateManualSheet } from "@/modules/manual-study/application/manual-service";

interface Ctx {
  params: Promise<{ id: string; sheetId: string }>;
}

/** GET /api/projects/[id]/manual-sheets/[sheetId] — جزئیات کامل برگه (جدول + وقفه‌ها). */
export const GET = withApi<Ctx>(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const { id, sheetId } = await ctx.params;
  await authorizeProjectAction(id, user.id, "observations:read");
  return jsonOk(await getManualSheet(id, sheetId));
});

const patchSchema = z.object({
  title: z.string().min(1).optional(),
  note: z.string().nullable().optional(),
  status: z.enum(["draft", "completed", "finalized"]).optional(),
  reason: z.string().optional(),
});

/** PATCH — ویرایش عنوان/یادداشت یا تغییر وضعیت (تکمیل‌شده/نهایی‌شده/بازگردانی). */
export const PATCH = withApi<Ctx>(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const { id, sheetId } = await ctx.params;
  await authorizeProjectAction(id, user.id, "observations:write");
  const body = await readJsonBody(req, patchSchema);
  if (body.status) {
    return jsonOk(await setSheetStatus(id, sheetId, user.id, body.status, body.reason));
  }
  return jsonOk(
    await updateManualSheet({
      projectId: id,
      userId: user.id,
      sheetId,
      title: body.title,
      note: body.note,
    }),
  );
});

/** DELETE — حذف برگه (فقط پیش‌نویس بدون داده). */
export const DELETE = withApi<Ctx>(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const { id, sheetId } = await ctx.params;
  await authorizeProjectAction(id, user.id, "observations:write");
  await deleteManualSheet(id, sheetId, user.id);
  return jsonOk({ deleted: true });
});
