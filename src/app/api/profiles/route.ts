import type { NextRequest } from "next/server";
import { jsonOk, withApi } from "@/shared/http";
import { requireSessionUser } from "@/modules/identity/application/session";
import { listProfiles } from "@/modules/profiles/application/profile-service";

/** GET /api/profiles — فهرست پروفایل‌های روش‌شناختی (نیازمند نشست). */
export const GET = withApi<unknown>(async (_req: NextRequest) => {
  await requireSessionUser();
  const items = await listProfiles();
  return jsonOk({ items });
});
