"use client";

/**
 * مرز خطای ریشه (global-error) — خطاهای خودِ layout/providers که error.tsx
 * آن‌ها را نمی‌گیرد. چون جایگزین کل درخت (شامل html/body) می‌شود، ساختار
 * HTML و راست‌چینی را خودش می‌سازد.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error("[global-error]", error?.message, error?.digest ?? "");

  return (
    <html lang="fa" dir="rtl">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
          background: "#fafaf9",
          color: "#1c1917",
        }}
      >
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "9999px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#fee2e2",
              color: "#b91c1c",
              marginBottom: 12,
              fontSize: 22,
            }}
          >
            ⚠
          </div>
          <h1 style={{ fontSize: 18, margin: "0 0 8px" }}>
            خطای راه‌اندازی برنامه
          </h1>
          <p style={{ fontSize: 14, opacity: 0.75, margin: "0 0 16px", maxWidth: 360 }}>
            برنامه در مرورگر شما کامل بارگذاری نشد. یک بار صفحه را بازآوری کنید؛
            داده‌های شما در سرور امن است.
            {error?.digest ? ` (شناسه: ${error.digest})` : ""}
          </p>
          <button
            onClick={reset}
            style={{
              padding: "10px 20px",
              borderRadius: 8,
              border: "none",
              background: "#1c1917",
              color: "#fafaf9",
              fontSize: 14,
              cursor: "pointer",
              marginBottom: 8,
            }}
          >
            ↻ تلاش دوباره
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "10px 20px",
              borderRadius: 8,
              border: "1px solid #d6d3d1",
              background: "transparent",
              color: "#1c1917",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            بازآوری کامل صفحه
          </button>
        </div>
      </body>
    </html>
  );
}
