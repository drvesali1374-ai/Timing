import type { Metadata } from "next";
import { Vazirmatn } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const vazir = Vazirmatn({
  variable: "--font-vazir",
  subsets: ["arabic", "latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "زمان‌سنجی صنعتی | فاز صفر — نمونه اولیه",
  description:
    "پلتفرم ماژولار زمان‌سنجی صنعتی، مطالعه کار، نمودارهای فرایندی OPC/FPC و بالانس خط تولید — نمونه اولیه قابل بررسی فاز صفر (وایرفریم تعاملی ۸ صفحه اصلی).",
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
        <Toaster />
      </body>
    </html>
  );
}
