import { NextRequest, NextResponse } from "next/server";
import type { ZodType } from "zod";
import { ApiError, toApiError } from "./errors";
import { getLogger } from "./logger";

const log = getLogger("http");

/** پاسخ موفق استاندارد */
export function jsonOk(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

/** پاسخ خطای استاندارد + لاگ. خطاهای ۵xx جزئیات داخلی را افشا نمی‌کنند. */
export function jsonError(err: unknown): NextResponse {
  const apiErr = toApiError(err);
  if (apiErr.status >= 500) {
    log.error("internal error", { message: String(err), stack: err instanceof Error ? err.stack : undefined });
  } else {
    log.warn("request rejected", { code: apiErr.code, status: apiErr.status, message: apiErr.message });
  }
  return NextResponse.json(
    { error: { code: apiErr.code, message: apiErr.message, ...(apiErr.details !== undefined ? { details: apiErr.details } : {}) } },
    { status: apiErr.status },
  );
}

/** پارامتر مسیر را از ctx.async می‌خواند (App Router — params یک Promise است). */
export async function routeParam<T = Record<string, string>>(ctx: { params: Promise<T> }, key: keyof T & string): Promise<string> {
  const params = await ctx.params;
  const value = params[key];
  if (!value) throw ApiError.notFound();
  return value as string;
}

/** بدنه JSON را می‌خواند و با zod اعتبارسنجی می‌کند؛ خطا → ۴۰۰ با جزئیات فیلدها. */
export async function readJsonBody<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw ApiError.badRequest("بدنه درخواست JSON معتبر نیست.");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw ApiError.badRequest("داده‌های ارسالی نامعتبر است.", {
      fields: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }
  return parsed.data;
}

/** پارامترهای جست‌وجو را با اسکیمای zod اعتبارسنجی می‌کند. */
export function parseQuery<T>(req: NextRequest, schema: ZodType<T>): T {
  const sp = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = schema.safeParse(sp);
  if (!parsed.success) {
    throw ApiError.badRequest("پارامترهای جست‌وجو نامعتبرند.", {
      fields: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }
  return parsed.data;
}

/** پوشش استاندارد route: خطاها را می‌گیرد و پاسخ یکدست برمی‌گرداند. */
export function withApi<Ctx = unknown>(
  handler: (req: NextRequest, ctx: Ctx) => Promise<NextResponse> | NextResponse,
) {
  return async (req: NextRequest, ctx: Ctx): Promise<NextResponse> => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      return jsonError(err);
    }
  };
}
