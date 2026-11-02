import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Vazirmatn } from "next/font/google";
import "./globals.css";

const vazir = Vazirmatn({
  variable: "--font-vazir",
  subsets: ["arabic", "latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "زمان‌سنجی صنعتی | مدیریت پروژه‌های مطالعه کار",
  description:
    "پلتفرم ماژولار زمان‌سنجی صنعتی، مطالعه کار، نمودارهای فرایندی OPC/FPC، تحلیل زمان و بالانس خط تولید.",
  applicationName: "زمان‌سنجی صنعتی",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "زمان‌سنجی صنعتی",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
  keywords: [
    "زمان‌سنجی",
    "مطالعه کار",
    "بالانس خط تولید",
    "OPC",
    "FPC",
    "Yamazumi",
    "time study",
    "line balancing",
  ],
};

export const viewport: Viewport = {
  themeColor: "#1c1917",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body className={`${vazir.variable} font-sans antialiased bg-background text-foreground`}>
        {children}
        {/*
          گارد صفحه سفید (سطح HTML — مستقل از React):
          اگر به هر دلیلی برنامه سمت کلاینت بالا نیاید (خطای ماژول، chunk گمشده
          پس از بازساخت سرور dev، قطع شبکه)، پس از ۲۰ ثانیه این کارت فارسی با
          دکمه بازآوری ظاهر می‌شود. AppRoot پس از بالاآمدن موفق، پرچم __appBooted
          را می‌گذارد و این گارد را پنهان می‌کند.
        */}
        <div
          id="boot-fallback"
          dir="rtl"
          // این div ممکن است پیش از اتمام هیدریشن توسط گارد boot نمایش داده شود
          // (کامپایل کند dev) — جهش style توسط اسکریپت بیرونی است، نه React؛
          // suppressHydrationWarning دقیقاً برای همین الگوست.
          suppressHydrationWarning
          style={{
            display: "none",
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            background: "#fafaf9",
          }}
        >
          <div
            style={{
              maxWidth: 400,
              textAlign: "center",
              border: "1px solid #e7e5e4",
              borderRadius: 16,
              padding: "1.5rem",
              background: "#fff",
              boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
              fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
              color: "#1c1917",
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 8 }}>⏳</div>
            <h2 style={{ fontSize: 16, margin: "0 0 8px" }}>برنامه کامل بارگذاری نشد</h2>
            <p style={{ fontSize: 13, opacity: 0.75, margin: "0 0 16px", lineHeight: 1.8 }}>
              نمایش برنامه بیش از حد طول کشید. معمولاً یک بازآوری ساده مشکل را حل
              می‌کند. داده‌های شما در سرور امن است.
            </p>
            <button
              type="button"
              style={{
                padding: "10px 20px",
                borderRadius: 8,
                border: "none",
                background: "#1c1917",
                color: "#fafaf9",
                fontSize: 14,
                cursor: "pointer",
              }}
              data-boot-reload="1"
            >
              ↻ بازآوری صفحه
            </button>
          </div>
        </div>
        <noscript>
          <div style={{ padding: 24, textAlign: "center", fontFamily: "system-ui, sans-serif" }}>
            برای اجرای پلتفرم زمان‌سنجی صنعتی، جاوااسکریپت مرورگر باید فعال باشد.
          </div>
        </noscript>
        {/* اجرا در HTML اولیه، پیش از هر JS برنامه — حتی اگر React هرجا بالا نیاید فعال می‌ماند */}
        <Script
          id="boot-guard"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){
  function showBootFallback(){
    var el = document.getElementById('boot-fallback');
    if (el) el.style.display = 'flex';
  }
  function hideBootFallback(){
    var el = document.getElementById('boot-fallback');
    if (el) el.style.display = 'none';
  }
  try {
    document.addEventListener('click', function(ev){
      var t = ev.target;
      if (t && t.closest && t.closest('[data-boot-reload]')) {
        ev.preventDefault();
        window.location.reload();
      }
    });
    setTimeout(function(){
      if (!window.__appBooted) showBootFallback();
    }, 20000);
    window.__hideBootFallback = hideBootFallback;
  } catch (e) {}
})();`,
          }}
        />
      </body>
    </html>
  );
}
