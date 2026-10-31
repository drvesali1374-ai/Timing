"use client";

/**
 * دیالوگ آزمون فرمول ثبت‌شده — عبارت فرمول با داده نمونه اجرا می‌شود
 * (بدون ذخیره نتیجه). نمادهای ارجاع‌شده از اعتبارسنجی ایستا استخراج می‌شود.
 */
import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ConfigFormulaDto } from "@/shared/contracts/config";
import { useValidateFormula } from "@/hooks/use-config";
import { Spinner } from "@/components/app/ui-bits";
import { ErrorList, MonoKey, ScopeLevelBadge } from "./config-bits";
import { FormulaTestPanel } from "./formula-test-panel";

export function FormulaTesterDialog({
  projectId,
  formula,
  open,
  onOpenChange,
}: {
  projectId: string;
  formula: ConfigFormulaDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { mutate: validateMutate, data: validation, isPending: validating } = useValidateFormula(projectId);
  // یک‌بار هنگام بازشدن، نمادهای ارجاع‌شده استخراج می‌شود
  const [validatedKey, setValidatedKey] = useState<string | null>(null);

  useEffect(() => {
    if (open && formula.expr && validatedKey !== formula.key) {
      validateMutate(formula.expr, {
        onSuccess: () => setValidatedKey(formula.key),
      });
    }
  }, [open, formula.key, formula.expr, validatedKey, validateMutate]);

  const referencedSymbols = useMemo(() => {
    if (!validation) return [];
    const refs = new Set([...validation.refs.parameters, ...validation.refs.formulaResults]);
    return validation.symbols.filter((s) => refs.has(s.name));
  }, [validation]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            آزمون فرمول «{formula.nameFa}»
            <MonoKey value={formula.key} />
            <ScopeLevelBadge scope={formula.scopeLevel} />
          </DialogTitle>
          <DialogDescription>
            عبارت با داده نمونه شما اجرا می‌شود — داده نمونه با داده واقعی پروژه مخلوط نمی‌شود و نتیجه ذخیره نمی‌شود.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[65vh] pr-3">
          <div className="space-y-3 py-1">
            <div className="overflow-x-auto rounded-lg border bg-muted/50 p-3">
              <pre className="whitespace-pre-wrap text-left font-mono text-xs leading-relaxed" dir="ltr">
                {formula.expr || "// بدون عبارت اجرایی"}
              </pre>
            </div>
            {validating && !validation ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner /> در حال استخراج نمادهای ارجاع‌شده…
              </p>
            ) : validation && validation.errors.length > 0 ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/40">
                <p className="mb-1 text-xs font-medium text-red-800 dark:text-red-300">عبارت خطای ایستا دارد:</p>
                <ErrorList errors={validation.errors} />
              </div>
            ) : (
              <FormulaTestPanel projectId={projectId} formulaKey={formula.key} symbols={referencedSymbols} />
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
