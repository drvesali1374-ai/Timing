"use client";

/**
 * دیالوگ ایجاد/ویرایش فرمول سفارشی — ویرایشگر عبارت DSL با اعتبارسنجی زنده
 * (debounce ~۶۰۰ms)، راهنمای توابع/نمادها و پنل آزمون با داده نمونه.
 * فرمول سیستمی فقط در نام/توضیح قابل ویرایش است (عبارت → سرور ۴۰۳ می‌دهد).
 */
import { useEffect, useMemo, useState } from "react";
import { BookOpen, ChevronDown, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  AVAILABLE_UNITS_UI,
  FORMULA_STATUS_LABELS_FA,
  SCOPE_LEVEL_LABELS_FA,
  type ConfigFormulaDto,
  type ConfigFormulaScopeLevel,
  type ConfigOperationInput,
  type FormulaValidationDto,
FORMULA_KEY_RE } from "@/shared/contracts/config";
import { cn } from "@/lib/utils";
import { faCount, useApplyConfigOps, useFunctionCatalog, useValidateFormula } from "@/hooks/use-config";
import { Spinner } from "@/components/app/ui-bits";
import { ErrorList, MonoKey } from "./config-bits";
import { FormulaTestPanel } from "./formula-test-panel";


interface FormulaFormState {
  key: string;
  nameFa: string;
  descriptionFa: string;
  scopeLevel: ConfigFormulaScopeLevel;
  status: "draft" | "active" | "deprecated";
  outputUnit: string;
  expr: string;
  reason: string;
}

function initState(formula?: ConfigFormulaDto): FormulaFormState {
  return {
    key: formula?.key ?? "",
    nameFa: formula?.nameFa ?? "",
    descriptionFa: formula?.descriptionFa ?? "",
    scopeLevel: formula?.scopeLevel ?? "project",
    status: formula?.status ?? "active",
    outputUnit: formula?.outputUnit ?? "",
    expr: formula?.expr ?? "",
    reason: "",
  };
}

export function FormulaDialog({
  projectId,
  formula,
  open,
  onOpenChange,
}: {
  projectId: string;
  formula?: ConfigFormulaDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const apply = useApplyConfigOps(projectId);
  const [form, setForm] = useState<FormulaFormState>(() => initState(formula));
  const isEdit = !!formula;
  const isSystem = formula?.origin === "system";

  const set = <K extends keyof FormulaFormState>(key: K, value: FormulaFormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // ── اعتبارسنجی زنده (debounce) ─────────────────────────
  const { mutate: validateMutate, data: validation, isPending: validating, reset: resetValidation } = useValidateFormula(projectId);
  const trimmedExpr = form.expr.trim();

  useEffect(() => {
    if (!trimmedExpr || isSystem) {
      resetValidation();
      return;
    }
    const t = setTimeout(() => validateMutate(trimmedExpr), 600);
    return () => clearTimeout(t);
  }, [trimmedExpr, isSystem, validateMutate, resetValidation]);

  const referencedSymbols = useMemo(() => {
    if (!validation) return [];
    const refs = new Set([...validation.refs.parameters, ...validation.refs.formulaResults]);
    return validation.symbols.filter((s) => refs.has(s.name));
  }, [validation]);

  const keyValid = isEdit || FORMULA_KEY_RE.test(form.key);
  const nameValid = form.nameFa.trim().length > 0;
  const descValid = form.descriptionFa.trim().length > 0;
  const exprValid = isSystem || trimmedExpr.length > 0;
  const canSubmit = keyValid && nameValid && descValid && exprValid;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    const autoReason = isEdit ? `ویرایش فرمول «${formula.key}»` : `افزودن فرمول «${form.key.trim()}»`;
    let operation: ConfigOperationInput;
    if (isEdit) {
      const patch: Record<string, unknown> = { nameFa: form.nameFa.trim(), descriptionFa: form.descriptionFa.trim() };
      if (!isSystem) {
        patch.expr = trimmedExpr;
        patch.scopeLevel = form.scopeLevel;
        patch.status = form.status;
        if (form.outputUnit) patch.outputUnit = form.outputUnit;
      }
      operation = { op: "updateFormula", formulaKey: formula.key, patch };
    } else {
      operation = {
        op: "addFormula",
        formula: {
          key: form.key.trim(),
          nameFa: form.nameFa.trim(),
          semver: "1.0.0",
          scopeLevel: form.scopeLevel,
          status: form.status,
          descriptionFa: form.descriptionFa.trim(),
          expr: trimmedExpr,
          ...(form.outputUnit ? { outputUnit: form.outputUnit } : {}),
        },
      };
    }
    apply.mutate(
      { reason: form.reason.trim() || autoReason, operations: [operation] },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `ویرایش فرمول «${formula.nameFa}»` : "فرمول سفارشی جدید"}
          </DialogTitle>
          <DialogDescription>
            {isSystem
              ? "فرمول سیستمی است — فقط نام و توضیح قابل ویرایش است؛ برای تغییر عبارت، فرمول سفارشی جدید بسازید."
              : "عبارت با زبان DSL امن (بدون eval) اجرا می‌شود؛ ارجاع به پارامترها با شناسه فنی و به نتایج فرمول‌های دیگر با «کلید.result»."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <ScrollArea className="max-h-[62vh] pr-3">
            <div className="grid gap-4 py-2 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="formula-key">کلید فرمول *</Label>
                <Input
                  id="formula-key"
                  dir="ltr"
                  className="font-mono"
                  placeholder="f.zamanKol"
                  value={form.key}
                  onChange={(e) => set("key", e.target.value)}
                  disabled={isEdit}
                  required={!isEdit}
                  aria-invalid={!keyValid}
                />
                {!keyValid ? (
                  <p className="text-xs text-red-600 dark:text-red-400">الگو: f.zamanKol — حرف کوچک شروع، بدون خط تیره (یا کلید سیستمی مثل TS-011)</p>
                ) : (
                  <p className="text-xs text-muted-foreground">مثل f.ovenTotalDaily — ناورداست؛ نتیجه فرمول با «کلید.result» قابل ارجاع است</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="formula-name">نام فارسی *</Label>
                <Input id="formula-name" placeholder="مثال: زمان کل روزانه تنور" value={form.nameFa} onChange={(e) => set("nameFa", e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>سطح دامنه *</Label>
                <Select value={form.scopeLevel} onValueChange={(v) => set("scopeLevel", v as ConfigFormulaScopeLevel)} disabled={isSystem}>
                  <SelectTrigger aria-label="سطح دامنه">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SCOPE_LEVEL_LABELS_FA).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>وضعیت *</Label>
                <Select value={form.status} onValueChange={(v) => set("status", v as FormulaFormState["status"])} disabled={isSystem}>
                  <SelectTrigger aria-label="وضعیت فرمول">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(FORMULA_STATUS_LABELS_FA)
                      .filter(([value]) => value !== "deprecated" || isEdit)
                      .map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="formula-desc">توضیح فارسی *</Label>
                <Textarea
                  id="formula-desc"
                  rows={2}
                  placeholder="منطق محاسبه، مرجع و مفروضات"
                  value={form.descriptionFa}
                  onChange={(e) => set("descriptionFa", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="formula-unit">واحد خروجی</Label>
                <Select value={form.outputUnit || undefined} onValueChange={(v) => set("outputUnit", v)} disabled={isSystem}>
                  <SelectTrigger id="formula-unit" aria-label="واحد خروجی">
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
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="formula-expr">عبارت محاسبه (DSL) *</Label>
                <Textarea
                  id="formula-expr"
                  dir="ltr"
                  className="font-mono text-sm"
                  rows={4}
                  placeholder="oven.cycleTime * oven.batchesPerDay"
                  value={form.expr}
                  onChange={(e) => set("expr", e.target.value)}
                  disabled={isSystem}
                  required={!isSystem}
                  aria-describedby="formula-expr-hint"
                />
                <p id="formula-expr-hint" className="text-xs text-muted-foreground">
                  مثل <span className="font-mono" dir="ltr">oven.cycleTime * oven.batchesPerDay</span> — اپراتورها و توابع در «راهنمای توابع»
                </p>
              </div>

              {/* ── پنل اعتبارسنجی زنده ── */}
              {!isSystem && trimmedExpr ? (
                <div className="space-y-2 rounded-lg border p-3 sm:col-span-2" aria-live="polite">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    اعتبارسنجی زنده
                    {validating ? <Spinner className="size-3" /> : null}
                  </div>
                  {validation && !validating ? (
                    <>
                      <ErrorList errors={validation.errors} />
                      {validation.warnings.map((w, i) => (
                        <p key={i} className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {w.messageFa}
                        </p>
                      ))}
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        <Badge variant="secondary">{faCount(validation.refs.parameters.length)} پارامتر</Badge>
                        <span className="text-muted-foreground">·</span>
                        <Badge variant="secondary">{faCount(validation.refs.formulaResults.length)} فرمول</Badge>
                        {validation.refs.unknown.length > 0 ? (
                          <>
                            <span className="text-muted-foreground">·</span>
                            <span className="text-red-600 dark:text-red-400">ارجاع ناشناس:</span>
                            {validation.refs.unknown.map((u) => (
                              <MonoKey key={u} value={u} className="bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400" />
                            ))}
                          </>
                        ) : null}
                        <span className="text-muted-foreground">·</span>
                        <span className="text-muted-foreground">نوع استنباطی: {validation.inferredType}</span>
                      </div>
                    </>
                  ) : !validating ? (
                    <p className="text-xs text-muted-foreground">در انتظار نتیجه تحلیل…</p>
                  ) : null}
                </div>
              ) : null}

              <Separator className="sm:col-span-2" />

              {/* ── آزمون با داده نمونه ── */}
              {!isSystem ? (
                <Collapsible className="sm:col-span-2">
                  <CollapsibleTrigger asChild>
                    <Button type="button" variant="outline" size="sm" className="gap-1">
                      <ChevronDown className="size-3.5" aria-hidden /> آزمون با داده نمونه
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-3">
                      {trimmedExpr ? (
                        <FormulaTestPanel projectId={projectId} expr={trimmedExpr} symbols={referencedSymbols} />
                      ) : (
                        <p className="text-sm text-muted-foreground">ابتدا عبارت را وارد کنید تا نمادهای ارجاع‌شده مشخص شود.</p>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ) : null}

              {/* ── راهنمای توابع و نمادها ── */}
              <FunctionReference className="sm:col-span-2" />

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="formula-reason">دلیل تغییر (اختیاری)</Label>
                <Input
                  id="formula-reason"
                  placeholder={`خالی = دلیل خودکار (${isEdit ? "ویرایش" : "افزودن"} فرمول)`}
                  value={form.reason}
                  onChange={(e) => set("reason", e.target.value)}
                />
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="mt-4 gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              انصراف
            </Button>
            <Button type="submit" disabled={apply.isPending || !canSubmit}>
              {apply.isPending && <Spinner />} {isEdit ? "ذخیره تغییرات" : "ایجاد فرمول"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────── راهنمای توابع / نمادها ───────────────────────

function FunctionReference({ className }: { className?: string }) {
  const catalog = useFunctionCatalog();
  const [open, setOpen] = useState(false);
  if (catalog.isLoading) return null;
  const data = catalog.data;
  if (!data) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={cn("space-y-2", className)}>
      <CollapsibleTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-1" aria-expanded={open}>
          <BookOpen className="size-3.5" aria-hidden /> راهنمای توابع و عملگرها
          <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} aria-hidden />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="max-h-64 overflow-y-auto rounded-lg border p-3 text-xs leading-relaxed">
          <p className="mb-2 text-muted-foreground">
            حداکثر طول عبارت {faCount(data.limits.maxExprLength)} نویسه · حداکثر {faCount(data.limits.maxNodeCount)} گره ·
            اپراتورها: <span className="font-mono" dir="ltr">{data.operators.join(" ")}</span>
          </p>
          <ul className="space-y-2">
            {data.functions.map((fn) => (
              <li key={fn.name}>
                <p className="font-mono text-[11px]" dir="ltr">
                  {fn.signature}
                </p>
                <p className="font-medium">{fn.nameFa}</p>
                <p className="text-muted-foreground">{fn.descriptionFa}</p>
              </li>
            ))}
          </ul>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
