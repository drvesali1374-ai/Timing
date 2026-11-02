import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonOk, routeParam, withApi, readJsonBody } from "@/shared/http";
import { requireSessionUser } from "@/modules/identity/application/session";
import { authorizeProjectAction } from "@/modules/projects/application/project-service";
import { saveSheetCells, setSheetSampleCount } from "@/modules/manual-study/application/manual-service";

interface Ctx {
  params: Promise<{ id: string; sheetId: string }>;
}

const saveSchema = z.object({
  cells: z
    .array(
      z.object({
        activityId: z.string().min(1),
        sampleIndex: z.number().int(),
        value: z.string().nullable().optional(),
        durationMs: z.number().optional(),
        note: z.string().nullable().optional(),
      }),
    )
    .max(2000),
  source: z.enum(["manual", "paste", "import"]).optional(),
  sampleCount: z.number().int().min(0).optional(),
});

/** PUT /api/projects/[id]/manual-sheets/[sheetId]/observations — ذخیره دسته‌ای سلول‌های جدول. */
export const PUT = withApi<Ctx>(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const { id, sheetId } = await ctx.params;
  await authorizeProjectAction(id, user.id, "observations:write");
  const body = await readJsonBody(req, saveSchema);
  if (body.sampleCount !== undefined) {
    const r = await setSheetSampleCount(id, sheetId, user.id, body.sampleCount);
    return jsonOk(r);
  }
  return jsonOk(
    await saveSheetCells(
      id,
      sheetId,
      user.id,
      body.cells.map((c) => ({
        activityId: c.activityId,
        sampleIndex: c.sampleIndex,
        value: c.value ?? undefined,
        durationMs: c.durationMs,
        note: c.note ?? undefined,
      })),
      body.source ?? "manual",
    ),
  );
});
