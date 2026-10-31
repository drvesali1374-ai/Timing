/**
 * لاگر ساختاریافته سبک — خروجی JSON در یک خط برای خوانایی در dev.log.
 * سطح از متغیر LOG_LEVEL (پیش‌فرض info). لایه دامنه هرگز مستقیماً لاگ نمی‌زند
 * (دامنه خالص است)؛ فقط Application/Infrastructure/UI سرور لاگ می‌زنند.
 */
type Level = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const configured = (process.env.LOG_LEVEL as Level | undefined) ?? "info";

function emit(level: Level, scope: string, message: string, data?: unknown) {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[configured]) return;
  const line = {
    t: new Date().toISOString(),
    level,
    scope,
    message,
    ...(data !== undefined ? { data } : {}),
  };
  const out = JSON.stringify(line);
  if (level === "error") console.error(out);
  else if (level === "warn") console.warn(out);
  else console.log(out);
}

export interface ScopedLogger {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
}

export function getLogger(scope: string): ScopedLogger {
  return {
    debug: (m, d) => emit("debug", scope, m, d),
    info: (m, d) => emit("info", scope, m, d),
    warn: (m, d) => emit("warn", scope, m, d),
    error: (m, d) => emit("error", scope, m, d),
  };
}
