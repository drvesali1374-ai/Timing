"use client";

/**
 * ارائه‌دهنده‌های کلاینت — TanStack Query + Toaster (sonner) + ثبت PWA (فاز ۷).
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
    <QueryClientProvider client={queryClient}>
      {children}
      <PwaRegister />
      <Toaster richColors position="bottom-left" dir="rtl" />
    </QueryClientProvider>
  );
}
