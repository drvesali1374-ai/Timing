import type { NextRequest } from "next/server";
import { jsonOk, parseQuery, readJsonBody, withApi } from "@/shared/http";
import { requireSessionUser } from "@/modules/identity/application/session";
import {
  createProject,
  listProjects,
} from "@/modules/projects/application/project-service";
import { projectCreateSchema, projectListQuerySchema } from "@/shared/validation/project";

/** GET /api/projects — فهرست پروژه‌های کاربر با جست‌وجو/فیلتر. */
export const GET = withApi<unknown>(async (req: NextRequest) => {
  const user = await requireSessionUser();
  const query = parseQuery(req, projectListQuerySchema);
  return jsonOk(await listProjects(user.id, query));
});

/** POST /api/projects — ایجاد پروژه با کپی مستقل پروفایل (A2/ADR-005). */
export const POST = withApi<unknown>(async (req: NextRequest) => {
  const user = await requireSessionUser();
  const input = await readJsonBody(req, projectCreateSchema);
  return jsonOk(await createProject(user.id, input), 201);
});
