"use client";

/**
 * FieldHelp — راهنمای مشترک فیلدها (دستورالعمل بخش ۴).
 * ----------------------------------------------------------------
 * آیکون کوچک «اطلاعات» کنار عنوان فیلد که با کلیک/لمس/کیبورد باز می‌شود و
 * توضیح کامل همان فیلد را نمایش می‌دهد: معنی، ورودی مورد انتظار، قالب/واحد/محدوده،
 * مثال واقعی صنعتی، محل استفاده، اثر بر محاسبات و ضروری/اختیاری بودن.
 *
 * طراحی: RTL-خالص (popover در جهت شروع)، مستقل از hover (موبایل)،
 * دسترس‌پذیر (aria-label + aria-expanded از Radix Popover) و سبک.
 */

import * as React from "react";
import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface FieldHelpContent {
  /** این فیلد چه معنایی دارد؟ */
  meaning: string;
  /** کاربر چه چیزی وارد/انتخاب کند؟ */
  input: string;
  /** قالب/واحد/محدوده مجاز */
  format?: string;
  /** مثال واقعی از محیط کارخانه */
  example: string;
  /** این مقدار کجا استفاده می‌شود؟ */
  usage?: string;
  /** تغییر آن چه اثری دارد؟ */
  effect?: string;
  /** ضروری است یا اختیاری؟ */
  required?: boolean;
}

export function FieldHelp({
  content,
  label,
  className,
}: {
  content: FieldHelpContent;
  /** عنوان کوتاه در سربرگ پاپ‌اور (پیش‌فرض: فیلد) */
  label?: string;
  className?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger
        asChild
        aria-label={`راهنمای ${label ?? "این فیلد"}`}
        className={cn(
          "inline-flex size-5 shrink-0 cursor-help items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          className,
        )}
      >
        <span tabIndex={0} role="button" className="inline-flex items-center justify-center">
          <Info className="size-3.5" aria-hidden />
        </span>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        dir="rtl"
        className="w-80 max-w-[85vw] text-start text-xs leading-6"
      >
        <div className="space-y-1.5">
          {label ? <p className="mb-1 text-sm font-medium text-foreground">{label}</p> : null}
          <p>{content.meaning}</p>
          <p>{content.input}</p>
          {content.format ? (
            <p className="text-muted-foreground">قالب: {content.format}</p>
          ) : null}
          {content.example ? (
            <p className="rounded-md bg-muted p-2">{content.example}</p>
          ) : null}
          {content.usage ? <p className="text-muted-foreground">کاربرد: {content.usage}</p> : null}
          {content.effect ? <p className="text-muted-foreground">اثر: {content.effect}</p> : null}
          {content.required !== undefined ? (
            <p className={content.required ? "text-destructive" : "text-muted-foreground"}>
              {content.required ? "این فیلد الزامی است." : "این فیلد اختیاری است."}
            </p>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** عنوان فیلد + راهنما در یک سطر — الگوی مشترک همه فرم‌ها */
export function FieldLabelWithHelp({
  htmlFor,
  children,
  content,
  className,
}: {
  htmlFor?: string;
  children: React.ReactNode;
  content: FieldHelpContent;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <label htmlFor={htmlFor} className="font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
        {children}
      </label>
      <FieldHelp content={content} label={typeof children === "string" ? children : undefined} />
    </span>
  );
}
