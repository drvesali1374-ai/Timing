"use client";

/**
 * ارائه‌دهنده‌های کلاینت — Direction(RTL) + TanStack Query + Toaster (sonner) + ثبت PWA.
 * DirectionProvider (بند ۶.۵ مأموریت RTL): اجزای Portal رادیکس (Select/DropdownMenu/
 * Popover/Tooltip/Dialog/…) بدون آن dir="ltr" پیش‌فرض می‌گیرند و جهتشان می‌شکست.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DirectionProvider } from "@radix-ui/react-direction";
import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { PwaRegister } from "./pwa-register";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
            staleTime: 30 * 1000,
          },
        },
      }),
  );
  return (
    <DirectionProvider dir="rtl">
      <QueryClientProvider client={queryClient}>
        {children}
        <PwaRegister />
        <Toaster richColors position="bottom-left" dir="rtl" />
      </QueryClientProvider>
    </DirectionProvider>
  );
}
