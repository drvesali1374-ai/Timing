"use client";

/**
 * فیلد مقدار پارامتر در فرم‌ساز — ورودی مناسب بر اساس نوع داده
 * + نشان اجباری، راهنما، پیشنهاد، دامنه و هشدار نسخه تعریف.
 */
import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { FaDate } from "@/components/app/ui-bits";
import type { ParamValueWireDto } from "@/hooks/use-config";

export type DraftValue = string | boolean | string[];

const NUMERIC_TYPES = ["integer", "decimal", "percent", "ratio", "duration", "quantityWithUnit"];
const CLEAR_SENTINEL = "__none__";

export function isSameDraft(a: DraftValue | undefined, b: DraftValue | undefined, dataType: string): boolean {
  if (dataType === "boolean") return a === b;
  if (dataType === "multiSelect") return JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
  return String(a ?? "") === String(b ?? "");
}

export function toWireValue(dataType: string, v: DraftValue): number | string | boolean | null | string[] {
  if (dataType === "boolean") return v === true;
  if (dataType === "multiSelect") {
    const arr = Array.isArray(v) ? v : [];
    return arr.length > 0 ? arr : null;
  }
  const text = String(v ?? "").trim();
  if (text === "") return null;
  if (NUMERIC_TYPES.includes(dataType)) {
    const n = Number(text.replace(/,/g, "."));
    return Number.isFinite(n) ? n : text; // نامعتبر → سرور پیام فارسی می‌دهد
  }
  return text;
}

export function ValueField({
  item,
  value,
  onChange,
  requiredNow,
  min,
  max,
  helpFa,
  disabled,
}: {
  item: ParamValueWireDto;
  value: DraftValue;
  onChange: (v: DraftValue) => void;
  requiredNow: boolean;
  min?: number;
  max?: number;
  helpFa?: string;
  disabled?: boolean;
}) {
  const fieldId = `value-${item.stableKey}`;
  const isNumeric = NUMERIC_TYPES.includes(item.dataType);
  const versionStale = item.defVersion !== item.currentDefVersion;

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <Label htmlFor={fieldId} className="text-sm font-medium leading-snug">
          {item.nameFa}
          {requiredNow ? (
            <span className="ms-0.5 text-red-600 dark:text-red-400" title="اجباری">
              *
            </span>
          ) : null}
        </Label>
        {item.unit ? (
          <Badge variant="outline" className="font-mono text-[10px]" dir="ltr">
            {item.unit}
          </Badge>
        ) : null}
        {versionStale ? (
          <Badge
            variant="outline"
            className="border-amber-300 bg-amber-50 text-[10px] text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
            title="مقدار ثبت‌شده به نسخه قدیمی تعریف گره خورده — تعریف پارامتر تغییر کرده است"
          >
            تعریف نسخه {item.defVersion} (فعلی {item.currentDefVersion})
          </Badge>
        ) : null}
      </div>

      {renderInput(item, fieldId, value, onChange, min, max, disabled)}

      {helpFa ? <p className="text-xs text-muted-foreground">{helpFa}</p> : null}
      {isNumeric && (min !== undefined || max !== undefined) ? (
        <p className="text-xs text-muted-foreground">
          {min !== undefined ? `حداقل ${min}` : ""} {min !== undefined && max !== undefined ? "·" : ""}{" "}
          {max !== undefined ? `حداکثر ${max}` : ""}
        </p>
      ) : null}
      {item.suggestionNoteFa ? (
        <p className="flex items-start gap-1 text-xs text-amber-700 dark:text-amber-400">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {item.suggestionNoteFa}
        </p>
      ) : null}
      {item.updatedAt ? (
        <p className="text-[10px] text-muted-foreground">
          آخرین ثبت: <FaDate iso={item.updatedAt} withTime />
        </p>
      ) : null}
    </div>
  );
}

function renderInput(
  item: ParamValueWireDto,
  fieldId: string,
  value: DraftValue,
  onChange: (v: DraftValue) => void,
  min?: number,
  max?: number,
  disabled?: boolean,
) {
  const numeric = (
    <div className="relative">
      <Input
        id={fieldId}
        type="number"
        dir="ltr"
        className="font-mono pe-12"
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        {...(min !== undefined ? { min } : {})}
        {...(max !== undefined ? { max } : {})}
        aria-required={item.required || undefined}
      />
      {item.unit ? (
        <span className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 font-mono text-[10px] text-muted-foreground" dir="ltr">
          {item.unit}
        </span>
      ) : null}
    </div>
  );

  switch (item.dataType) {
    case "shortText":
      return <Input id={fieldId} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} disabled={disabled} />;
    case "longText":
      return (
        <Textarea id={fieldId} rows={3} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
      );
    case "integer":
    case "decimal":
    case "percent":
    case "ratio":
    case "duration":
    case "quantityWithUnit":
      return numeric;
    case "dateTime":
      return (
        <Input id={fieldId} type="date" dir="ltr" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
      );
    case "boolean":
      return (
        <div className="flex items-center gap-2 rounded-lg border p-3">
          <Switch id={fieldId} checked={value === true} onCheckedChange={(v) => onChange(v)} disabled={disabled} />
          <Label htmlFor={fieldId} className="cursor-pointer font-normal text-muted-foreground">
            {value === true ? "دارد / فعال" : "ندارد / غیرفعال"}
          </Label>
        </div>
      );
    case "singleSelect":
      return (
        <Select
          value={String(value ?? "") || CLEAR_SENTINEL}
          onValueChange={(v) => onChange(v === CLEAR_SENTINEL ? "" : v)}
          disabled={disabled}
        >
          <SelectTrigger id={fieldId} aria-label={item.nameFa}>
            <SelectValue placeholder="— بدون مقدار —" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={CLEAR_SENTINEL}>— بدون مقدار —</SelectItem>
            {(item.options ?? []).map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.labelFa}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "multiSelect": {
      const selected = Array.isArray(value) ? value : [];
      return (
        <div className="space-y-1.5 rounded-lg border p-3">
          {(item.options ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">گزینه‌ای تعریف نشده است.</p>
          ) : (
            (item.options ?? []).map((o) => (
              <label key={o.value} className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={selected.includes(o.value)}
                  onCheckedChange={(checked) =>
                    onChange(checked ? [...selected, o.value] : selected.filter((s) => s !== o.value))
                  }
                  disabled={disabled}
                  aria-label={o.labelFa}
                />
                {o.labelFa}
              </label>
            ))
          )}
        </div>
      );
    }
    case "entityRef":
      return (
        <Input id={fieldId} dir="ltr" className="font-mono" placeholder="شناسه موجودیت" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
      );
    default:
      return (
        <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
          نوع داده «{item.dataType}» در فرم مقدار دستی ندارد.
        </p>
      );
  }
}
