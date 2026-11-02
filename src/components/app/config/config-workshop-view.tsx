"use client";

/**
 * کارگاه پیکربندی (فاز ۲) — نمای اصلی: سربرگ + هشدار چرخه فرمول + پنج تب
 * (خانواده‌ها، فرمول‌ها، فرم و مقادیر، نتایج محاسبه، فعالیت‌ها).
 * هر تغییر ساختاری بلافاصله یک نسخه append-only با دلیل می‌سازد.
 */
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, Download, Eye, MoreHorizontal, Sparkles, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { roleCan } from "@/shared/contracts/acl";
import { PROJECT_ROLE_LABELS_FA } from "@/shared/contracts/acl";
import type { CurrentConfigDto } from "@/shared/contracts/config";
import { faCount, useExportConfig, useProjectConfig } from "@/hooks/use-config";
import { useProject } from "@/hooks/use-api";
import { ErrorState, LoadingBlock, LoadingCards, PageHeader, Spinner } from "@/components/app/ui-bits";
import { SemverBadge } from "./config-bits";
import { FamiliesTab } from "./families-tab";
import { FormulasTab } from "./formulas-tab";
import { FormValuesTab } from "./form-values-tab";
import { ResultsTab } from "./results-tab";
import { ActivitiesTab } from "./activities-tab";
import { ImportDialog } from "./import-dialog";
import { useUxMode } from "@/lib/ux-mode";

export function ConfigWorkshopView({
  projectId,
  onBack,
  onTitle,
}: {
  projectId: string;
  onBack: () => void;
  onTitle?: (title: string) => void;
}) {
  const projectQuery = useProject(projectId);
  const configQuery = useProjectConfig(projectId);
  const exportConfig = useExportConfig(projectId);

  // حالت ساده شروع از تب «فعالیت‌ها» (مسیر معمول کاربر)؛ پیشرفته از گروه‌ها.
  // تصحیح تب غیرمجاز در حالت ساده به‌صورت مشتق‌شده (بدون setState داخل effect):
  const uxMode = useUxMode();
  const [tabState, setTab] = useState(() => (useUxMode.getState().advanced ? "families" : "activities"));
  const ADVANCED_ONLY_TABS = ["families", "formulas", "results"];
  const tab = !uxMode.advanced && ADVANCED_ONLY_TABS.includes(tabState) ? "activities" : tabState;
  const [importOpen, setImportOpen] = useState(false);

  const projectData = projectQuery.data;
  useEffect(() => {
    if (projectData?.title) onTitle?.(projectData.title);
  }, [projectData?.title, onTitle]);

  if (projectQuery.isLoading) {
    return (
      <div className="space-y-6">
        <LoadingCards count={2} />
        <LoadingBlock lines={5} />
      </div>
    );
  }
  if (projectQuery.isError || !projectQuery.data) {
    return (
      <ErrorState
        message={(projectQuery.error as Error)?.message ?? "پروژه یافت نشد یا شما به آن دسترسی ندارید."}
        onRetry={onBack}
      />
    );
  }
  const project = projectQuery.data;
  const canWrite = roleCan(project.myRole ?? "viewer", "config:write");

  return (
    <div className="space-y-5">
      <PageHeader
        title="کارگاه پیکربندی"
        description={`پروژه «${project.title}» · کد ${project.code} · فرم اطلاعات، فعالیت‌ها و تنظیمات محاسبات`}
        //(actions continues)
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-2" onClick={onBack}>
              <ArrowRight className="size-4" aria-hidden /> بازگشت به پروژه
            </Button>
            {/* ابزارهای سطح کارگاه — منوی واحد؛
                ایجاد خانواده/فرمول در محل اصلی خود (تب مربوطه) انجام می‌شود (بند ۳.۳) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <MoreHorizontal className="size-4" aria-hidden /> ابزارها
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {/* دو عمل مستقل — بدون عنوان/جداکننده اضافی (دستورالعمل ۲٫۳)؛
                    کاربر با باز کردن منو مستقیماً عملیات را می‌بیند. */}
                <DropdownMenuItem
                  onClick={() => exportConfig.mutate()}
                  disabled={exportConfig.isPending}
                  className="gap-2"
                >
                  {exportConfig.isPending ? <Spinner /> : <Download className="size-4" aria-hidden />} خروجی JSON پیکربندی
                </DropdownMenuItem>
                {canWrite ? (
                  <DropdownMenuItem onClick={() => setImportOpen(true)} className="gap-2">
                    <Upload className="size-4" aria-hidden /> درون‌ریزی پیکربندی
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      {configQuery.isLoading ? (
        <LoadingBlock lines={6} />
      ) : configQuery.isError ? (
        <ErrorState message={(configQuery.error as Error)?.message ?? "خطا در بارگذاری پیکربندی."} onRetry={() => configQuery.refetch()} />
      ) : !configQuery.data ? null : (
        <ConfigTabsBody projectId={projectId} config={configQuery.data} canWrite={canWrite} tab={tab} setTab={setTab} projectRole={project.myRole} advanced={uxMode.advanced} uxMode={uxMode} />
      )}

      {/* دیالوگ سطح کارگاه — فقط درون‌ریزی (ایجاد خانواده/فرمول از تب مربوطه) */}
      {importOpen ? <ImportDialog projectId={projectId} open={true} onOpenChange={setImportOpen} /> : null}
    </div>
  );
}

// ─────────────────────── بدنه تب‌ها ───────────────────────

function ConfigTabsBody({
  projectId,
  config,
  canWrite,
  tab,
  setTab,
  projectRole,
  advanced,
  uxMode,
}: {
  projectId: string;
  config: CurrentConfigDto;
  canWrite: boolean;
  tab: string;
  setTab: (tab: string) => void;
  projectRole: string | null | undefined;
  advanced: boolean;
  uxMode: { advanced: boolean; setAdvanced: (v: boolean) => void };
}) {
  const familiesCount = config.snapshot.families.length;
  const paramsCount = config.snapshot.families.reduce((n, f) => n + f.parameters.length, 0);
  const formulasCount = config.snapshot.formulas.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {config.semver ? (
          <SemverBadge semver={config.semver} />
        ) : (
          <Badge variant="outline" className="text-muted-foreground">
            بدون نسخه فعال
          </Badge>
        )}
        <Badge variant="secondary" className="gap-1">
          {faCount(config.versionCount)} نسخه ثبت‌شده
        </Badge>
        <Badge variant="outline">
          {faCount(familiesCount)} خانواده · {faCount(paramsCount)} پارامتر
        </Badge>
        <Badge variant="outline">{faCount(formulasCount)} فرمول</Badge>
        {projectRole ? (
          <Badge variant="outline">نقش شما: {PROJECT_ROLE_LABELS_FA[projectRole as keyof typeof PROJECT_ROLE_LABELS_FA] ?? projectRole}</Badge>
        ) : null}
      </div>

      {config.formulaCycleRisk.length > 0 ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        >
          <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div className="space-y-1">
            <p className="font-medium">چرخه وابستگی فرمول‌ها شناسایی شد — محاسبه زنجیره‌های درگیر ناقص می‌ماند.</p>
            <p className="font-mono text-xs leading-relaxed" dir="ltr">
              {config.formulaCycleRisk.map((cycle) => cycle.join(" → ")).join("  |  ")}
            </p>
            <p className="text-xs">ارجاع‌های حلقوی را در تب «فرمول‌ها» بازبینی و حذف کنید.</p>
          </div>
        </div>
      ) : null}

      {!canWrite ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
          <Eye className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p className="leading-relaxed">
            نقش شما فقط خواندنی است — تغییرات پیکربندی برای ویرایشگر/مالک فعال است. همه بخش‌ها قابل مشاهده‌اند؛ دکمه‌های
            ایجاد/ویرایش/محاسبه پنهان شده‌اند.
          </p>
        </div>
      ) : null}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap">
          {/* حالت ساده (۶٫۳): تب‌های تخصصی (گروه‌ها/فرمول‌ها/نتایج) پشت «تنظیمات پیشرفته» */}
          <TabsTrigger value="activities">فعالیت‌ها</TabsTrigger>
          <TabsTrigger value="values">فرم اطلاعات</TabsTrigger>
          {advanced ? (
            <>
              <TabsTrigger value="families">گروه‌های اطلاعات و فیلدها</TabsTrigger>
              <TabsTrigger value="formulas">روش‌های محاسبه (فرمول‌ها)</TabsTrigger>
              <TabsTrigger value="results">نتایج محاسبه</TabsTrigger>
            </>
          ) : null}
        </TabsList>
        {!advanced ? (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
            <span>تنظیمات تخصصی (گروه اطلاعات، فرمول‌نویسی، نتایج) در «حالت پیشرفته» قابل دسترس است.</span>
            <Button variant="ghost" size="sm" className="h-6 gap-1 px-2 text-[11px]" onClick={() => uxMode.setAdvanced(true)}>
              <Sparkles className="size-3" aria-hidden /> نمایش تنظیمات پیشرفته
            </Button>
          </div>
        ) : null}

        <TabsContent value="families" className="mt-4 space-y-4">
          <FamiliesTab projectId={projectId} config={config} canWrite={canWrite} />
        </TabsContent>

        <TabsContent value="formulas" className="mt-4 space-y-4">
          <FormulasTab projectId={projectId} config={config} canWrite={canWrite} />
        </TabsContent>

        {/* فرم مقادیر همیشه mount می‌ماند تا پیش‌نویس کاربر هنگام جابه‌جایی تب حفظ شود */}
        <TabsContent value="values" forceMount className="mt-4 space-y-4 data-[state=inactive]:hidden">
          <FormValuesTab projectId={projectId} config={config} canWrite={canWrite} />
        </TabsContent>

        <TabsContent value="results" className="mt-4 space-y-4">
          <ResultsTab projectId={projectId} config={config} canWrite={canWrite} />
        </TabsContent>

        <TabsContent value="activities" className="mt-4 space-y-4">
          <ActivitiesTab projectId={projectId} config={config} canWrite={canWrite} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
