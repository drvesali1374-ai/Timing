"use client";

/**
 * تب «فرم و مقادیر» — فرم‌ساز روی همه پارامترهای فعال (گروه‌بندی خانواده).
 * شرط نمایش/اجباری با موتور خالص shared سمت کاربر ارزیابی می‌شود (سریع و قطعی)؛
 * اعتبارسنجی نهایی مقدارها در سرور (PUT values) انجام می‌شود.
 */
import { useMemo, useState } from "react";
import { Calculator, RotateCcw, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { parse, evaluate, type InputMap } from "@/shared/formula/engine";
import type { CurrentConfigDto } from "@/shared/contracts/config";
import { faCount, useFormulaResults, useParamValues, useSaveParamValues, type ParamValueWireDto } from "@/hooks/use-config";
import { EmptyState, ErrorState, LoadingBlock, Spinner } from "@/components/app/ui-bits";
import { MonoKey } from "./config-bits";
import { isSameDraft, toWireValue, ValueField, type DraftValue } from "./value-field";

export function FormValuesTab({
  projectId,
  config,
  canWrite,
}: {
  projectId: string;
  config: CurrentConfigDto;
  canWrite: boolean;
}) {
  const valuesQuery = useParamValues(projectId);
  const resultsQuery = useFormulaResults(projectId);

  if (valuesQuery.isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <LoadingBlock lines={6} />
        </CardContent>
      </Card>
    );
  }
  if (valuesQuery.isError) {
    return <ErrorState message={(valuesQuery.error as Error)?.message ?? "خطا در بارگذاری مقدارها."} onRetry={() => valuesQuery.refetch()} />;
  }
  const items = valuesQuery.data;
  if (!items) return null;

  if (items.length === 0) {
    return (
      <EmptyState
        title="پارامتری برای مقداردهی نیست"
        description="ابتدا در تب «خانواده‌ها و پارامترها» پارامتر تعریف کنید؛ سپس مقدارهای پروژه در همین فرم ثبت می‌شود و فرمول‌ها از آن‌ها محاسبه می‌شوند."
      />
    );
  }

  return (
    <ValuesForm
      projectId={projectId}
      config={config}
      canWrite={canWrite}
      items={items}
      results={resultsQuery.data ?? []}
    />
  );
}

// ─────────────────────── فرم مقدارها ───────────────────────

function initDraft(items: ParamValueWireDto[]): Record<string, DraftValue> {
  const out: Record<string, DraftValue> = {};
  for (const item of items) {
    const raw = item.value?.value ?? null;
    if (item.dataType === "boolean") out[item.stableKey] = raw === true;
    else if (item.dataType === "multiSelect") out[item.stableKey] = Array.isArray(raw) ? (raw as string[]) : [];
    else out[item.stableKey] = raw === null || raw === undefined ? "" : String(raw);
  }
  return out;
}

function buildEngineInputs(items: ParamValueWireDto[], draft: Record<string, DraftValue>, results: Array<{ formulaKey: string; value: number | string | boolean | null | Array<number | string | boolean | null>; unit?: string }>): InputMap {
  const inputs: InputMap = {};
  for (const item of items) {
    const v = draft[item.stableKey];
    switch (item.dataType) {
      case "integer":
      case "decimal":
      case "percent":
      case "ratio":
      case "duration":
      case "quantityWithUnit": {
        const text = typeof v === "string" ? v.trim() : "";
        const n = text === "" ? null : Number(text.replace(/,/g, "."));
        inputs[item.stableKey] = {
          value: n !== null && Number.isFinite(n) ? n : null,
          ...(item.unit ? { unit: item.unit } : {}),
        };
        break;
      }
      case "boolean":
        inputs[item.stableKey] = { value: v === true };
        break;
      case "multiSelect":
        inputs[item.stableKey] = { value: Array.isArray(v) ? v : [] };
        break;
      default:
        inputs[item.stableKey] = {
          value: typeof v === "string" && v.trim() !== "" ? v.trim() : null,
        };
    }
  }
  for (const r of results) {
    inputs[`${r.formulaKey}.result`] = { value: r.value, ...(r.unit ? { unit: r.unit } : {}) };
  }
  return inputs;
}

/** ارزیابی شرط DSL با موتور خالص — null یعنی «بدون شرط» */
function evalCondition(expr: string | null | undefined, inputs: InputMap): boolean | null {
  if (!expr || !expr.trim()) return null;
  try {
    const parsed = parse(expr);
    if (!parsed.ok || !parsed.ast) return false;
    const outcome = evaluate(parsed.ast, inputs);
    return outcome.status === "valid" && outcome.value === true;
  } catch {
    return false;
  }
}

function isFilled(dataType: string, v: DraftValue | undefined): boolean {
  if (dataType === "boolean") return true;
  if (dataType === "multiSelect") return (Array.isArray(v) ? v : []).length > 0;
  return String(v ?? "").trim() !== "";
}

function ValuesForm({
  projectId,
  config,
  canWrite,
  items,
  results,
}: {
  projectId: string;
  config: CurrentConfigDto;
  canWrite: boolean;
  items: ParamValueWireDto[];
  results: Array<{ formulaKey: string; value: number | string | boolean | null | Array<number | string | boolean | null>; unit?: string }>;
}) {
  const save = useSaveParamValues(projectId);
  // مقدار سرور (شامل پیش‌فرض‌ها) منبع حقیقت است؛ پیش‌نویس کاربر فقط لایه‌ای روی آن
  // قرار می‌گیرد — پارامتر تازه‌افزوده پس از invalidation خودکار دیده می‌شود (بدون effect).
  const initial = useMemo(() => initDraft(items), [items]);
  const [draft, setDraft] = useState<Record<string, DraftValue>>({});

  const draftOf = (stableKey: string): DraftValue => draft[stableKey] ?? initial[stableKey] ?? "";

  const inputs = useMemo(
    () => buildEngineInputs(items, { ...initial, ...draft }, results),
    [items, initial, draft, results],
  );
  const itemByKey = useMemo(() => new Map(items.map((i) => [i.stableKey, i])), [items]);

  const visibleItems = useMemo(
    () => items.filter((item) => evalCondition(item.visibilityCondition, inputs) !== false),
    [items, inputs],
  );

  const changedItems = useMemo(
    () => items.filter((item) => !isSameDraft(draft[item.stableKey] ?? initial[item.stableKey], initial[item.stableKey], item.dataType)),
    [items, draft, initial],
  );

  const filledCount = visibleItems.filter((item) => isFilled(item.dataType, draftOf(item.stableKey))).length;
  const totalCount = visibleItems.length;
  const progress = totalCount > 0 ? Math.round((filledCount / totalCount) * 100) : 0;

  const setField = (stableKey: string, value: DraftValue) =>
    setDraft((d) => ({ ...d, [stableKey]: value }));

  const reset = () => setDraft({});

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (changedItems.length === 0) return;
    const payload = changedItems.map((item) => ({
      stableKey: item.stableKey,
      value: toWireValue(item.dataType, draftOf(item.stableKey)),
    }));
    // پس از ذخیره، invalidation مقدارهای سرور (شامل گردکردن/نرمال‌سازی) را تازه می‌کند
    save.mutate(payload, { onSuccess: () => setDraft({}) });
  };

  const families = useMemo(
    () => [...config.snapshot.families].filter((f) => !f.archived).sort((a, b) => a.order - b.order),
    [config],
  );

  return (
    <form onSubmit={submit} className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">وضعیت فرم پروژه</CardTitle>
          <CardDescription>
            {faCount(filledCount)} از {faCount(totalCount)} پارامتر پر شده است · {faCount(items.length - visibleItems.length)} فیلد با شرط نمایش پنهان است
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Progress value={progress} aria-label={`پیشرفت ${progress} درصد`} />
          {changedItems.length > 0 ? (
            <p className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
              <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
                {faCount(changedItems.length)} تغییر ذخیره‌نشده
              </Badge>
              اعتبارسنجی نهایی در سرور انجام می‌شود
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">تغییر ذخیره‌نشده‌ای وجود ندارد.</p>
          )}
        </CardContent>
      </Card>

      {families.map((family) => {
        const familyParams = family.parameters.filter((p) => !p.archived);
        const visibleParams = familyParams.filter((p) => {
          if (p.dataType === "computed") return true;
          const item = itemByKey.get(p.stableKey);
          if (!item) return false;
          return evalCondition(item.visibilityCondition, inputs) !== false;
        });
        if (visibleParams.length === 0) return null;
        return (
          <Card key={family.stableKey}>
            <CardHeader className="pb-3">
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                {family.nameFa}
                <MonoKey value={family.stableKey} />
              </CardTitle>
              {family.description ? <CardDescription>{family.description}</CardDescription> : null}
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              {visibleParams.map((param) => {
                if (param.dataType === "computed") {
                  return (
                    <div key={param.stableKey} className="space-y-1.5 rounded-lg border border-dashed p-3">
                      <p className="flex items-center gap-1.5 text-sm font-medium">
                        <Calculator className="size-4 text-muted-foreground" aria-hidden />
                        {param.nameFa}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        محاسباتی — از تب «نتایج محاسبه»
                        {param.computedFormulaKey ? (
                          <>
                            {" "}
                            با فرمول <MonoKey value={param.computedFormulaKey} />
                          </>
                        ) : null}
                      </p>
                    </div>
                  );
                }
                const item = itemByKey.get(param.stableKey);
                if (!item) return null;
                const requiredNow = item.required || evalCondition(item.requiredCondition, inputs) === true;
                return (
                  <div key={param.stableKey} className={param.dataType === "longText" ? "sm:col-span-2" : undefined}>
                    <ValueField
                      item={item}
                      value={draftOf(item.stableKey)}
                      onChange={(v) => setField(item.stableKey, v)}
                      requiredNow={requiredNow}
                      min={param.min}
                      max={param.max}
                      helpFa={param.helpFa}
                      disabled={!canWrite}
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card p-4">
        <p className="text-xs text-muted-foreground">
          {canWrite
            ? "فقط فیلدهای تغییرکرده ارسال می‌شود؛ مقدار هر فیلد به نسخه تعریف فعلی گره می‌خورد."
            : "نقش شما فقط خواندنی است — ثبت مقدار برای ویرایشگر/مالک فعال است."}
        </p>
        {canWrite ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={reset} disabled={save.isPending || changedItems.length === 0} className="gap-2">
              <RotateCcw className="size-4" aria-hidden /> بازنشانی
            </Button>
            <Button type="submit" disabled={save.isPending || changedItems.length === 0} className="gap-2">
              {save.isPending ? <Spinner /> : <Save className="size-4" aria-hidden />} ذخیره مقادیر
              {changedItems.length > 0 ? ` (${faCount(changedItems.length)})` : ""}
            </Button>
          </div>
        ) : null}
      </div>
    </form>
  );
}
