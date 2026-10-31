import type { Metadata } from "next";
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
    "پلتفرم ماژولار زمان‌سنجی صنعتی، مطالعه کار، نمودارهای فرایندی OPC/FPC و بالانس خط تولید — فاز ۱: هسته نرم‌افزار، مدیریت پروژه‌ها و جداسازی داده‌ها.",
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
