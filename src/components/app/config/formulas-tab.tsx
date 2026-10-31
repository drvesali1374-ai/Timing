"use client";

/**
 * تب «فرمول‌ها» — کارت فرمول‌ها با عبارت ltr، وضعیت، مبدأ و کنش‌ها.
 * فرمول سیستمی فقط غیرفعال‌شدنی است؛ ویرایش عبارت آن به سرور ۴۰۳ می‌دهد
 * (پیام فارسی سرور در toast نمایش داده می‌شود).
 */
import { useState } from "react";
import { AlertTriangle, CircleSlash, CircleCheck, FlaskConical, Info, Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { ConfigFormulaDto, ConfigOperationInput, CurrentConfigDto } from "@/shared/contracts/config";
import { faCount, useApplyConfigOps } from "@/hooks/use-config";
import { EmptyState } from "@/components/app/ui-bits";
import { FormulaStatusBadge, MonoKey, OriginBadge, ScopeLevelBadge, SemverBadge } from "./config-bits";
import { FormulaDialog } from "./formula-dialog";
import { FormulaTesterDialog } from "./formula-tester-dialog";

export function FormulasTab({
  projectId,
  config,
  canWrite,
}: {
  projectId: string;
  config: CurrentConfigDto;
  canWrite: boolean;
}) {
  const apply = useApplyConfigOps(projectId);
  const [editFormula, setEditFormula] = useState<ConfigFormulaDto | undefined>(undefined);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [testerFormula, setTesterFormula] = useState<ConfigFormulaDto | null>(null);
  const [deprecateFormula, setDeprecateFormula] = useState<ConfigFormulaDto | null>(null);

  const formulas = config.snapshot.formulas;
  const runOp = (reason: string, operation: ConfigOperationInput) =>
    apply.mutate({ reason, operations: [operation] });

  const openCreate = () => {
    setEditFormula(undefined);
    setDialogOpen(true);
  };
  const openEdit = (formula: ConfigFormulaDto) => {
    setEditFormula(formula);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-xl border border-dashed p-4 text-sm leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 size-5 shrink-0" aria-hidden />
        <p>
          فرمول‌های سیستمی (کلیدهای <span className="font-mono" dir="ltr">TS/ST/LB/MM</span>) فقط قابل غیرفعال‌سازی‌اند؛
          برای تغییر، نسخه سفارشی با کلید <span className="font-mono" dir="ltr">f.*</span> بسازید. ارجاع به نتایج فرمول‌های
          دیگر با الگوی <span className="font-mono" dir="ltr">«کلید.result»</span> ممکن است.
        </p>
      </div>

      {canWrite ? (
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">{faCount(formulas.length)} فرمول در پیکربندی</p>
          <Button size="sm" className="gap-2" onClick={openCreate}>
            <Plus className="size-4" aria-hidden /> فرمول جدید
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{faCount(formulas.length)} فرمول در پیکربندی</p>
      )}

      {formulas.length === 0 ? (
        <EmptyState
          title="فرمولی تعریف نشده است"
          description="فرمول‌ها محاسبات پویا را روی مقدار پارامترها اجرا می‌کنند (مثل زمان کل روزانه = زمان چرخه × تعداد batch). فرمول سیستمی الگو را فراهم می‌کند؛ فرمول سفارشی خود را بسازید."
          action={
            canWrite ? (
              <Button size="sm" className="gap-2" onClick={openCreate}>
                <Plus className="size-4" aria-hidden /> فرمول جدید
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {formulas.map((formula) => (
            <FormulaCard
              key={formula.key}
              formula={formula}
              canWrite={canWrite}
              pending={apply.isPending}
              onEdit={() => openEdit(formula)}
              onTest={() => setTesterFormula(formula)}
              onDeprecate={() => setDeprecateFormula(formula)}
              onRestore={() =>
                runOp(`فعال‌سازی فرمول «${formula.key}»`, {
                  op: "deprecateFormula",
                  formulaKey: formula.key,
                  deprecated: false,
                })
              }
            />
          ))}
        </div>
      )}

      {dialogOpen ? (
        <FormulaDialog
          projectId={projectId}
          formula={editFormula}
          open={dialogOpen}
          onOpenChange={(o) => {
            setDialogOpen(o);
            if (!o) setEditFormula(undefined);
          }}
        />
      ) : null}
      {testerFormula ? (
        <FormulaTesterDialog
          projectId={projectId}
          formula={testerFormula}
          open={true}
          onOpenChange={(o) => !o && setTesterFormula(null)}
        />
      ) : null}

      <AlertDialog open={!!deprecateFormula} onOpenChange={(o) => !o && setDeprecateFormula(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>غیرفعال‌سازی فرمول «{deprecateFormula?.nameFa}»؟</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  فرمول منسوخ در نمادهای فرمول‌نویسی و محاسبات پایشده نمی‌شود؛ نتایج قبلی حفظ می‌شود. این کنش با
                  «فعال‌سازی» قابل بازگشت است.
                </p>
                {deprecateFormula?.origin === "system" ? (
                  <p className="flex items-start gap-1.5 text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                    این فرمول سیستمی بخشی از زنجیره تحلیل است — غیرفعال‌سازی ممکن است فرمول‌های وابسته را ناقص کند.
                  </p>
                ) : null}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deprecateFormula) {
                  runOp(`غیرفعال‌سازی فرمول «${deprecateFormula.key}»`, {
                    op: "deprecateFormula",
                    formulaKey: deprecateFormula.key,
                    deprecated: true,
                  });
                }
                setDeprecateFormula(null);
              }}
            >
              غیرفعال کن
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─────────────────────── کارت فرمول ───────────────────────

function FormulaCard({
  formula,
  canWrite,
  pending,
  onEdit,
  onTest,
  onDeprecate,
  onRestore,
}: {
  formula: ConfigFormulaDto;
  canWrite: boolean;
  pending: boolean;
  onEdit: () => void;
  onTest: () => void;
  onDeprecate: () => void;
  onRestore: () => void;
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <span className={formula.status === "deprecated" ? "text-stone-500 line-through dark:text-stone-400" : undefined}>
            {formula.nameFa}
          </span>
          <MonoKey value={formula.key} />
        </CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-1.5">
          <SemverBadge semver={formula.semver} />
          <ScopeLevelBadge scope={formula.scopeLevel} />
          <FormulaStatusBadge status={formula.status} />
          <OriginBadge origin={formula.origin} />
          {formula.outputUnit ? (
            <Badge variant="outline" className="font-mono text-[10px]" dir="ltr">
              {formula.outputUnit}
            </Badge>
          ) : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <div className="overflow-x-auto rounded-lg border bg-muted/50 p-3">
          <pre className="whitespace-pre-wrap text-left font-mono text-xs leading-relaxed" dir="ltr">
            {formula.expr || "// بدون عبارت اجرایی"}
          </pre>
        </div>
        {formula.availabilityNoteFa ? (
          <p className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {formula.availabilityNoteFa}
          </p>
        ) : null}
        <p className="text-xs leading-relaxed text-muted-foreground">{formula.descriptionFa}</p>
        {formula.assumptionsFa && formula.assumptionsFa.length > 0 ? (
          <ul className="list-inside list-disc space-y-0.5 text-xs text-muted-foreground">
            {formula.assumptionsFa.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        ) : null}
        <div className="mt-auto flex flex-wrap items-center gap-1 pt-1">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onTest}>
            <FlaskConical className="size-3.5" aria-hidden /> آزمون
          </Button>
          {canWrite ? (
            <>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={onEdit} disabled={pending}>
                <Pencil className="size-3.5" aria-hidden /> ویرایش
              </Button>
              {formula.status === "deprecated" ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={onRestore}
                  disabled={pending}
                  aria-label={`فعال‌سازی فرمول ${formula.nameFa}`}
                >
                  <CircleCheck className="size-3.5" aria-hidden /> فعال‌سازی
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-red-600 dark:text-red-400"
                  onClick={onDeprecate}
                  disabled={pending}
                  aria-label={`غیرفعال‌سازی فرمول ${formula.nameFa}`}
                >
                  <CircleSlash className="size-3.5" aria-hidden /> غیرفعال‌سازی
                </Button>
              )}
            </>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
