"use client";

/**
 * کلاینت احراز هویت — ارتباط مستقیم با NextAuth از طریق fetch
 * (بدون SessionProvider تا SPA سبک بماند). مراحل ورود:
 * ۱) GET /api/auth/csrf  ۲) POST /api/auth/callback/credentials  ۳) GET /api/auth/session
 */
import type { SessionUserDto } from "@/shared/contracts/api";

async function getCsrfToken(): Promise<string> {
  const res = await fetch("/api/auth/csrf", { credentials: "include" });
  if (!res.ok) throw new Error("خطا در آماده‌سازی فرم ورود.");
  const data = (await res.json()) as { csrfToken: string };
  return data.csrfToken;
}

export async function loginWithCredentials(email: string, password: string): Promise<void> {
  const csrfToken = await getCsrfToken();
  const body = new URLSearchParams({ csrfToken, email, password, json: "true" });
  const res = await fetch("/api/auth/callback/credentials", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error("رایانامه یا گذرواژه نادرست است.");
  }
}

export async function logout(): Promise<void> {
  const csrfToken = await getCsrfToken();
  const body = new URLSearchParams({ csrfToken, json: "true" });
  await fetch("/api/auth/signout", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    credentials: "include",
  });
}

export async function fetchSession(): Promise<SessionUserDto | null> {
  try {
    const res = await fetch("/api/auth/session", { credentials: "include" });
    if (!res.ok) return null;
    const data = (await res.json()) as { user?: { id: string; email: string; name: string | null } };
    if (!data?.user?.id) return null;
    return { id: data.user.id, email: data.user.email, name: data.user.name };
  } catch {
    return null;
  }
}

/** فراخوانی عمومی API با شکل خطای استاندارد { error: { code, message } } */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }
  if (!res.ok) {
    const message =
      (payload as { error?: { message?: string } })?.error?.message ??
      `خطای سرور (${res.status})`;
    const err = new Error(message) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return payload as T;
}
