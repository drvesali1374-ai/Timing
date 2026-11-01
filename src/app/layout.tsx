import type { Metadata, Viewport } from "next";
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
      </body>
    </html>
  );
}
