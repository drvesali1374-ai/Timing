"use client";

/**
 * هوک‌های داده فاز ۲ — کارگاه پیکربندی (فراخوانی API + نقش‌ها؛ منطق دامنه در سرور).
 * الگو مطابق use-api.ts: خطاهای سرور با پیام فارسی → toast؛ کلیدهای query پروژه‌محور.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/auth-client";
import { useSession } from "@/hooks/use-api";
import type {
  ActivityDto,
  AppliedVersionDto,
  ConfigExportPayloadDto,
  ConfigImportReportDto,
  ConfigOperationInput,
  CurrentConfigDto,
  FormulaResultDto,
  FormulaTestDto,
  FormulaValidationDto,
  FunctionCatalogDto,
  ParamValueDto,
} from "@/shared/contracts/config";

// ── شکل واقعی پاسخ /values ───────────────────────────────────
// نکته: سرور value را تودرتو به‌صورت {value, unit} برمی‌گرداند (StoredParamValue)؛
// قرارداد shared فیلد را flat تعریف کرده است — این نوع شکل واقعی سیم را مدل می‌کند.
export interface ParamValueWireDto extends Omit<ParamValueDto, "value"> {
  value: { value: number | string | boolean | null | Array<number | string | boolean | null>; unit?: string };
}

export type ParamRawValue = number | string | boolean | null | Array<number | string | boolean | null>;

/** نمایش فارسی مقدار خام (برای toast و کارت‌های نتیجه) */
export function formatParamValueFa(value: ParamRawValue | undefined, unit?: string): string {
  if (value === undefined || value === null) return "—";
  if (typeof value === "number") {
    const text = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 4 }).format(value);
    return unit ? `${text} ${unit}` : text;
  }
  if (typeof value === "boolean") return value ? "درست" : "نادرست";
  if (Array.isArray(value)) return value.length === 0 ? "—" : value.map((v) => String(v)).join("، ");
  return String(value);
}

/** عدد فارسی برای شمارنده‌ها */
export function faCount(n: number): string {
  return new Intl.NumberFormat("fa-IR").format(n);
}

// ── پیکربندی جاری ────────────────────────────────────────────

export function useProjectConfig(projectId: string | null) {
  const session = useSession();
  return useQuery({
    queryKey: ["project-config", projectId],
    queryFn: () => api<CurrentConfigDto>(`/api/projects/${projectId}/config`),
    enabled: !!session.data && !!projectId,
  });
}

function useInvalidateConfigScope(projectId: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["project-config", projectId] });
    qc.invalidateQueries({ queryKey: ["project-versions", projectId] });
    qc.invalidateQueries({ queryKey: ["project", projectId] });
    qc.invalidateQueries({ queryKey: ["projects"] });
    qc.invalidateQueries({ queryKey: ["param-values", projectId] });
    qc.invalidateQueries({ queryKey: ["formula-results", projectId] });
    qc.invalidateQueries({ queryKey: ["project-activities", projectId] });
  };
}

/**
 * اعمال دسته عملیات تغییر پیکربندی — هر فراخوانی یک نسخه append-only می‌سازد.
 * الگوی فاز ۲: هر کنش کاربر با یک عملیات و دلیل خودکار فوری ثبت می‌شود.
 */
export function useApplyConfigOps(projectId: string) {
  const invalidate = useInvalidateConfigScope(projectId);
  return useMutation({
    mutationFn: (input: { reason: string; operations: ConfigOperationInput[] }) =>
      api<AppliedVersionDto>(`/api/projects/${projectId}/config/versions`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: (applied) => {
      invalidate();
      toast.success(`تغییر پیکربندی ثبت شد — نسخه v${applied.semver} (append-only).`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── اعتبارسنجی / آزمون فرمول ─────────────────────────────────
// (بدون toast — نتیجه در پنل نمایش داده می‌شود)

export function useValidateFormula(projectId: string) {
  return useMutation({
    mutationFn: (expr: string) =>
      api<FormulaValidationDto>(`/api/projects/${projectId}/config/formulas/validate`, {
        method: "POST",
        body: JSON.stringify({ expr }),
      }),
  });
}

export interface FormulaTestInput {
  expr?: string;
  formulaKey?: string;
  sampleValues: Record<string, ParamRawValue>;
}

export function useTestFormula(projectId: string) {
  return useMutation({
    mutationFn: (input: FormulaTestInput) =>
      api<FormulaTestDto>(`/api/projects/${projectId}/config/formulas/test`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
  });
}

/** کاتالوگ توابع DSL و واحدها (راهنمای فرمول‌نویسی) */
export interface FunctionCatalogEnvelopeDto {
  functions: FunctionCatalogDto[];
  units: Array<{ symbol: string; nameFa: string; dimension: string }>;
  limits: { maxExprLength: number; maxNodeCount: number; maxAstDepth: number };
  operators: string[];
}

export function useFunctionCatalog() {
  const session = useSession();
  return useQuery({
    queryKey: ["formula-functions"],
    queryFn: () => api<FunctionCatalogEnvelopeDto>("/api/formula/functions"),
    enabled: !!session.data,
    staleTime: 10 * 60 * 1000,
  });
}

// ── مقدار پارامترها (فرم‌ساز) ────────────────────────────────

export function useParamValues(projectId: string | null) {
  const session = useSession();
  return useQuery({
    queryKey: ["param-values", projectId],
    queryFn: () => api<{ items: ParamValueWireDto[] }>(`/api/projects/${projectId}/values`).then((r) => r.items),
    enabled: !!session.data && !!projectId,
  });
}

export function useSaveParamValues(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: Array<{ stableKey: string; value: number | string | boolean | null | string[] }>) =>
      api<{ items: ParamValueWireDto[] }>(`/api/projects/${projectId}/values`, {
        method: "PUT",
        body: JSON.stringify({ values }),
      }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["param-values", projectId] });
      toast.success(`مقادیر ذخیره شد (${faCount(r.items.length)} مورد).`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── نتایج محاسبه ─────────────────────────────────────────────

export function useFormulaResults(projectId: string | null) {
  const session = useSession();
  return useQuery({
    queryKey: ["formula-results", projectId],
    queryFn: () => api<{ items: FormulaResultDto[] }>(`/api/projects/${projectId}/formulas/results`).then((r) => r.items),
    enabled: !!session.data && !!projectId,
  });
}

export function useEvaluateFormula(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formulaKey: string) =>
      api<FormulaResultDto>(`/api/projects/${projectId}/formulas/evaluate`, {
        method: "POST",
        body: JSON.stringify({ formulaKey }),
      }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["formula-results", projectId] });
      if (r.status === "valid") {
        toast.success(`«${r.formulaNameFa}» = ${formatParamValueFa(r.value, r.unit)}`);
      } else if (r.status === "incomplete") {
        toast.warning(`محاسبه «${r.formulaNameFa}» ناقص است — ${r.errors[0]?.messageFa ?? "ورودی گمشده است."}`);
      } else {
        toast.error(`محاسبه «${r.formulaNameFa}» نامعتبر است — ${r.errors[0]?.messageFa ?? "خطای ارزیابی."}`);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── فعالیت‌ها (B5) ───────────────────────────────────────────

export function useProjectActivities(projectId: string | null, includeArchived = false) {
  const session = useSession();
  return useQuery({
    queryKey: ["project-activities", projectId, includeArchived],
    queryFn: () =>
      api<{ items: ActivityDto[] }>(
        // نکته: پارامتر فقط هنگام true ارسال می‌شود (coerce.boolean رشته «false» را true می‌گیرد)
        includeArchived ? `/api/projects/${projectId}/activities?includeArchived=true` : `/api/projects/${projectId}/activities`,
      ).then((r) => r.items),
    enabled: !!session.data && !!projectId,
  });
}

export interface ActivityInput {
  stableKey?: string;
  name: string;
  description?: string | null;
  workType: string;
  vaClassification?: string | null;
  sourceOfTime?: string;
}

export function useCreateActivity(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ActivityInput) =>
      api<ActivityDto>(`/api/projects/${projectId}/activities`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: (a) => {
      qc.invalidateQueries({ queryKey: ["project-activities", projectId] });
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      toast.success(`فعالیت «${a.name}» ایجاد شد.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateActivity(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { activityId: string } & ActivityInput) => {
      const { activityId, ...patch } = input;
      return api<ActivityDto>(`/api/projects/${projectId}/activities/${activityId}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
    },
    onSuccess: (a) => {
      qc.invalidateQueries({ queryKey: ["project-activities", projectId] });
      toast.success(`فعالیت «${a.name}» به‌روزرسانی شد.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSetActivityArchived(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ activityId, archived }: { activityId: string; archived: boolean }) =>
      api<ActivityDto>(`/api/projects/${projectId}/activities/${activityId}`, {
        method: "PATCH",
        body: JSON.stringify({ archived }),
      }),
    onSuccess: (a) => {
      qc.invalidateQueries({ queryKey: ["project-activities", projectId] });
      toast.success(a.archived ? `فعالیت «${a.name}» بایگانی شد.` : `فعالیت «${a.name}» بازگردانی شد.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── خروجی / درون‌ریزی پیکربندی ───────────────────────────────

export function useExportConfig(projectId: string) {
  return useMutation({
    mutationFn: async (): Promise<ConfigExportPayloadDto> => {
      const payload = await api<ConfigExportPayloadDto>(`/api/projects/${projectId}/config/export`);
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${payload.projectCode}-config-v${payload.configSemver}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      return payload;
    },
    onSuccess: (p) => toast.success(`خروجی پیکربندی «${p.projectTitle}» (v${p.configSemver}) دانلود شد.`),
    onError: (e: Error) => toast.error(e.message),
  });
}

/**
 * فراخوانی import — نکته سیم: گزارش «نامعتبر» با وضعیت ۴۲۲ و بدنه=گزارش می‌آید
 * (نه پاکت خطای استاندارد)؛ این تابع هر دو حالت را به گزارش تبدیل می‌کند.
 */
async function postImport(
  projectId: string,
  payload: unknown,
  dryRun: boolean,
  reason: string,
): Promise<ConfigImportReportDto> {
  const res = await fetch(`/api/projects/${projectId}/config/import`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload, dryRun, reason }),
  });
  const data: unknown = await res.json().catch(() => null);
  const report = data as Partial<ConfigImportReportDto> | null;
  if (res.ok || (res.status === 422 && report && typeof report.valid === "boolean")) {
    return report as ConfigImportReportDto;
  }
  throw new Error((data as { error?: { message?: string } })?.error?.message ?? `خطای سرور (${res.status})`);
}

export function useImportConfig(projectId: string) {
  const invalidate = useInvalidateConfigScope(projectId);
  return useMutation({
    mutationFn: (input: { payload: unknown; dryRun: boolean; reason: string }) =>
      postImport(projectId, input.payload, input.dryRun, input.reason),
    onSuccess: (report, input) => {
      if (input.dryRun) return; // گزارش بررسی در دیالوگ نمایش داده می‌شود
      if (report.applied) {
        invalidate();
        toast.success(`پیکربندی درون‌ریزی و اعمال شد — نسخه v${report.applied.semver}.`);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
