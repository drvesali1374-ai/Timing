"use client";

/**
 * ثبت Service Worker پلتفرم (ADR-006 — تحویل فاز ۷).
 * - ثبت غیرمسدودکننده پس از بارگذاری کامل صفحه.
 * - اعلان صادقانه وضعیت آنلاین/آفلاین (توست + رویداد سفارری برای کامپوننت‌ها).
 * - هنگام نسخه جدید SW: اعلان «به‌روزرسانی آماده» با فعال‌سازی اضطراری (skipWaiting + reload).
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";

type SwStatus = "unsupported" | "registering" | "active" | "failed";

export function PwaRegister() {
  // «پشتیبانی‌نشده» در مقداردهی اولیه مشتق می‌شود (نه setState همگام در effect)
  const [swStatus, setSwStatus] = useState<SwStatus>(() =>
    typeof window !== "undefined" && !("serviceWorker" in navigator)
      ? "unsupported"
      : "registering",
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    let reloading = false;
    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      // نسخه جدید فعال شد — بارگذاری مجدد یک‌باره برای پوسته تازه
      window.location.reload();
    };

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });

        // نسخه جدیدی منتظر است → اعلان با اقدام فعال‌سازی
        const notifyUpdate = (waiting: ServiceWorker | null) => {
          if (!waiting) return;
          toast.info("نسخه جدید برنامه آماده است", {
            description: "برای فعال‌سازی، صفحه یک‌بار بازآوری می‌شود.",
            action: {
              label: "فعال‌سازی",
              onClick: () => waiting.postMessage("SKIP_WAITING"),
            },
            duration: 15000,
          });
        };
        notifyUpdate(reg.waiting);

        reg.addEventListener("updatefound", () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener("statechange", () => {
            if (nw.state === "installed" && navigator.serviceWorker.controller) {
              notifyUpdate(nw);
            }
          });
        });

        setSwStatus("active");
      } catch (err) {
        // آفلاینِ PWA قابلیت افزوده است؛ شکست ثبت، کار اصلی را نمی‌شکند
        setSwStatus("failed");
      }
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  // نشانگر وضعیت اتصال — صداقت UI (بند ۶ پذیرش فاز ۳/۴)
  useEffect(() => {
    const goOffline = () =>
      toast.warning("اتصال قطع شد", {
        description:
          "ثبت رویدادهای زمان‌سنجی و پیش‌نویس نمودارها در حافظه محلی ادامه دارد و پس از اتصال خودکار همگام می‌شود.",
        duration: 8000,
      });
    const goOnline = () =>
      toast.success("اتصال برقرار شد", {
        description: "صف‌های محلی (در صورت وجود) همگام می‌شوند.",
        duration: 5000,
      });
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  // نشانگر ریز برای پوسته (بدون متن مزاحم — فقط aria + title)
  if (swStatus === "active") {
    return (
      <span
        aria-hidden="true"
        title="حالت آفلاین برنامه (PWA) فعال است"
        className="inline-block size-1.5 rounded-full bg-emerald-500/80"
        data-testid="pwa-active"
      />
    );
  }
  return null;
}
