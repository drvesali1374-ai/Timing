import type { NextRequest } from "next/server";
import { jsonOk, readJsonBody, routeParam, withApi } from "@/shared/http";
import { requireSessionUser } from "@/modules/identity/application/session";
import {
  getProject,
  updateProject,
} from "@/modules/projects/application/project-service";
import { projectUpdateSchema } from "@/shared/validation/project";

interface Ctx {
  params: Promise<{ id: string }>;
}

/** GET /api/projects/[id] — جزئیات پروژه (مجوزسنجی سرور: عضویت الزامی). */
export const GET = withApi<Ctx>(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const id = await routeParam(ctx, "id");
  return jsonOk(await getProject(id, user.id));
});

/** PATCH /api/projects/[id] — ویرایش داده‌های عمومی پروژه (editor+). */
export const PATCH = withApi<Ctx>(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireSessionUser();
  const id = await routeParam(ctx, "id");
  const input = await readJsonBody(req, projectUpdateSchema);
  return jsonOk(await updateProject(id, user.id, input));
});
