"use client";

/**
 * پنل آزمون فرمول با داده نمونه — ورودی نمونه برای نمادهای ارجاع‌شده،
 * اجرای POST test و نمایش نتیجه + گام‌های محاسبه. هیچ نتیجه‌ای ذخیره نمی‌شود.
 */
import { useState } from "react";
import { FlaskConical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { FormulaValidationDto } from "@/shared/contracts/config";
import { faCount, formatParamValueFa, useTestFormula, type ParamRawValue } from "@/hooks/use-config";
import { Spinner } from "@/components/app/ui-bits";
import { ErrorList, MonoKey, TraceSteps } from "./config-bits";

type SymbolInfo = FormulaValidationDto["symbols"][number];

function parseSample(raw: string, type: string): ParamRawValue | undefined {
  const t = raw.trim();
  if (t === "") return undefined;
  if (type === "number") {
    const n = Number(t.replace(/,/g, "."));
    return Number.isFinite(n) ? n : t;
  }
  if (type === "boolean") return t === "true" || t === "درست";
  if (type === "numberArray") {
    return t
      .split(/[,،]/)
      .map((piece) => piece.trim())
      .filter((piece) => piece !== "")
      .map((piece) => {
        const n = Number(piece);
        return Number.isFinite(n) ? n : piece;
      });
  }
  return t;
}

export function FormulaTestPanel({
  projectId,
  expr,
  formulaKey,
  symbols,
}: {
  projectId: string;
  expr?: string;
  formulaKey?: string;
  symbols: SymbolInfo[];
}) {
  const test = useTestFormula(projectId);
  const [samples, setSamples] = useState<Record<string, string>>({});

  const setSample = (name: string, value: string) => setSamples((s) => ({ ...s, [name]: value }));

  const run = () => {
    const sampleValues: Record<string, ParamRawValue> = {};
    for (const sym of symbols) {
      const parsed = parseSample(samples[sym.name] ?? "", sym.type);
      if (parsed !== undefined) sampleValues[sym.name] = parsed;
    }
    test.mutate({ ...(formulaKey ? { formulaKey } : { expr }), sampleValues });
  };

  const result = test.data;

  return (
    <div className="space-y-3">
      <div className="rounded-lg border p-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          داده نمونه (با داده واقعی پروژه مخلوط نمی‌شود) — نمادهای ارجاع‌شده:
        </p>
        {symbols.length === 0 ? (
          <p className="text-sm text-muted-foreground">نمادی در عبارت ارجاع نشده است.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {symbols.map((sym) => (
              <div key={sym.name} className="space-y-1.5">
                <Label htmlFor={`sample-${sym.name}`} className="flex flex-wrap items-center gap-1.5 font-mono text-xs" dir="ltr">
                  {sym.name}
                  {sym.unit ? <Badge variant="outline" className="font-mono text-[9px]">{sym.unit}</Badge> : null}
                </Label>
                {sym.type === "boolean" ? (
                  <Select value={samples[sym.name] ?? ""} onValueChange={(v) => setSample(sym.name, v)}>
                    <SelectTrigger id={`sample-${sym.name}`} className="font-mono" aria-label={`نمونه ${sym.name}`}>
                      <SelectValue placeholder="— نامشخص —" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">true</SelectItem>
                      <SelectItem value="false">false</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id={`sample-${sym.name}`}
                    dir="ltr"
                    className="font-mono"
                    inputMode={sym.type === "number" || sym.type === "numberArray" ? "decimal" : "text"}
                    placeholder={sym.type === "numberArray" ? "12, 14.5, 20" : sym.type === "number" ? "12.5" : "مقدار"}
                    value={samples[sym.name] ?? ""}
                    onChange={(e) => setSample(sym.name, e.target.value)}
                  />
                )}
                <p className="text-[10px] text-muted-foreground">
                  نوع: {sym.type === "number" ? "عدد" : sym.type === "boolean" ? "بولی" : sym.type === "numberArray" ? "فهرست عدد" : "متن"}
                  {sym.source === "formulaResult" ? " · نتیجه فرمول دیگر" : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" className="gap-2" onClick={run} disabled={test.isPending || symbols.length === 0 || (!expr && !formulaKey)}>
          {test.isPending ? <Spinner /> : <FlaskConical className="size-4" aria-hidden />} اجرای آزمون
        </Button>
        <span className="text-xs text-muted-foreground">نتیجه آزمون ذخیره نمی‌شود</span>
      </div>

      {result ? (
        <div className="rounded-lg border p-3" aria-live="polite">
          <div className="flex flex-wrap items-center gap-2">
            {result.status === "valid" ? (
              <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
                معتبر
              </Badge>
            ) : result.status === "incomplete" ? (
              <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
                ناقص — ورودی گمشده
              </Badge>
            ) : (
              <Badge variant="outline" className="border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
                نامعتبر
              </Badge>
            )}
            <span className="font-mono text-lg" dir="ltr">
              {formatParamValueFa(result.value, result.unit)}
            </span>
          </div>
          <ErrorList errors={result.errors} className="mt-2" />
          {result.inputRefs.length > 0 ? (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground">ورودی‌ها:</span>
              {result.inputRefs.map((ref) => (
                <MonoKey key={ref} value={ref} />
              ))}
            </div>
          ) : null}
          <TraceSteps trace={result.trace} />
        </div>
      ) : test.isError ? (
        <p className="text-xs text-red-600 dark:text-red-400">{(test.error as Error)?.message ?? "خطا در اجرای آزمون."}</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          برای نمادهای نامشخص مقدار وارد کنید تا وضعیت از «ناقص» به «معتبر» برسد ({faCount(symbols.length)} نماد).
        </p>
      )}
    </div>
  );
}
