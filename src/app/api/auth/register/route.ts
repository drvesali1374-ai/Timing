import type { NextRequest } from "next/server";
import { jsonOk, readJsonBody, withApi } from "@/shared/http";
import { registerSchema } from "@/shared/validation/project";
import { registerUser } from "@/modules/identity/application/auth-service";

/** POST /api/auth/register — ثبت‌نام کاربر جدید (Credentials). */
export const POST = withApi<unknown>(async (req: NextRequest) => {
  const input = await readJsonBody(req, registerSchema);
  const user = await registerUser(input);
  return jsonOk({ user, messageFa: "حساب کاربری با موفقیت ساخته شد. اکنون وارد شوید." }, 201);
});
