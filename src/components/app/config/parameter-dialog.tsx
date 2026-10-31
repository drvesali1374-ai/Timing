"use client";

/**
 * دیالوگ ایجاد/ویرایش پارامتر — فیلدهای پویا بر اساس نوع داده.
 * ویرایش ساختاری → defVersion پارامتر بالا می‌رود (سرور)؛ مقدارهای ثبت‌شده به
 * نسخه قبلی گره می‌خورند. ارسال فقط فیلدهای تغییرکرده برای جلوگیری از نسخه‌بندی بی‌مورد.
 */
import { useState } from "react";
import { Info, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  ANALYSIS_ROLE_LABELS_FA,
  AVAILABLE_UNITS_UI,
  DATA_TYPE_LABELS_FA,
  type ConfigAnalysisRole,
  type ConfigParameterDataType,
  type ConfigParameterDto,
  type CurrentConfigDto,
} from "@/shared/contracts/config";
import { useApplyConfigOps } from "@/hooks/use-config";
import { Spinner } from "@/components/app/ui-bits";

const STABLE_KEY_RE = /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z][a-zA-Z0-9]*)*$/;
const NUMERIC_TYPES: ConfigParameterDataType[] = ["integer", "decimal", "percent", "ratio", "duration", "quantityWithUnit"];
const SELECT_TYPES: ConfigParameterDataType[] = ["singleSelect", "multiSelect"];
const TEXT_TYPES: ConfigParameterDataType[] = ["shortText", "longText", "dateTime", "entityRef"];

const ROUNDING_LABELS_FA: Record<string, string> = {
  floor: "گرد به پایین",
  ceil: "گرد به بالا",
  round: "گرد کردن",
  none: "بدون گردکردن",
};

const DISPLAY_CONTEXT_ITEMS: Array<{ key: "form" | "table" | "chart" | "report"; label: string }> = [
  { key: "form", label: "فرم" },
  { key: "table", label: "جدول" },
  { key: "chart", label: "نمودار" },
  { key: "report", label: "گزارش" },
];

interface ParamFormState {
  stableKey: string;
  nameFa: string;
  description: string;
  helpFa: string;
  code: string;
  dataType: ConfigParameterDataType;
  analysisRole: ConfigAnalysisRole;
  required: boolean;
  defaultValueText: string;
  defaultValueBool: boolean;
  defaultValueSelect: string;
  minText: string;
  maxText: string;
  precisionText: string;
  rounding: string;
  unit: string;
  displayContexts: Array<"form" | "table" | "chart" | "report">;
  options: Array<{ value: string; labelFa: string }>;
  suggestionNoteFa: string;
  visibilityCondition: string;
  requiredCondition: string;
  computedFormulaKey: string;
  reason: string;
}

function initState(param?: ConfigParameterDto): ParamFormState {
  if (!param) {
    return {
      stableKey: "",
      nameFa: "",
      description: "",
      helpFa: "",
      code: "",
      dataType: "decimal",
      analysisRole: "input",
      required: false,
      defaultValueText: "",
      defaultValueBool: false,
      defaultValueSelect: "",
      minText: "",
      maxText: "",
      precisionText: "",
      rounding: "",
      unit: "",
      displayContexts: ["form"],
      options: [{ value: "", labelFa: "" }],
      suggestionNoteFa: "",
      visibilityCondition: "",
      requiredCondition: "",
      computedFormulaKey: "",
      reason: "",
    };
  }
  const dv = param.defaultValue;
  return {
    stableKey: param.stableKey,
    nameFa: param.nameFa,
    description: param.description ?? "",
    helpFa: param.helpFa ?? "",
    code: param.code ?? "",
    dataType: param.dataType,
    analysisRole: param.analysisRole,
    required: !!param.required,
    defaultValueText:
      typeof dv === "number" || (typeof dv === "string" && param.dataType !== "singleSelect") ? String(dv ?? "") : "",
    defaultValueBool: dv === true,
    defaultValueSelect: param.dataType === "singleSelect" && typeof dv === "string" ? dv : "",
    minText: param.min !== undefined ? String(param.min) : "",
    maxText: param.max !== undefined ? String(param.max) : "",
    precisionText: param.precision !== undefined ? String(param.precision) : "",
    rounding: param.rounding ?? "",
    unit: param.unit ?? "",
    displayContexts: param.displayContexts?.length ? [...param.displayContexts] : ["form"],
    options: param.options?.length ? param.options.map((o) => ({ ...o })) : [{ value: "", labelFa: "" }],
    suggestionNoteFa: param.suggestionNoteFa ?? "",
    visibilityCondition: param.visibilityCondition ?? "",
    requiredCondition: param.requiredCondition ?? "",
    computedFormulaKey: param.computedFormulaKey ?? "",
    reason: "",
  };
}

function parseNum(text: string): number | undefined {
  const t = text.trim();
  if (t === "") return undefined;
  const n = Number(t.replace(/,/g, "."));
  return Number.isFinite(n) ? n : undefined;
}

function cleanOptions(options: Array<{ value: string; labelFa: string }>): Array<{ value: string; labelFa: string }> {
  return options.map((o) => ({ value: o.value.trim(), labelFa: o.labelFa.trim() })).filter((o) => o.value && o.labelFa);
}

export function ParameterDialog({
  projectId,
  config,
  familyKey,
  familyName,
  param,
  open,
  onOpenChange,
}: {
  projectId: string;
  config: CurrentConfigDto;
  familyKey: string;
  familyName: string;
  param?: ConfigParameterDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const apply = useApplyConfigOps(projectId);
  const [form, setForm] = useState<ParamFormState>(() => initState(param));
  const isEdit = !!param;

  const set = <K extends keyof ParamFormState>(key: K, value: ParamFormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const isNumeric = NUMERIC_TYPES.includes(form.dataType);
  const isSelect = SELECT_TYPES.includes(form.dataType);
  const isComputed = form.dataType === "computed";

  const activeFormulas = config.snapshot.formulas.filter((f) => f.status !== "deprecated");
  const optionsClean = cleanOptions(form.options);
  const optionsValid = !isSelect || optionsClean.length > 0;
  const computedValid = !isComputed || !!form.computedFormulaKey;
  const keyValid = isEdit || STABLE_KEY_RE.test(form.stableKey);
  const nameValid = form.nameFa.trim().length > 0;
  const contextsValid = form.displayContexts.length > 0;
  const canSubmit = keyValid && nameValid && optionsValid && computedValid && contextsValid;

  // ── ساخت payload ایجاد ──────────────────────────────────
  const buildCreate = (): Record<string, unknown> => {
    const p: Record<string, unknown> = {
      stableKey: form.stableKey.trim(),
      nameFa: form.nameFa.trim(),
      dataType: form.dataType,
      analysisRole: form.analysisRole,
      displayContexts: form.displayContexts.length ? form.displayContexts : ["form"],
    };
    if (form.required) p.required = true;
    if (form.description.trim()) p.description = form.description.trim();
    if (form.helpFa.trim()) p.helpFa = form.helpFa.trim();
    if (form.code.trim()) p.code = form.code.trim();
    if (form.suggestionNoteFa.trim()) p.suggestionNoteFa = form.suggestionNoteFa.trim();
    if (isNumeric) {
      const min = parseNum(form.minText);
      const max = parseNum(form.maxText);
      const precision = parseNum(form.precisionText);
      const def = parseNum(form.defaultValueText);
      if (min !== undefined) p.min = min;
      if (max !== undefined) p.max = max;
      if (precision !== undefined && Number.isInteger(precision)) p.precision = Math.min(10, Math.max(0, precision));
      if (form.rounding) p.rounding = form.rounding;
      if (form.unit) p.unit = form.unit;
      if (def !== undefined) p.defaultValue = def;
    }
    if (isSelect && optionsClean.length > 0) {
      p.options = optionsClean;
      if (form.dataType === "singleSelect" && form.defaultValueSelect) p.defaultValue = form.defaultValueSelect;
    }
    if (form.dataType === "boolean") p.defaultValue = form.defaultValueBool;
    if (TEXT_TYPES.includes(form.dataType) && form.defaultValueText.trim()) p.defaultValue = form.defaultValueText.trim();
    if (form.visibilityCondition.trim()) p.visibilityCondition = form.visibilityCondition.trim();
    if (form.requiredCondition.trim()) p.requiredCondition = form.requiredCondition.trim();
    if (isComputed && form.computedFormulaKey) p.computedFormulaKey = form.computedFormulaKey;
    return p;
  };

  // ── ساخت patch ویرایش (فقط تغییرات) ─────────────────────
  const buildPatch = (): Record<string, unknown> => {
    const o = param as ConfigParameterDto;
    const patch: Record<string, unknown> = {};
    if (form.nameFa.trim() !== o.nameFa) patch.nameFa = form.nameFa.trim();
    const texts: Array<[string, string]> = [
      ["description", form.description.trim()],
      ["helpFa", form.helpFa.trim()],
      ["code", form.code.trim()],
      ["suggestionNoteFa", form.suggestionNoteFa.trim()],
    ];
    for (const [key, val] of texts) {
      if (val !== (o[key as keyof ConfigParameterDto] ?? "")) patch[key] = val;
    }
    if (form.dataType !== o.dataType) patch.dataType = form.dataType;
    if (form.analysisRole !== o.analysisRole) patch.analysisRole = form.analysisRole;
    if (form.required !== !!o.required) patch.required = form.required;
    const ctxSorted = [...form.displayContexts].sort().join(",");
    const oCtx = [...(o.displayContexts ?? [])].sort().join(",");
    if (ctxSorted !== oCtx) patch.displayContexts = form.displayContexts.length ? form.displayContexts : ["form"];
    if (isNumeric) {
      const min = parseNum(form.minText);
      if (min !== undefined && min !== o.min) patch.min = min;
      const max = parseNum(form.maxText);
      if (max !== undefined && max !== o.max) patch.max = max;
      const precision = parseNum(form.precisionText);
      if (precision !== undefined && Number.isInteger(precision) && precision !== o.precision) {
        patch.precision = Math.min(10, Math.max(0, precision));
      }
      const rounding = form.rounding || undefined;
      if ((rounding ?? "round") !== (o.rounding ?? "round")) {
        if (rounding) patch.rounding = rounding;
      }
      if (form.unit !== (o.unit ?? "")) patch.unit = form.unit; // رشته خالی = پاک‌کردن واحد
      const def = parseNum(form.defaultValueText);
      const defNorm = def ?? null;
      if (defNorm !== (o.defaultValue ?? null)) {
        patch.defaultValue = def === undefined ? null : def;
      }
    }
    if (isSelect) {
      if (JSON.stringify(optionsClean) !== JSON.stringify(o.options ?? [])) patch.options = optionsClean;
      if (form.dataType === "singleSelect" && form.defaultValueSelect !== (o.defaultValue ?? "")) {
        patch.defaultValue = form.defaultValueSelect || null;
      }
    }
    if (form.dataType === "boolean" && form.defaultValueBool !== o.defaultValue) patch.defaultValue = form.defaultValueBool;
    if (TEXT_TYPES.includes(form.dataType)) {
      const t = form.defaultValueText.trim() || null;
      if (t !== (o.defaultValue ?? null)) patch.defaultValue = t;
    }
    const vis = form.visibilityCondition.trim();
    if (vis !== (o.visibilityCondition ?? "")) patch.visibilityCondition = vis; // خالی = پاک‌کردن
    const req = form.requiredCondition.trim();
    if (req !== (o.requiredCondition ?? "")) patch.requiredCondition = req;
    if (isComputed && form.computedFormulaKey !== (o.computedFormulaKey ?? "")) {
      patch.computedFormulaKey = form.computedFormulaKey;
    }
    return patch;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    const trimmedName = form.nameFa.trim();
    const autoReason = isEdit
      ? `ویرایش پارامتر «${param.stableKey}»`
      : `افزودن پارامتر «${form.stableKey.trim()}» به خانواده «${familyName}»`;
    const operation = isEdit
      ? { op: "updateParameter", parameterKey: param.stableKey, patch: buildPatch() }
      : { op: "addParameter", familyKey, parameter: buildCreate() };
    apply.mutate(
      { reason: form.reason.trim() || autoReason, operations: [operation] },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  const id = (field: string) => `param-${form.stableKey || "new"}-${field}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `ویرایش پارامتر «${param.nameFa}»` : `پارامتر جدید در خانواده «${familyName}»`}
          </DialogTitle>
          <DialogDescription>
            تغییر فیلدهای ساختاری (نوع داده، دامنه، واحد، گزینه‌ها، شرط‌ها) نسخه تعریف پارامتر را بالا می‌برد —
            مقدارهای ثبت‌شده به نسخه قبلی گره می‌خورند و باید بازنگری شوند.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <ScrollArea className="max-h-[62vh] pr-3">
            <div className="grid gap-4 py-2 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={id("key")}>شناسه فنی (stableKey) *</Label>
                <Input
                  id={id("key")}
                  dir="ltr"
                  className="font-mono"
                  placeholder="oven.cycleTime"
                  value={form.stableKey}
                  onChange={(e) => set("stableKey", e.target.value)}
                  disabled={isEdit}
                  required={!isEdit}
                  aria-invalid={!keyValid}
                />
                {!keyValid ? (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    با حرف کوچک لاتین شروع شود؛ بخش‌ها با نقطه (مثل oven.cycleTime)
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">ناورداست و بعداً تغییر نمی‌کند</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={id("name")}>نام فارسی *</Label>
                <Input id={id("name")} placeholder="مثال: زمان چرخه تنور" value={form.nameFa} onChange={(e) => set("nameFa", e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>نوع داده *</Label>
                <Select value={form.dataType} onValueChange={(v) => set("dataType", v as ConfigParameterDataType)}>
                  <SelectTrigger aria-label="نوع داده">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DATA_TYPE_LABELS_FA).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>نقش تحلیلی *</Label>
                <Select value={form.analysisRole} onValueChange={(v) => set("analysisRole", v as ConfigAnalysisRole)}>
                  <SelectTrigger aria-label="نقش تحلیلی">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ANALYSIS_ROLE_LABELS_FA).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label htmlFor={id("required")} className="cursor-pointer">
                    اجباری
                  </Label>
                  <p className="text-xs text-muted-foreground">در فرم مقدارها الزامی می‌شود</p>
                </div>
                <Switch id={id("required")} checked={form.required} onCheckedChange={(v) => set("required", v)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={id("code")}>کد / نماد</Label>
                <Input id={id("code")} dir="ltr" className="font-mono" placeholder="CT" value={form.code} onChange={(e) => set("code", e.target.value)} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor={id("desc")}>توضیح (فنی)</Label>
                <Textarea id={id("desc")} rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor={id("help")}>راهنمای کاربر (helpFa)</Label>
                <Textarea
                  id={id("help")}
                  rows={2}
                  placeholder="متن کوتاهی که زیر فیلد در فرم نمایش داده می‌شود"
                  value={form.helpFa}
                  onChange={(e) => set("helpFa", e.target.value)}
                />
              </div>

              <Separator className="sm:col-span-2" />
              <p className="text-xs font-medium text-muted-foreground sm:col-span-2">مقدار و دامنه</p>

              {isComputed ? (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>فرمول محاسبه *</Label>
                  <Select value={form.computedFormulaKey} onValueChange={(v) => set("computedFormulaKey", v)}>
                    <SelectTrigger aria-label="فرمول محاسبه">
                      <SelectValue placeholder="یک فرمول فعال انتخاب کنید" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeFormulas.map((f) => (
                        <SelectItem key={f.key} value={f.key}>
                          {f.nameFa} <span className="font-mono text-[10px] text-muted-foreground" dir="ltr">({f.key})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!computedValid ? <p className="text-xs text-red-600 dark:text-red-400">پارامتر محاسباتی باید به فرمول ارجاع دهد.</p> : null}
                  <p className="text-xs text-muted-foreground">مقدار این پارامتر از تب «نتایج محاسبه» تولید می‌شود — مقدار دستی ندارد.</p>
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor={id("default")}>مقدار پیش‌فرض</Label>
                    {isSelect ? (
                      form.dataType === "singleSelect" ? (
                        <Select value={form.defaultValueSelect || undefined} onValueChange={(v) => set("defaultValueSelect", v)}>
                          <SelectTrigger id={id("default")} aria-label="مقدار پیش‌فرض">
                            <SelectValue placeholder="بدون پیش‌فرض" />
                          </SelectTrigger>
                          <SelectContent>
                            {optionsClean.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.labelFa}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                          برای انتخاب چندگانه مقدار پیش‌فرض تعریف نمی‌شود.
                        </p>
                      )
                    ) : form.dataType === "boolean" ? (
                      <div className="flex items-center gap-2 rounded-lg border p-3">
                        <Switch id={id("default")} checked={form.defaultValueBool} onCheckedChange={(v) => set("defaultValueBool", v)} />
                        <Label htmlFor={id("default")} className="cursor-pointer font-normal">
                          {form.defaultValueBool ? "پیش‌فرض: روشن" : "پیش‌فرض: خاموش"}
                        </Label>
                      </div>
                    ) : (
                      <Input
                        id={id("default")}
                        type={isNumeric ? "number" : form.dataType === "dateTime" ? "date" : "text"}
                        dir={isNumeric || form.dataType === "dateTime" ? "ltr" : undefined}
                        placeholder={isNumeric ? "12.5" : "مقدار اولیه"}
                        value={form.defaultValueText}
                        onChange={(e) => set("defaultValueText", e.target.value)}
                      />
                    )}
                  </div>
                  {isNumeric ? (
                    <div className="space-y-1.5">
                      <Label htmlFor={id("unit")}>واحد</Label>
                      <Select value={form.unit || undefined} onValueChange={(v) => set("unit", v)}>
                        <SelectTrigger id={id("unit")} aria-label="واحد">
                          <SelectValue placeholder="بدون واحد" />
                        </SelectTrigger>
                        <SelectContent>
                          {AVAILABLE_UNITS_UI.map((u) => (
                            <SelectItem key={u.symbol} value={u.symbol}>
                              {u.nameFa} <span className="font-mono text-[10px] text-muted-foreground" dir="ltr">({u.symbol})</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                  {isNumeric ? (
                    <>
                      <div className="space-y-1.5">
                        <Label htmlFor={id("min")}>حداقل</Label>
                        <Input id={id("min")} type="number" dir="ltr" value={form.minText} onChange={(e) => set("minText", e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={id("max")}>حداکثر</Label>
                        <Input id={id("max")} type="number" dir="ltr" value={form.maxText} onChange={(e) => set("maxText", e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={id("precision")}>دقت اعشار (۰–۱۰)</Label>
                        <Input id={id("precision")} type="number" min={0} max={10} dir="ltr" value={form.precisionText} onChange={(e) => set("precisionText", e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>گردکردن</Label>
                        <Select value={form.rounding || undefined} onValueChange={(v) => set("rounding", v)}>
                          <SelectTrigger aria-label="گردکردن">
                            <SelectValue placeholder="گرد کردن (پیش‌فرض)" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(ROUNDING_LABELS_FA).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  ) : null}
                </>
              )}

              {isSelect ? (
                <>
                  <Separator className="sm:col-span-2" />
                  <div className="space-y-2 sm:col-span-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground">گزینه‌ها (حداقل یکی) *</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={() => set("options", [...form.options, { value: "", labelFa: "" }])}
                      >
                        <Plus className="size-3.5" aria-hidden /> افزودن گزینه
                      </Button>
                    </div>
                    {!optionsValid ? (
                      <p className="text-xs text-red-600 dark:text-red-400">نوع انتخابی بدون فهرست گزینه‌ها قابل ثبت نیست.</p>
                    ) : null}
                    <div className="space-y-2">
                      {form.options.map((opt, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <Input
                            dir="ltr"
                            className="font-mono"
                            placeholder="مقدار (value)"
                            value={opt.value}
                            aria-label={`مقدار گزینه ${i + 1}`}
                            onChange={(e) =>
                              set("options", form.options.map((o, j) => (j === i ? { ...o, value: e.target.value } : o)))
                            }
                          />
                          <Input
                            placeholder="برچسب فارسی"
                            value={opt.labelFa}
                            aria-label={`برچسب گزینه ${i + 1}`}
                            onChange={(e) =>
                              set("options", form.options.map((o, j) => (j === i ? { ...o, labelFa: e.target.value } : o)))
                            }
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-11 shrink-0 text-red-600 dark:text-red-400"
                            onClick={() => set("options", form.options.filter((_, j) => j !== i))}
                            disabled={form.options.length <= 1}
                            aria-label={`حذف گزینه ${i + 1}`}
                          >
                            <Trash2 className="size-4" aria-hidden />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}

              <Separator className="sm:col-span-2" />
              <div className="space-y-2 sm:col-span-2">
                <p className="text-xs font-medium text-muted-foreground">محل‌های نمایش *</p>
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  {DISPLAY_CONTEXT_ITEMS.map((ctx) => (
                    <label key={ctx.key} className="flex cursor-pointer items-center gap-2 text-sm">
                      <Checkbox
                        checked={form.displayContexts.includes(ctx.key)}
                        onCheckedChange={(checked) =>
                          set(
                            "displayContexts",
                            checked
                              ? [...form.displayContexts, ctx.key]
                              : form.displayContexts.filter((c) => c !== ctx.key),
                          )
                        }
                        aria-label={`نمایش در ${ctx.label}`}
                      />
                      {ctx.label}
                    </label>
                  ))}
                </div>
                {!contextsValid ? <p className="text-xs text-red-600 dark:text-red-400">حداقل یک محل نمایش لازم است.</p> : null}
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor={id("suggestion")}>یادداشت پیشنهاد (suggestionNote)</Label>
                <Input
                  id={id("suggestion")}
                  placeholder="مثال: طبق مطالعه مشابه ۱۴۰۲، مقدار ۰٫۸ پیشنهاد می‌شود"
                  value={form.suggestionNoteFa}
                  onChange={(e) => set("suggestionNoteFa", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={id("vis")}>شرط نمایش (DSL)</Label>
                <Textarea
                  id={id("vis")}
                  dir="ltr"
                  className="font-mono text-xs"
                  rows={2}
                  placeholder="rating.enabled == true"
                  value={form.visibilityCondition}
                  onChange={(e) => set("visibilityCondition", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">عبارت DSL مثل: rating.enabled == true — خالی = همیشه</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={id("req")}>شرط اجباری (DSL)</Label>
                <Textarea
                  id={id("req")}
                  dir="ltr"
                  className="font-mono text-xs"
                  rows={2}
                  placeholder="study.severity >= 2"
                  value={form.requiredCondition}
                  onChange={(e) => set("requiredCondition", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">اگر درست ارزیابی شود فیلد اجباری می‌شود</p>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor={id("reason")}>دلیل تغییر (اختیاری)</Label>
                <Input
                  id={id("reason")}
                  placeholder={`خالی = دلیل خودکار (${isEdit ? "ویرایش" : "افزودن"} پارامتر)`}
                  value={form.reason}
                  onChange={(e) => set("reason", e.target.value)}
                />
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="mt-4 gap-2">
            <p className="me-auto flex items-center gap-1 text-xs text-muted-foreground">
              <Info className="size-3.5" aria-hidden /> اعتبارسنجی نهایی در سرور انجام می‌شود
            </p>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              انصراف
            </Button>
            <Button type="submit" disabled={apply.isPending || !canSubmit}>
              {apply.isPending && <Spinner />} {isEdit ? "ذخیره تغییرات" : "ایجاد پارامتر"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
