"use client";

/**
 * راهنمای فارسی قابل‌دسترسی برای عناوین بخش‌ها و فیلدهای نسبتاً پیچیده.
 * با Popover (کلیک/لمس/Tab+Enter) باز می‌شود — نه فقط hover؛
 * کاربران لمسی و صفحه‌کلید نیز به توضیح دسترسی دارند (بند ۵.۳ مأموریت UX).
 */

import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface HintProps {
  /** توضیح فارسی — این بخش چیست؟ کاربر چه کاری باید انجام دهد؟ */
  text: string;
  /** عنوان اختیاری راهنما (پیش‌فرض: «راهنما») */
  title?: string;
  className?: string;
  /** اندازه آیکون */
  size?: "sm" | "md";
}

/** آیکون اطلاعات کوچک کنار عنوان بخش/فیلد — با کلیک باز می‌شود */
export function Hint({ text, title = "راهنما", className, size = "md" }: HintProps) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label={`${title}: ${text.slice(0, 60)}…`}
        className={cn(
          "inline-flex shrink-0 cursor-help items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:bg-muted hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          size === "sm" ? "size-4" : "size-5",
          className,
        )}
      >
        <Info className={size === "sm" ? "size-3" : "size-3.5"} aria-hidden />
      </PopoverTrigger>
      <PopoverContent side="bottom" align="start" className="w-72 text-start text-xs leading-relaxed">
        <p className="mb-1 text-[11px] font-bold text-primary">{title}</p>
        <p className="text-foreground/90">{text}</p>
      </PopoverContent>
    </Popover>
  );
}

/** عنوان بخش + راهنما — جایگزین الگوی تکرارشونده «CardTitle + متن طولانی» */
export function HintedHeading({
  children,
  hint,
  title,
  className,
}: {
  children: React.ReactNode;
  hint: string;
  title?: string;
  className?: string;
}) {
  return (
    <span className={cn("flex min-w-0 items-center gap-1.5", className)}>
      {children}
      <Hint text={hint} title={title} size="sm" />
    </span>
  );
}
