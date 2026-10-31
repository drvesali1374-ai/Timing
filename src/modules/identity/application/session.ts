/**
 * نشست سمت سرور — خواندن کاربر جاری از getServerSession.
 * هر route قبل از هر عملیاتی ابتدا از این تابع می‌گذرد (ADR-009: session → نقش → فیلتر).
 */
import { getServerSession } from "next-auth";
import { authOptions } from "../infrastructure/nextauth";
import { ApiError } from "@/shared/errors";
import type { SessionUserDto } from "@/shared/contracts/api";

export async function getSessionUser(): Promise<SessionUserDto | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name ?? null,
  };
}

/** نیازمند نشست — در غیر این صورت ۴۰۱. */
export async function requireSessionUser(): Promise<SessionUserDto> {
  const user = await getSessionUser();
  if (!user) throw ApiError.unauthorized();
  return user;
}
