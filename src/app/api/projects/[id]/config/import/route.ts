import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonOk, routeParam, withApi, readJsonBody } from "@/shared/http";
import { requireSessionUser } from "@/modules/identity/application/session";
import { authorizeProjectAction } from "@/modules/projects/application/project-service";
import { importConfig } from "@/modules/config/application/config-service";

interface Ctx {
  params: Promise<{ id: string }>;
}

const bodySchema = z.object({
  /** محتوای فایل پیکربندی (timing-config-snapshot v2) */
  payload: z.unknown(),
  /** true = فقط اعتبارسنجی و گزارش خطا؛ اعمال واقعی انجام نمی‌شود */
  dryRun: z.boolean().default(true),
  reason: z.string().default(""),
});

/**
 * POST /api/projects/[id]/config/import — درون‌ریزی پیکربندی.
 * فایل «پیش از اعمال» اعتبارسنجی می‌شود و خطاها گزارش می‌شوند (بند ۹ فاز ۲)؛
 * اعمال فقط با dryRun=false و پس از قبولی اعتبارسنجی → نسخه جدید append-only.
 */
export const POST = withApi<Ctx>(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const id = await routeParam(ctx, "id");
  await authorizeProjectAction(id, user.id, "config:write");
  const body = await readJsonBody(req, bodySchema);
  const report = await importConfig({
    projectId: id,
    userId: user.id,
    payload: body.payload,
    dryRun: body.dryRun,
    reason: body.reason,
  });
  return jsonOk(report, report.valid ? (body.dryRun ? 200 : 201) : 422);
});
