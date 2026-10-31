"use client";

/**
 * تب «نتایج محاسبه» — فرمول‌های سطح پروژه با دکمه محاسبه (POST evaluate)
 * و آخرین نتیجه هر فرمول (GET results). فرمول‌های سطح عنصر/چرخه به فاز ۴+ وابسته‌اند.
 */
import { useMemo, useState } from "react";
import { AlertTriangle, Calculator, Clock, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { ConfigFormulaDto, CurrentConfigDto, FormulaResultDto } from "@/shared/contracts/config";
import { faCount, formatParamValueFa, useEvaluateFormula, useFormulaResults } from "@/hooks/use-config";
import { EmptyState, ErrorState, FaDate, LoadingBlock, Spinner } from "@/components/app/ui-bits";
import { ErrorList, MonoKey, ScopeLevelBadge, SemverBadge, TraceSteps } from "./config-bits";

export function ResultsTab({
  projectId,
  config,
  canWrite,
}: {
  projectId: string;
  config: CurrentConfigDto;
  canWrite: boolean;
}) {
  const resultsQuery = useFormulaResults(projectId);
  const evaluate = useEvaluateFormula(projectId);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const active = config.snapshot.formulas.filter((f) => f.status !== "deprecated");
  const projectScope = active.filter((f) => f.scopeLevel === "project");
  const otherScope = active.filter((f) => f.scopeLevel !== "project");

  const resultsByKey = useMemo(() => {
    const map = new Map<string, FormulaResultDto>();
    for (const r of resultsQuery.data ?? []) map.set(r.formulaKey, r);
    return map;
  }, [resultsQuery.data]);

  const runEvaluate = (formula: ConfigFormulaDto) => {
    setBusyKey(formula.key);
    evaluate.mutate(formula.key, { onSettled: () => setBusyKey(null) });
  };

  if (resultsQuery.isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <LoadingBlock lines={5} />
        </CardContent>
      </Card>
    );
  }
  if (resultsQuery.isError) {
    return <ErrorState message={(resultsQuery.error as Error)?.message ?? "خطا در بارگذاری نتایج."} onRetry={() => resultsQuery.refetch()} />;
  }

  if (active.length === 0) {
    return (
      <EmptyState
        title="فرمول فعالی برای محاسبه نیست"
        description="فرمول‌های سطح پروژه با فشردن «محاسبه» روی مقدارهای واقعی ثبت‌شده اجرا می‌شوند. ابتدا در تب «فرمول‌ها» فرمول تعریف یا فعال کنید."
      />
    );
  }

  return (
    <div className="space-y-4">
      {projectScope.length === 0 ? (
        <EmptyState
          title="فرمول سطح پروژه‌ای وجود ندارد"
          description="فرمول‌های سطح عنصر/چرخه به داده مشاهدات نیاز دارند و در فاز ۴ محاسبه می‌شوند. برای محاسبه فوری، فرمولی با دامنه «پروژه» بسازید."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {projectScope.map((formula) => (
            <ResultCard
              key={formula.key}
              formula={formula}
              result={resultsByKey.get(formula.key)}
              canWrite={canWrite}
              busy={evaluate.isPending && busyKey === formula.key}
              onEvaluate={() => runEvaluate(formula)}
            />
          ))}
        </div>
      )}

      {otherScope.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="size-4 text-muted-foreground" aria-hidden />
              فرمول‌های سطح عنصر/چرخه — نیازمند داده مشاهدات (فاز ۴)
            </CardTitle>
            <CardDescription>
              این فرمول‌ها روی داده دامنه‌های پایین‌تر اجرا می‌شوند و هنوز داده‌ای برای آن‌ها ثبت نشده است.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {otherScope.map((f) => (
                <li key={f.key} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{f.nameFa}</span>
                    <MonoKey value={f.key} />
                    <ScopeLevelBadge scope={f.scopeLevel} />
                  </div>
                  {f.availabilityNoteFa ? (
                    <p className="mt-1 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                      <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {f.availabilityNoteFa}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">{f.descriptionFa}</p>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

// ─────────────────────── کارت نتیجه ───────────────────────

function ResultCard({
  formula,
  result,
  canWrite,
  busy,
  onEvaluate,
}: {
  formula: ConfigFormulaDto;
  result?: FormulaResultDto;
  canWrite: boolean;
  busy: boolean;
  onEvaluate: () => void;
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0 pb-3">
        <div className="min-w-0 space-y-1">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            {formula.nameFa}
            <MonoKey value={formula.key} />
          </CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-1.5">
            <SemverBadge semver={formula.semver} />
            <ScopeLevelBadge scope={formula.scopeLevel} />
          </CardDescription>
        </div>
        {canWrite ? (
          <Button size="sm" className="gap-2" onClick={onEvaluate} disabled={busy}>
            {busy ? <Spinner /> : <Calculator className="size-4" aria-hidden />} محاسبه
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <div className="overflow-x-auto rounded-lg border bg-muted/50 p-3">
          <pre className="whitespace-pre-wrap text-left font-mono text-xs leading-relaxed" dir="ltr">
            {formula.expr || "// بدون عبارت اجرایی"}
          </pre>
        </div>

        {result ? (
          <div className="space-y-3" aria-live="polite">
            <div className="flex flex-wrap items-center gap-2">
              {result.status === "valid" ? (
                <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
                  معتبر
                </Badge>
              ) : result.status === "incomplete" ? (
                <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  ناقص / تأییدنشده
                </Badge>
              ) : (
                <Badge variant="outline" className="border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
                  نامعتبر
                </Badge>
              )}
              <span className="font-mono text-2xl font-bold tracking-tight" dir="ltr">
                {formatParamValueFa(result.value, result.unit)}
              </span>
            </div>
            {result.errors.length > 0 ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/40">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-red-800 dark:text-red-300">
                  <AlertTriangle className="size-3.5" aria-hidden /> خطاهای ارزیابی:
                </p>
                <ErrorList errors={result.errors} />
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground">
              محاسبه‌شده در <FaDate iso={result.computedAt} withTime /> · نسخه فرمول{" "}
              <span className="font-mono" dir="ltr">v{result.formulaSemver}</span> · نسخه پیکربندی{" "}
              <span className="font-mono text-[10px]" dir="ltr" title={result.configVersionId}>
                {result.configVersionId.slice(0, 8)}…
              </span>
            </p>
            {result.inputRefs.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted-foreground">ورودی‌ها ({faCount(result.inputRefs.length)}):</span>
                {result.inputRefs.map((ref) => (
                  <MonoKey key={ref} value={ref} />
                ))}
              </div>
            ) : null}
            <Separator />
            <TraceSteps trace={result.trace} />
          </div>
        ) : (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            هنوز محاسبه نشده است{canWrite ? " — با دکمه «محاسبه» روی مقدارهای واقعی پروژه اجرا کنید." : "؛ نتیجه پس از محاسبه توسط ویرایشگر/مالک نمایش داده می‌شود."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
