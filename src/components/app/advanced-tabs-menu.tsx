"use client";

/**
 * منوی «جزئیات پیشرفته» برای کارگاه‌های چندتبی — بند ۱۰ مأموریت UX:
 * تب‌های اصلی دیده می‌شوند؛ تب‌های کم‌کاربرد/تخصصی در منویی منظم در دسترس می‌مانند
 * (هیچ قابلیتی حذف یا غیرقابل دسترس نمی‌شود).
 */

import { useState } from "react";
import { Check, ChevronDown, Layers } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface AdvancedTabDef {
  key: string;
  labelFa: string;
  icon: React.ElementType;
}

export function AdvancedTabsMenu({
  tabs,
  activeKey,
  onSelect,
  label = "جزئیات پیشرفته",
}: {
  tabs: readonly AdvancedTabDef[];
  /** کلید تب فعال (اگر از همین منو انتخاب شده باشد) */
  activeKey: string | null;
  onSelect: (key: string) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const activeTab = tabs.find((t) => t.key === activeKey) ?? null;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          role="tab"
          aria-selected={!!activeTab}
          aria-haspopup="menu"
          className={cn(
            "inline-flex h-[calc(100%-1px)] items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-xs font-medium whitespace-nowrap transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
            activeTab ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {activeTab ? <activeTab.icon className="size-3.5" aria-hidden /> : <Layers className="size-3.5" aria-hidden />}
          {activeTab ? activeTab.labelFa : label}
          <ChevronDown className="size-3 opacity-60" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {tabs.map((t) => (
          <DropdownMenuItem
            key={t.key}
            onClick={() => {
              onSelect(t.key);
              setOpen(false);
            }}
            className="gap-2"
          >
            <t.icon className="size-4" aria-hidden />
            {t.labelFa}
            {t.key === activeKey ? <Check className="ms-auto size-3.5" aria-hidden /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
