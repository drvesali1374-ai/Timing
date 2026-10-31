"use client";

/**
 * ایجاد پروژه — جادوی ۳ گامی (UI_PLAN §۲٫۲):
 *  گام ۱: اطلاعات پروژه
 *  گام ۲: انتخاب پروفایل روش‌شناختی (پیش‌فرض «مطالعه عمومی زمان صنعتی» از پیش انتخاب‌شده — A2)
 *  گام ۳: اجزای پروفایل (حذف خانواده‌های اختیاری + تنظیم مقادیر پیشنهادی قابل ویرایش)
 * پیش‌نمایش کامل پروفایل پیش از ایجاد: منبع/نسخه/فرض‌ها/محدودیت‌ها/پارامترها/فرمول‌ها.
 */
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  Info,
  Layers,
  ListChecks,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useCreateProject, useProfileDetail, useProfiles } from "@/hooks/use-api";
import { projectInfoSchema } from "@/shared/validation/project";
import type { ProfileDetailDto, ProfileSummaryDto } from "@/shared/contracts/api";
import { ErrorState, LoadingBlock, LoadingCards, PageHeader, Spinner } from "./ui-bits";

interface WizardState {
  step: 1 | 2 | 3;
  info: {
    title: string;
    code: string;
    goal: string;
    location: string;
    department: string;
    line: string;
    station: string;
    product: string;
    process: string;
    responsible: string;
    shift: string;
    notes: string;
  };
  profileId: string;
  excludedFamilies: string[];
  overrides: Record<string, string | number | boolean>;
  previewProfileId: string | null;
}

const INFO_FIELDS: Array<{ key: keyof WizardState["info"]; label: string; placeholder?: string; required?: boolean }> = [
  { key: "title", label: "عنوان پروژه *", placeholder: "مثال: زمان‌سنجی خط مونتاژ A", required: true },
  { key: "code", label: "کد پروژه *", placeholder: "مثال: PRJ-001", required: true },
  { key: "goal", label: "هدف مطالعه", placeholder: "مثال: تعیین زمان استاندارد برای ظرفیت‌ریزی" },
  { key: "location", label: "محل (کارخانه/کارگاه)" },
  { key: "department", label: "بخش" },
  { key: "line", label: "خط تولید" },
  { key: "station", label: "ایستگاه" },
  { key: "product", label: "محصول" },
  { key: "process", label: "فرایند" },
  { key: "responsible", label: "مسئول مطالعه" },
  { key: "shift", label: "شیفت" },
];

export function NewProjectView({ onCreated, onCancel }: { onCreated: (id: string) => void; onCancel: () => void }) {
  const profilesQuery = useProfiles();
  const create = useCreateProject();

  const [state, setState] = useState<WizardState>({
    step: 1,
    info: {
      title: "",
      code: "",
      goal: "",
      location: "",
      department: "",
      line: "",
      station: "",
      product: "",
      process: "",
      responsible: "",
      shift: "",
      notes: "",
    },
    profileId: "", // خالی = «هنوز انتخاب صریح نشده» → پیش‌فرض A2 اعمال می‌شود
    excludedFamilies: [],
    overrides: {},
    previewProfileId: null,
  });

  // پیش‌انتخاب پروفایل پیش‌فرض (A2) — مشتق‌شده در رندر، بدون effect:
  // تا وقتی کاربر انتخاب صریح نکرده، پروفایل پیش‌فرض فهرست فعال است.
  const effectiveProfileId = useMemo(() => {
    if (state.profileId) return state.profileId;
    const list = profilesQuery.data;
    if (!list || list.length === 0) return "";
    return (list.find((p) => p.isDefault) ?? list[0]).id;
  }, [state.profileId, profilesQuery.data]);

  const selectedProfile = useMemo(
    () => profilesQuery.data?.find((p) => p.id === effectiveProfileId) ?? null,
    [profilesQuery.data, effectiveProfileId],
  );

  const detailQuery = useProfileDetail(state.step === 3 ? effectiveProfileId : null);

  const setInfo = (key: keyof WizardState["info"]) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setState((s) => ({ ...s, info: { ...s.info, [key]: e.target.value } }));

  const step1Valid = useMemo(() => {
    const r = projectInfoSchema.safeParse(state.info);
    return r.success;
  }, [state.info]);

  const goTo = (step: WizardState["step"]) => setState((s) => ({ ...s, step }));

  const submit = () => {
    create.mutate(
      {
        ...state.info,
        profileTemplateId: effectiveProfileId,
        isDemo: false,
        profileComponents: {
          excludedFamilies: state.excludedFamilies,
          parameterOverrides: Object.entries(state.overrides).map(([stableKey, value]) => ({ stableKey, value })),
        },
      },
      { onSuccess: (p) => onCreated(p.id) },
    );
  };

  if (profilesQuery.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="ایجاد پروژه جدید" />
        <LoadingCards count={3} />
      </div>
    );
  }
  if (profilesQuery.isError || !profilesQuery.data || profilesQuery.data.length === 0) {
    return <ErrorState message="فهرست پروفایل‌ها در دسترس نیست." onRetry={() => profilesQuery.refetch()} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="ایجاد پروژه جدید"
        description="در سه گام: اطلاعات پروژه ← انتخاب پروفایل روش‌شناختی ← اجزای پروفایل."
      />

      {/* نشانگر گام‌ها */}
      <ol className="flex items-center gap-2 text-xs font-medium" aria-label="گام‌های ایجاد پروژه">
        {[
          { n: 1, label: "اطلاعات پروژه", icon: Info },
          { n: 2, label: "پروفایل روش‌شناختی", icon: Sparkles },
          { n: 3, label: "اجزای پروفایل", icon: ListChecks },
        ].map((s, i) => {
          const Icon = s.icon;
          const active = state.step === s.n;
          const done = state.step > s.n;
          return (
            <li key={s.n} className="flex items-center gap-2">
              <span
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1.5",
                  active && "border-primary bg-primary text-primary-foreground",
                  done && "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
                  !active && !done && "border-border text-muted-foreground",
                )}
                aria-current={active ? "step" : undefined}
              >
                {done ? <Check className="size-3.5" aria-hidden /> : <Icon className="size-3.5" aria-hidden />}
                {s.label}
              </span>
              {i < 2 && <span className="text-muted-foreground" aria-hidden>—</span>}
            </li>
          );
        })}
      </ol>

      {/* گام ۱ */}
      {state.step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>اطلاعات پروژه</CardTitle>
            <CardDescription>داده‌های عمومی پروژه — بعداً نیز قابل ویرایش است.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              {INFO_FIELDS.map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <Label htmlFor={`np-${f.key}`}>{f.label}</Label>
                  <Input id={`np-${f.key}`} value={state.info[f.key]} onChange={setInfo(f.key)} placeholder={f.placeholder} />
                </div>
              ))}
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="np-notes">یادداشت‌ها</Label>
                <Textarea id="np-notes" rows={3} value={state.info.notes} onChange={setInfo("notes")} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* گام ۲ */}
      {state.step === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            پروفایل پیش‌فرض از پیش انتخاب شده است؛ در صورت نیاز پروفایل دیگری را انتخاب کنید یا برای مشاهده کامل جزئیات از
            «پیش‌نمایش» استفاده کنید.
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            {profilesQuery.data.map((p) => (
              <ProfileCard
                key={p.id}
                profile={p}
                selected={effectiveProfileId === p.id}
                onSelect={() => setState((s) => ({ ...s, profileId: p.id, excludedFamilies: [], overrides: {} }))}
                onPreview={() => setState((s) => ({ ...s, previewProfileId: p.id }))}
              />
            ))}
          </div>
        </div>
      )}

      {/* گام ۳ */}
      {state.step === 3 && (
        <div className="space-y-4">
          {detailQuery.isLoading || !detailQuery.data ? (
            <Card>
              <CardContent className="p-0">
                <LoadingBlock lines={6} />
              </CardContent>
            </Card>
          ) : (
            <ProfileComponents
              detail={detailQuery.data}
              excluded={state.excludedFamilies}
              overrides={state.overrides}
              onToggleFamily={(familyKey, included) =>
                setState((s) => ({
                  ...s,
                  excludedFamilies: included
                    ? s.excludedFamilies.filter((k) => k !== familyKey)
                    : [...s.excludedFamilies, familyKey],
                }))
              }
              onOverride={(paramKey, value) =>
                setState((s) => ({ ...s, overrides: { ...s.overrides, [paramKey]: value } }))
              }
            />
          )}
        </div>
      )}

      {/* ناوبری گام‌ها */}
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" onClick={state.step === 1 ? onCancel : () => goTo((state.step - 1) as WizardState["step"])}>
          {state.step === 1 ? "انصراف" : <><ArrowRight className="size-4" aria-hidden /> گام قبلی</>}
        </Button>
        <div className="flex items-center gap-2">
          {state.step === 3 ? (
            <Button onClick={submit} disabled={!step1Valid || !effectiveProfileId || create.isPending}>
              {create.isPending ? <Spinner /> : <Check className="size-4" aria-hidden />} ایجاد پروژه
            </Button>
          ) : (
            <Button
              onClick={() => goTo((state.step + 1) as WizardState["step"])}
              disabled={state.step === 1 && !step1Valid}
            >
              گام بعدی <ArrowLeft className="size-4" aria-hidden />
            </Button>
          )}
        </div>
      </div>

      {state.previewProfileId ? (
        <ProfilePreviewDialog
          profileId={state.previewProfileId}
          onClose={() => setState((s) => ({ ...s, previewProfileId: null }))}
        />
      ) : null}
    </div>
  );
}

// ─────────────────────── کارت پروفایل ───────────────────────

function ProfileCard({
  profile,
  selected,
  onSelect,
  onPreview,
}: {
  profile: ProfileSummaryDto;
  selected: boolean;
  onSelect: () => void;
  onPreview: () => void;
}) {
  return (
    <Card
      className={cn(
        "relative cursor-pointer transition-all",
        selected ? "border-primary ring-2 ring-primary/30" : "hover:border-primary/40",
      )}
      onClick={onSelect}
      role="radio"
      aria-checked={selected}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      {profile.isDefault && (
        <span className="absolute -top-2.5 right-4 z-10 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground shadow">
          پیش‌فرض — از پیش انتخاب‌شده
        </span>
      )}
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <span
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40",
              )}
              aria-hidden
            >
              {selected ? <Check className="size-3" /> : null}
            </span>
            {profile.nameFa}
          </CardTitle>
          <Badge variant="outline" className="shrink-0 font-mono text-[10px]" dir="ltr">
            v{profile.semver}
          </Badge>
        </div>
        <CardDescription className="line-clamp-3 leading-relaxed">{profile.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          <Badge variant="secondary" className="gap-1">
            <Layers className="size-3" aria-hidden /> {profile.familyCount} خانواده · {profile.parameterCount} پارامتر
          </Badge>
          <Badge variant="secondary">{profile.formulaCount} فرمول نسخه‌دار</Badge>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          <span className="font-medium">منبع:</span> {profile.source.name} — {profile.source.version}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full gap-2"
          onClick={(e) => {
            e.stopPropagation();
            onPreview();
          }}
        >
          <Eye className="size-4" aria-hidden /> پیش‌نمایش کامل (فرض‌ها، پارامترها، فرمول‌ها)
        </Button>
      </CardContent>
    </Card>
  );
}

// ─────────────────────── اجزای پروفایل (گام ۳) ───────────────────────

function ProfileComponents({
  detail,
  excluded,
  overrides,
  onToggleFamily,
  onOverride,
}: {
  detail: ProfileDetailDto;
  excluded: string[];
  overrides: Record<string, string | number | boolean>;
  onToggleFamily: (familyKey: string, included: boolean) => void;
  onOverride: (paramKey: string, value: string | number | boolean) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>اجزای پروفایل «{detail.nameFa}»</CardTitle>
        <CardDescription>
          خانواده‌های اختیاری را حذف کنید و مقادیر پیشنهادی قابل ویرایش را تنظیم کنید. پس از ایجاد، کپی مستقلی از این
          پیکربندی در پروژه ذخیره می‌شود و تغییر الگوی عمومی آن را تغییر نمی‌دهد.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {detail.content.families.map((family) => {
          const included = !excluded.includes(family.stableKey);
          return (
            <section
              key={family.stableKey}
              className={cn("rounded-lg border p-4", !included && "opacity-50")}
              aria-label={family.nameFa}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="flex items-center gap-2 font-semibold">
                    <Checkbox
                      checked={included}
                      onCheckedChange={(v) => onToggleFamily(family.stableKey, Boolean(v))}
                      aria-label={`افزودن خانواده ${family.nameFa}`}
                      disabled={!family.optionalOnCreate}
                    />
                    {family.nameFa}
                  </h3>
                  {family.description ? (
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{family.description}</p>
                  ) : null}
                </div>
                <Badge variant="outline" className="shrink-0 font-mono text-[10px]" dir="ltr">
                  {family.stableKey}
                </Badge>
              </div>
              <div className="mt-3 space-y-2.5">
                {family.parameters.map((p) => (
                  <div key={p.stableKey} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate" title={p.helpFa ?? p.description ?? p.nameFa}>
                      {p.nameFa}
                      <span className="ms-1.5 font-mono text-[10px] text-muted-foreground" dir="ltr">{p.stableKey}</span>
                    </span>
                    {p.configurableOnCreate && (p.dataType === "boolean") ? (
                      <Switch
                        checked={
                          typeof overrides[p.stableKey] === "boolean"
                            ? (overrides[p.stableKey] as boolean)
                            : Boolean(p.defaultValue ?? false)
                        }
                        onCheckedChange={(v) => onOverride(p.stableKey, v)}
                        aria-label={p.nameFa}
                      />
                    ) : p.configurableOnCreate && (p.dataType === "percent" || p.dataType === "decimal" || p.dataType === "integer") ? (
                      <span className="flex items-center gap-1">
                        <Input
                          type="number"
                          className="h-8 w-24"
                          dir="ltr"
                          min={p.min}
                          max={p.max}
                          value={
                            p.stableKey in overrides
                              ? String(overrides[p.stableKey])
                              : String(p.defaultValue ?? "")
                          }
                          onChange={(e) => onOverride(p.stableKey, Number(e.target.value))}
                          aria-label={p.nameFa}
                        />
                        {p.unit ? <span className="text-xs text-muted-foreground">{p.unit}</span> : null}
                      </span>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">{paramTypeLabel(p.dataType)}</Badge>
                    )}
                    {p.suggestionNoteFa ? (
                      <span className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        {p.suggestionNoteFa}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          );
        })}

        <Separator />
        <div className="rounded-lg border border-dashed p-3 text-xs leading-relaxed text-muted-foreground">
          <p>
            <span className="font-medium">زنجیره تحلیل فعال:</span>{" "}
            {detail.content.analysisChain.map((s, i) => (
              <span key={s.step}>
                {i > 0 && " ← "}
                {s.nameFa}
              </span>
            ))}
          </p>
          <p className="mt-1">
            <span className="font-medium">فرمول‌های نسخه‌دار:</span>{" "}
            {detail.content.formulas.map((f) => `${f.key} (${f.nameFa})`).join(" · ") || "—"}
          </p>
          <p className="mt-1">
            {detail.licenseNote}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function paramTypeLabel(t: string): string {
  const map: Record<string, string> = {
    shortText: "متن",
    longText: "متن بلند",
    integer: "عدد صحیح",
    decimal: "عدد اعشاری",
    percent: "درصد",
    ratio: "نسبت",
    duration: "زمان",
    dateTime: "تاریخ/زمان",
    boolean: "بولی",
    singleSelect: "انتخاب تکی",
    multiSelect: "انتخاب چندگانه",
    quantityWithUnit: "مقدار با واحد",
    entityRef: "ارجاع",
    computed: "محاسباتی",
  };
  return map[t] ?? t;
}

// ─────────────────────── پیش‌نمایش کامل پروفایل ───────────────────────

function ProfilePreviewDialog({ profileId, onClose }: { profileId: string; onClose: () => void }) {
  const detail = useProfileDetail(profileId);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{detail.data?.nameFa ?? "پیش‌نمایش پروفایل"}</DialogTitle>
          <DialogDescription>
            {detail.data ? `نسخه ${detail.data.semver} · ${detail.data.source.name} — ${detail.data.source.version}` : "در حال بارگذاری…"}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] pr-3">
          {detail.isLoading || !detail.data ? (
            <LoadingBlock lines={8} />
          ) : (
            <div className="space-y-4 py-2">
              <section>
                <h4 className="mb-1 font-semibold">دامنه کاربرد</h4>
                <p className="text-sm text-muted-foreground">{detail.data.scopeOfUse}</p>
              </section>
              <section>
                <h4 className="mb-1 font-semibold">فرض‌ها</h4>
                <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                  {detail.data.assumptions.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </section>
              <section>
                <h4 className="mb-1 font-semibold">محدودیت‌ها</h4>
                <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                  {detail.data.limitations.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </section>
              <section>
                <h4 className="mb-2 font-semibold">خانواده‌ها و پارامترها</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>پارامتر</TableHead>
                      <TableHead>شناسه فنی</TableHead>
                      <TableHead>نوع</TableHead>
                      <TableHead>نقش تحلیلی</TableHead>
                      <TableHead>پیش‌فرض</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.data.content.families.flatMap((f) =>
                      f.parameters.map((p) => (
                        <TableRow key={p.stableKey}>
                          <TableCell className="font-medium">{p.nameFa}</TableCell>
                          <TableCell className="font-mono text-[10px]" dir="ltr">{p.stableKey}</TableCell>
                          <TableCell>{paramTypeLabel(p.dataType)}</TableCell>
                          <TableCell className="text-xs">{p.analysisRole}</TableCell>
                          <TableCell className="text-xs">
                            {p.defaultValue !== undefined ? String(p.defaultValue) : "—"}
                            {p.unit ? ` ${p.unit}` : ""}
                          </TableCell>
                        </TableRow>
                      )),
                    )}
                  </TableBody>
                </Table>
              </section>
              <section>
                <h4 className="mb-1 font-semibold">فرمول‌های نسخه‌دار</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {detail.data.content.formulas.map((f) => (
                    <li key={f.key} className="flex items-start gap-2">
                      <Badge variant="secondary" className="mt-0.5 shrink-0 font-mono text-[10px]" dir="ltr">{f.key}</Badge>
                      <span>{f.nameFa} — {f.descriptionFa}</span>
                    </li>
                  ))}
                </ul>
              </section>
              {detail.data.licenseNote ? (
                <p className="rounded-md border border-dashed p-2 text-xs text-muted-foreground">{detail.data.licenseNote}</p>
              ) : null}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
