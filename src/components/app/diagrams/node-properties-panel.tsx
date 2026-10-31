"use client";

/**
 * پنل خواص گام — عنوان/شرح/زمان/مسافت/کمیت/مکان/مبدأ-مقصد/یادداشت/رنگ + ارجاع فعالیت (activityStableKey).
 * ارجاع فعالیت = انتخاب از فعالیت‌های پروژه — نمایش داده از رکورد مرجع (بدون کپی غیرقابل‌ردیابی — بند ۴).
 */

import { useMemo } from "react";
import { Link2, Link2Off } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { WORK_TYPE_LABELS_FA_UI } from "@/shared/contracts/config";
import { useEditorStore } from "./editor-store";
import {
  OPC_SYMBOLS,
  FPC_SYMBOLS,
  OPC_SYMBOL_LABELS_FA,
  FPC_SYMBOL_LABELS_FA,
  symbolLabelFa,
  type DiagramSymbol,
} from "@/shared/diagrams/types";

export interface NodePropertiesPanelProps {
  activities: Array<{ stableKey: string; name: string; workType: string }>;
}

const COLOR_KEYS: Array<{ key: string; labelFa: string; className: string }> = [
  { key: "none", labelFa: "بدون رنگ", className: "bg-transparent border-border" },
  { key: "rose", labelFa: "سرخابی", className: "bg-rose-200" },
  { key: "amber", labelFa: "کهربایی", className: "bg-amber-200" },
  { key: "teal", labelFa: "فیروزه‌ای", className: "bg-teal-200" },
  { key: "stone", labelFa: "خاکی", className: "bg-stone-300" },
];

export function NodePropertiesPanel({ activities }: NodePropertiesPanelProps) {
  const doc = useEditorStore((s) => s.doc);
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const updateNode = useEditorStore((s) => s.updateNode);
  const removeNode = useEditorStore((s) => s.removeNode);
  const duplicateNode = useEditorStore((s) => s.duplicateNode);

  const node = useMemo(() => doc?.nodes.find((n) => n.id === selectedNodeId) ?? null, [doc, selectedNodeId]);
  const activityKey = node?.activityStableKey ?? null;
  const linkedActivity = useMemo(
    () => (activityKey ? activities.find((a) => a.stableKey === activityKey) ?? null : null),
    [activityKey, activities],
  );

  if (!doc || !node) {
    return (
      <div className="p-4 text-sm leading-relaxed text-muted-foreground">
        گامی را روی بوم انتخاب کنید تا خواص آن (عنوان، زمان، مسافت، ارجاع فعالیت و…) اینجا ویرایش شود.
      </div>
    );
  }

  const symbols: ReadonlyArray<DiagramSymbol> = doc.kind === "opc" ? OPC_SYMBOLS : FPC_SYMBOLS;
  const labels = doc.kind === "opc" ? OPC_SYMBOL_LABELS_FA : FPC_SYMBOL_LABELS_FA;
  const num = (v: string): number | null => {
    const t = v.trim();
    if (!t) return null;
    const n = Number(t.replace(/,/g, "."));
    return Number.isFinite(n) ? n : null;
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Badge variant="outline">{symbolLabelFa(doc.kind, node.symbol)}</Badge>
          <span className="truncate text-sm font-semibold">{node.title}</span>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => duplicateNode(node.id)}>
            تکثیر
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs text-red-600" onClick={() => removeNode(node.id)}>
            حذف
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="np-symbol">نوع نماد</Label>
        <Select value={node.symbol} onValueChange={(v) => updateNode(node.id, { symbol: v as DiagramSymbol })}>
          <SelectTrigger id="np-symbol">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {symbols.map((s) => (
              <SelectItem key={s} value={s}>
                {labels[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="np-title">عنوان گام</Label>
        <Input id="np-title" value={node.title} maxLength={120} onChange={(e) => updateNode(node.id, { title: e.target.value })} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="np-step">شماره گام</Label>
          <Input
            id="np-step"
            type="number"
            min={1}
            value={node.stepNo ?? ""}
            onChange={(e) => updateNode(node.id, { stepNo: e.target.value === "" ? null : Number(e.target.value) })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="np-time">زمان (ثانیه)</Label>
          <Input
            id="np-time"
            type="number"
            min={0}
            step="0.01"
            placeholder="مثلاً 12.5"
            value={node.timeSec ?? ""}
            onChange={(e) => updateNode(node.id, { timeSec: num(e.target.value) })}
          />
        </div>
      </div>

      {doc.kind === "fpc" ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="np-dist">مسافت (متر)</Label>
              <Input
                id="np-dist"
                type="number"
                min={0}
                step="0.1"
                placeholder="مثلاً 15"
                value={node.distanceM ?? ""}
                onChange={(e) => updateNode(node.id, { distanceM: num(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="np-location">مکان</Label>
              <Input
                id="np-location"
                maxLength={120}
                placeholder="مثلاً سالن مونتاژ"
                value={node.location ?? ""}
                onChange={(e) => updateNode(node.id, { location: e.target.value || null })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="np-origin">مبدأ</Label>
              <Input
                id="np-origin"
                maxLength={120}
                placeholder="مثلاً انبار مواد"
                value={node.origin ?? ""}
                onChange={(e) => updateNode(node.id, { origin: e.target.value || null })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="np-dest">مقصد</Label>
              <Input
                id="np-dest"
                maxLength={120}
                placeholder="مثلاً ایستگاه ۳"
                value={node.destination ?? ""}
                onChange={(e) => updateNode(node.id, { destination: e.target.value || null })}
              />
            </div>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="np-qty">کمیت/تعداد</Label>
            <Input
              id="np-qty"
              type="number"
              min={0}
              step="0.01"
              value={node.quantity ?? ""}
              onChange={(e) => updateNode(node.id, { quantity: num(e.target.value) })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="np-src">جزء/منبع ورودی</Label>
            <Input
              id="np-src"
              maxLength={120}
              placeholder="مثلاً پیچ M6"
              value={node.sourceRef ?? ""}
              onChange={(e) => updateNode(node.id, { sourceRef: e.target.value || null })}
            />
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="np-desc">شرح</Label>
        <Textarea
          id="np-desc"
          rows={2}
          maxLength={2000}
          value={node.description ?? ""}
          onChange={(e) => updateNode(node.id, { description: e.target.value || undefined })}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="np-note">یادداشت (مثلاً علت تأخیر)</Label>
        <Textarea
          id="np-note"
          rows={2}
          maxLength={1000}
          value={node.note ?? ""}
          onChange={(e) => updateNode(node.id, { note: e.target.value || null })}
        />
      </div>

      <div className="space-y-1.5">
        <Label>رنگ/برچسب</Label>
        <div className="flex flex-wrap gap-1.5">
          {COLOR_KEYS.map((c) => (
            <button
              key={c.key}
              type="button"
              title={c.labelFa}
              aria-label={`رنگ ${c.labelFa}`}
              className={`size-6 rounded-md border-2 ${c.className} ${node.colorKey === c.key ? "ring-2 ring-primary ring-offset-1" : ""}`}
              onClick={() => updateNode(node.id, { colorKey: c.key === "none" ? null : c.key })}
            />
          ))}
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
        <Label className="flex items-center gap-1.5">
          <Link2 className="size-3.5" aria-hidden /> ارجاع به فعالیت پروژه (B5)
        </Label>
        <Select
          value={node.activityStableKey ?? "none"}
          onValueChange={(v) => updateNode(node.id, { activityStableKey: v === "none" ? null : v })}
        >
          <SelectTrigger aria-label="انتخاب فعالیت مرجع">
            <SelectValue placeholder="بدون ارجاع" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Link2Off className="size-3.5" aria-hidden /> بدون ارجاع
              </span>
            </SelectItem>
            {activities.map((a) => (
              <SelectItem key={a.stableKey} value={a.stableKey}>
                {a.name} — {WORK_TYPE_LABELS_FA_UI[a.workType as keyof typeof WORK_TYPE_LABELS_FA_UI] ?? a.workType}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {linkedActivity ? (
          <p className="rounded-md border border-dashed bg-muted/40 p-2 text-[11px] leading-relaxed text-muted-foreground">
            نمایش از رکورد فعالیت «{linkedActivity.name}» ({linkedActivity.stableKey}) — نوع کار:{" "}
            {WORK_TYPE_LABELS_FA_UI[linkedActivity.workType as keyof typeof WORK_TYPE_LABELS_FA_UI] ?? linkedActivity.workType}.
            داده بین نمودار و فعالیت کپی نمی‌شود؛ این گره فقط ارجاع را نگه می‌دارد.
          </p>
        ) : node.activityStableKey ? (
          <p className="rounded-md border border-red-300 bg-red-50 p-2 text-[11px] text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
            مرجع فعالیت «{node.activityStableKey}» در فعالیت‌های پروژه موجود نیست — اعتبارسنجی خطا می‌دهد.
          </p>
        ) : null}
      </div>
    </div>
  );
}
