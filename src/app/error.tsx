"use client";

/**
 * مرز خطای سطح صفحه (Next.js error boundary) — هر خطای رندر سمت کلاینت
 * به‌جای صفحه سفید، کارت راهنمای فارسی با دکمه «تلاش دوباره» نمایش می‌دهد.
 * (سخت‌گیری فاز ۷: تجربه خراب بی‌رنگ/بی‌اخبار ممنوع.)
 */
import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // ثبت برای عیب‌یابی (dev console) — بدون افشای جزئیات به کاربر
    console.error("[app-error]", error?.message, error?.digest ?? "");
  }, [error]);

  return (
    <div
      dir="rtl"
      className="flex min-h-screen flex-col items-center justify-center bg-background p-4"
    >
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
            <AlertTriangle className="size-6" aria-hidden />
          </div>
          <CardTitle>خطایی در نمایش برنامه رخ داد</CardTitle>
          <CardDescription>
            داده‌های شما در سرور امن است. معمولاً تلاش دوباره مشکل را برطرف می‌کند.
            {error?.digest ? ` (شناسه: ${error.digest})` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Button onClick={reset} className="w-full gap-2">
            <RotateCcw className="size-4" aria-hidden /> تلاش دوباره
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => window.location.reload()}
          >
            بازآوری کامل صفحه
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
