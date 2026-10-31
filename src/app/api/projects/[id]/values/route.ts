import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonOk, routeParam, withApi, readJsonBody } from "@/shared/http";
import { requireSessionUser } from "@/modules/identity/application/session";
import { authorizeProjectAction } from "@/modules/projects/application/project-service";
import { listProjectValues, saveParamValue } from "@/modules/params/application/value-service";

interface Ctx {
  params: Promise<{ id: string }>;
}

/** GET /api/projects/[id]/values — فهرست مقدارهای پارامتر دامنه project (با تعاریف جاری برای فرم‌ساز). */
export const GET = withApi<Ctx>(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const id = await routeParam(ctx, "id");
  await authorizeProjectAction(id, user.id, "config:read");
  return jsonOk({ items: await listProjectValues(id, user.id) });
});

const putSchema = z.object({
  values: z
    .array(
      z.object({
        stableKey: z.string().min(1),
        value: z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.string())]),
      }),
    )
    .min(1, "حداقل یک مقدار لازم است"),
});

/** PUT /api/projects/[id]/values — ثبت دسته مقدارها (اعتبارسنجی در برابر تعریف + defVersion pinning). */
export const PUT = withApi<Ctx>(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const id = await routeParam(ctx, "id");
  await authorizeProjectAction(id, user.id, "config:write");
  const body = await readJsonBody(req, putSchema);
  const saved: Awaited<ReturnType<typeof listProjectValues>> = [];
  for (const item of body.values) {
    saved.push(await saveParamValue({ projectId: id, userId: user.id, stableKey: item.stableKey, value: item.value }));
  }
  return jsonOk({ items: saved });
});
