"use client"

import * as React from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

/**
 * کلید روشن/خاموش — سازگار RTL (دستورالعمل ۲٫۱):
 * حرکت نشانگر با translate-x فیزیکی است؛ در RTL باید آینه شود.
 * `rtl:-scale-x-100` روی track کل مؤلفه را آینه‌ای می‌کند تا:
 *  - خاموش: نشانگر در ابتدای خط (سمت راست در RTL) بنشیند
 *  - روشن: نشانگر به انتهای خط (سمت چپ در RTL) حرکت کند
 * رنگ روشن (primary) و خاموش (input) در دو حالت کاملاً متمایز می‌ماند.
 */
function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer data-[state=checked]:bg-primary data-[state=unchecked]:bg-input focus-visible:border-ring focus-visible:ring-ring/50 dark:data-[state=unchecked]:bg-input/80 inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 rtl:-scale-x-100",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "bg-background dark:data-[state=unchecked]:bg-foreground dark:data-[state=checked]:bg-primary-foreground pointer-events-none block size-4 rounded-full ring-0 transition-transform data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
