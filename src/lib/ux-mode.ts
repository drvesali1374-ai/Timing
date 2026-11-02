"use client";

/**
 * حالت ساده/پیشرفته رابط کاربری (دستورالعمل ۶٫۳ — ADR-017).
 * ----------------------------------------------------------------
 * حالت ساده = تجربه پیش‌فرض برای کاربر تازه‌کار (حداقل انتخاب‌ها، پیش‌فرض‌های
 * آماده، فرم‌های کوتاه). حالت پیشرفته = دسترسی متخصص به گروه اطلاعات/فیلدها/
 * فرمول‌نویسی/تنظیمات تخصصی. انتخاب کاربر در localStorage مرورگرش ذخیره می‌شود.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UxModeState {
  advanced: boolean;
  setAdvanced: (v: boolean) => void;
  toggle: () => void;
}

export const useUxMode = create<UxModeState>()(
  persist(
    (set) => ({
      advanced: false,
      setAdvanced: (v) => set({ advanced: v }),
      toggle: () => set((s) => ({ advanced: !s.advanced })),
    }),
    { name: "tazmin-ux-mode" },
  ),
);
