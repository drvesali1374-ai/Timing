/**
 * خطاهای یکپارچه API — همه routeها از این کلاس‌ها استفاده می‌کنند تا شکل پاسخ خطا
 * یکنواخت بماند: { error: { code, message, details? } }
 * مطابق ADR-009: پاسخ خطای بی‌مجاز، وجود/عدم وجود رکورد را افشا نمی‌کند (404 عمومی).
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    messageFa: string,
    public readonly details?: unknown,
  ) {
    super(messageFa);
    this.name = "ApiError";
  }

  static unauthorized(messageFa = "برای انجام این عملیات باید وارد حساب کاربری شوید."): ApiError {
    return new ApiError(401, "UNAUTHORIZED", messageFa);
  }
  static forbidden(messageFa = "برای این عملیات نقش شما کافی نیست."): ApiError {
    return new ApiError(403, "FORBIDDEN", messageFa);
  }
  static notFound(messageFa = "مورد درخواست‌شده یافت نشد."): ApiError {
    return new ApiError(404, "NOT_FOUND", messageFa);
  }
  static badRequest(messageFa = "درخواست نامعتبر است.", details?: unknown): ApiError {
    return new ApiError(400, "BAD_REQUEST", messageFa, details);
  }
  static conflict(messageFa = "این مقدار قبلاً استفاده شده است.", details?: unknown): ApiError {
    return new ApiError(409, "CONFLICT", messageFa, details);
  }
  static internal(messageFa = "خطای داخلی سرور رخ داد. لطفاً دوباره تلاش کنید."): ApiError {
    return new ApiError(500, "INTERNAL", messageFa);
  }
}

/** تبدیل هر خطای ناشناخته به ApiError قابل گزارش (بدون افشای جزئیات داخلی). */
export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  return ApiError.internal();
}
