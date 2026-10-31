"use client";

/**
 * تب «خانواده‌ها و پارامترها» — کارت‌های خانواده به ترتیب order + جدول پارامترها.
 * هر کنش (افزودن/ویرایش/بایگانی/جابه‌جایی) بلافاصله یک نسخه append-only با دلیل
 * خودکار ثبت می‌کند (قرارداد فاز ۲ — بدون انباشت سمت کاربر).
 */
import { useState } from "react";
import { Archive, ArchiveRestore, ArrowDown, ArrowUp, MoreHorizontal, Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ConfigFamilyDto, ConfigOperationInput, ConfigParameterDto, CurrentConfigDto } from "@/shared/contracts/config";
import { ANALYSIS_ROLE_LABELS_FA } from "@/shared/contracts/config";
import { faCount, useApplyConfigOps } from "@/hooks/use-config";
import { EmptyState, Spinner } from "@/components/app/ui-bits";
import { ArchivedBadge, DataTypeBadge, DefVersionBadge, MonoKey } from "./config-bits";
import { FamilyDialog } from "./family-dialog";
import { ParameterDialog } from "./parameter-dialog";

export function FamiliesTab({
  projectId,
  config,
  canWrite,
}: {
  projectId: string;
  config: CurrentConfigDto;
  canWrite: boolean;
}) {
  const apply = useApplyConfigOps(projectId);
  const [familyDialog, setFamilyDialog] = useState<{ family?: ConfigFamilyDto } | null>(null);
  const [paramDialog, setParamDialog] = useState<{ familyKey: string; familyName: string; param?: ConfigParameterDto } | null>(null);
  const [archiveFamily, setArchiveFamily] = useState<ConfigFamilyDto | null>(null);

  const families = [...config.snapshot.families].sort((a, b) => a.order - b.order);

  const runOp = (reason: string, operation: ConfigOperationInput) =>
    apply.mutate({ reason, operations: [operation] });

  if (families.length === 0) {
    return (
      <EmptyState
        title="هنوز خانواده پارامتری تعریف نشده است"
        description="خانواده‌ها گروه‌بندی منطقی پارامترها هستند (مثل مشخصات ماشین، شرایط شیفت، نرخ‌های تخصیصی). ساختار پایه از الگوی روش‌شناسی آمده است؛ خانواده سفارشی خود را اضافه کنید."
        action={
          canWrite ? (
            <Button size="sm" className="gap-2" onClick={() => setFamilyDialog({})}>
              <Plus className="size-4" aria-hidden /> خانواده جدید
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {canWrite ? (
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {faCount(families.length)} خانواده · {faCount(config.snapshot.families.reduce((n, f) => n + f.parameters.length, 0))} پارامتر
          </p>
          <Button size="sm" className="gap-2" onClick={() => setFamilyDialog({})}>
            <Plus className="size-4" aria-hidden /> خانواده جدید
          </Button>
        </div>
      ) : null}

      {families.map((family, index) => (
        <FamilyCard
          key={family.stableKey}
          family={family}
          canWrite={canWrite}
          pending={apply.isPending}
          isFirst={index === 0}
          isLast={index === families.length - 1}
          onEdit={() => setFamilyDialog({ family })}
          onAddParam={() => setParamDialog({ familyKey: family.stableKey, familyName: family.nameFa })}
          onEditParam={(param) => setParamDialog({ familyKey: family.stableKey, familyName: family.nameFa, param })}
          onArchive={() => setArchiveFamily(family)}
          runOp={runOp}
        />
      ))}

      {familyDialog ? (
        <FamilyDialog
          projectId={projectId}
          family={familyDialog.family}
          open={true}
          onOpenChange={(o) => !o && setFamilyDialog(null)}
        />
      ) : null}
      {paramDialog ? (
        <ParameterDialog
          projectId={projectId}
          config={config}
          familyKey={paramDialog.familyKey}
          familyName={paramDialog.familyName}
          param={paramDialog.param}
          open={true}
          onOpenChange={(o) => !o && setParamDialog(null)}
        />
      ) : null}

      <AlertDialog open={!!archiveFamily} onOpenChange={(o) => !o && setArchiveFamily(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>بایگانی خانواده «{archiveFamily?.nameFa}»؟</AlertDialogTitle>
            <AlertDialogDescription>
              پارامترهای این خانواده از فرم مقدارها و نمادهای فرمول پنهان می‌شوند؛ مقدارهای ثبت‌شده و تاریخچه
              نسخه‌ها حفظ می‌شود و با «بازگردانی» قابل بازیابی است.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (archiveFamily) {
                  runOp(`بایگانی خانواده «${archiveFamily.nameFa}»`, {
                    op: "archiveFamily",
                    familyKey: archiveFamily.stableKey,
                    archived: true,
                  });
                }
                setArchiveFamily(null);
              }}
            >
              بایگانی کن
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─────────────────────── کارت خانواده ───────────────────────

function FamilyCard({
  family,
  canWrite,
  pending,
  isFirst,
  isLast,
  onEdit,
  onAddParam,
  onEditParam,
  onArchive,
  runOp,
}: {
  family: ConfigFamilyDto;
  canWrite: boolean;
  pending: boolean;
  isFirst: boolean;
  isLast: boolean;
  onEdit: () => void;
  onAddParam: () => void;
  onEditParam: (param: ConfigParameterDto) => void;
  onArchive: () => void;
  runOp: (reason: string, operation: ConfigOperationInput) => void;
}) {
  const params = family.parameters;
  const archivedCount = params.filter((p) => p.archived).length;

  return (
    <Card className={family.archived ? "opacity-75" : undefined}>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0 pb-3">
        <div className="min-w-0 space-y-1">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            <span className={family.archived ? "text-stone-500 line-through dark:text-stone-400" : undefined}>
              {family.nameFa}
            </span>
            <MonoKey value={family.stableKey} />
            {family.archived ? <ArchivedBadge /> : null}
          </CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-x-2">
            <span className="max-w-xl truncate">{family.description ?? "بدون توضیح"}</span>
            <span aria-hidden>·</span>
            <span>
              {faCount(params.length)} پارامتر{archivedCount > 0 ? ` (${faCount(archivedCount)} بایگانی)` : ""}
            </span>
          </CardDescription>
        </div>
        {canWrite ? (
          <div className="flex flex-wrap items-center gap-1" aria-label={`عملیات خانواده ${family.nameFa}`}>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={onAddParam} disabled={pending || family.archived}>
              <Plus className="size-4" aria-hidden /> افزودن پارامتر
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-11"
              onClick={() =>
                runOp(`جابه‌جایی خانواده «${family.nameFa}» به بالا`, {
                  op: "moveFamily",
                  familyKey: family.stableKey,
                  direction: "up",
                })
              }
              disabled={pending || isFirst}
              aria-label={`جابه‌جایی خانواده ${family.nameFa} به بالا`}
            >
              <ArrowUp className="size-4" aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-11"
              onClick={() =>
                runOp(`جابه‌جایی خانواده «${family.nameFa}» به پایین`, {
                  op: "moveFamily",
                  familyKey: family.stableKey,
                  direction: "down",
                })
              }
              disabled={pending || isLast}
              aria-label={`جابه‌جایی خانواده ${family.nameFa} به پایین`}
            >
              <ArrowDown className="size-4" aria-hidden />
            </Button>
            <Button variant="ghost" size="icon" className="size-11" onClick={onEdit} disabled={pending} aria-label={`ویرایش خانواده ${family.nameFa}`}>
              <Pencil className="size-4" aria-hidden />
            </Button>
            {family.archived ? (
              <Button
                variant="ghost"
                size="icon"
                className="size-11"
                onClick={() =>
                  runOp(`بازگردانی خانواده «${family.nameFa}»`, {
                    op: "archiveFamily",
                    familyKey: family.stableKey,
                    archived: false,
                  })
                }
                disabled={pending}
                aria-label={`بازگردانی خانواده ${family.nameFa}`}
              >
                <ArchiveRestore className="size-4" aria-hidden />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="size-11 text-red-600 dark:text-red-400"
                onClick={onArchive}
                disabled={pending}
                aria-label={`بایگانی خانواده ${family.nameFa}`}
              >
                <Archive className="size-4" aria-hidden />
              </Button>
            )}
          </div>
        ) : null}
      </CardHeader>
      <CardContent>
        {params.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            پارامتری در این خانواده تعریف نشده است.
            {canWrite && !family.archived ? " با «افزودن پارامتر» اولین پارامتر را بسازید." : ""}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>پارامتر</TableHead>
                  <TableHead>شناسه فنی</TableHead>
                  <TableHead>نوع داده</TableHead>
                  <TableHead className="hidden md:table-cell">نقش تحلیل</TableHead>
                  <TableHead className="hidden lg:table-cell">واحد</TableHead>
                  <TableHead className="hidden lg:table-cell">نسخه تعریف</TableHead>
                  {canWrite ? <TableHead className="w-14 text-center">عملیات</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {params.map((param, pIndex) => (
                  <TableRow key={param.stableKey} className={param.archived ? "opacity-60" : undefined}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {param.nameFa}
                          {param.required ? (
                            <span className="ms-0.5 text-red-600 dark:text-red-400" title="اجباری">
                              *
                            </span>
                          ) : null}
                          {param.archived ? <span className="ms-2"><ArchivedBadge /></span> : null}
                        </span>
                        {param.helpFa ? (
                          <span className="max-w-64 truncate text-xs text-muted-foreground" title={param.helpFa}>
                            {param.helpFa}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <MonoKey value={param.stableKey} />
                    </TableCell>
                    <TableCell>
                      <DataTypeBadge dataType={param.dataType} />
                    </TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                      {ANALYSIS_ROLE_LABELS_FA[param.analysisRole] ?? param.analysisRole}
                    </TableCell>
                    <TableCell className="hidden text-xs md:table-cell">
                      {param.unit ? (
                        <Badge variant="outline" className="font-mono text-[10px]" dir="ltr">
                          {param.unit}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <DefVersionBadge version={param.defVersion} />
                    </TableCell>
                    {canWrite ? (
                      <TableCell className="text-center">
                        <ParamRowMenu
                          param={param}
                          familyName={family.nameFa}
                          pending={pending}
                          isFirst={pIndex === 0}
                          isLast={pIndex === params.length - 1}
                          onEdit={() => onEditParam(param)}
                          runOp={runOp}
                        />
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────── منوی عملیات ردیف پارامتر ───────────────────────

function ParamRowMenu({
  param,
  familyName,
  pending,
  isFirst,
  isLast,
  onEdit,
  runOp,
}: {
  param: ConfigParameterDto;
  familyName: string;
  pending: boolean;
  isFirst: boolean;
  isLast: boolean;
  onEdit: () => void;
  runOp: (reason: string, operation: ConfigOperationInput) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-11" disabled={pending} aria-label={`عملیات پارامتر ${param.nameFa}`}>
          <MoreHorizontal className="size-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={onEdit} className="gap-2">
          <Pencil className="size-4" aria-hidden /> ویرایش پارامتر
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={isFirst}
          onClick={() =>
            runOp(`جابه‌جایی پارامتر «${param.nameFa}» به بالا`, {
              op: "moveParameter",
              parameterKey: param.stableKey,
              direction: "up",
            })
          }
          className="gap-2"
        >
          <ArrowUp className="size-4" aria-hidden /> جابه‌جایی به بالا
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={isLast}
          onClick={() =>
            runOp(`جابه‌جایی پارامتر «${param.nameFa}» به پایین`, {
              op: "moveParameter",
              parameterKey: param.stableKey,
              direction: "down",
            })
          }
          className="gap-2"
        >
          <ArrowDown className="size-4" aria-hidden /> جابه‌جایی به پایین
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {param.archived ? (
          <DropdownMenuItem
            onClick={() =>
              runOp(`بازگردانی پارامتر «${param.nameFa}» از خانواده «${familyName}»`, {
                op: "archiveParameter",
                parameterKey: param.stableKey,
                archived: false,
              })
            }
            className="gap-2"
          >
            <ArchiveRestore className="size-4" aria-hidden /> بازگردانی
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onClick={() =>
              runOp(`بایگانی پارامتر «${param.nameFa}» از خانواده «${familyName}»`, {
                op: "archiveParameter",
                parameterKey: param.stableKey,
                archived: true,
              })
            }
            className="gap-2 text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
          >
            <Archive className="size-4" aria-hidden /> بایگانی
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
