"use client";

/**
 * تب سناریوها — فهرست + ایجاد سناریو + ویرایش ورودی‌های B10 (بند ۱/۵).
 * ورودی‌ها: مبنای زمان، تاکت (مستقیم/تقاضا)، سقف ایستگاه، وزن اهداف،
 * بازتنظیم زمان فعالیت‌ها و تخصیص وضع موجود (مرجع مقایسه).
 */

import { useMemo, useState } from "react";
import { Plus, Settings2, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { BalanceOverviewDto, BalanceScenarioDto, BalanceScenarioInputs } from "@/shared/contracts/balance";
import { TIME_BASES, TIME_BASIS_LABELS_FA } from "@/shared/balance/types";
import { useCreateBalanceScenario, useUpdateBalanceScenario } from "@/hooks/use-balance";
import { faDigits, faSeconds, StatusChip } from "./balance-bits";

interface ScenariosTabProps {
  projectId: string;
  overview: BalanceOverviewDto | undefined;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/** ورودی تاکت — دو حالت: مستقیم (ثانیه) یا از تقاضا (تقاضا/شیفت/دقایق شیفت) */
function TaktFields({ value, onChange }: { value: BalanceScenarioInputs["takt"]; onChange: (t: BalanceScenarioInputs["takt"]) => void }) {
  const [mode, setMode] = useState<"direct" | "demand">(value.taktMs != null ? "direct" : "demand");

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={mode === "direct" ? "secondary" : "outline"}
          onClick={() => {
            setMode("direct");
            onChange({ ...value, taktMs: value.taktMs ?? 60000, demandUnits: null, netAvailableMsPerShift: null, shiftsPerPeriod: null });
          }}
        >
          تاکت مستقیم
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "demand" ? "secondary" : "outline"}
          onClick={() => {
            setMode("demand");
            onChange({ ...value, taktMs: null, demandUnits: value.demandUnits ?? 480, netAvailableMsPerShift: value.netAvailableMsPerShift ?? 27000 * 1000, shiftsPerPeriod: value.shiftsPerPeriod ?? 2 });
          }}
        >
          از تقاضا (Takt = زمان در دسترس ÷ تقاضا)
        </Button>
      </div>

      {mode === "direct" ? (
        <div className="grid gap-1.5">
          <Label htmlFor="takt-sec" className="text-xs">تاکت‌تایم (ثانیه)</Label>
          <Input
            id="takt-sec"
            type="number"
            min={1}
            step="0.1"
            value={value.taktMs != null ? value.taktMs / 1000 : ""}
            onChange={(e) => {
              const sec = Number.parseFloat(e.target.value);
              onChange({ ...value, taktMs: Number.isFinite(sec) && sec > 0 ? Math.round(sec * 1000) : null });
            }}
          />
          <p className="text-[10px] text-muted-foreground">فاصله زمانی بین تولید دو واحد متوالی — هدف تولید بر زمان خالص در دسترس.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="grid gap-1.5">
            <Label className="text-xs">تقاضا (واحد در دوره)</Label>
            <Input
              type="number" min={1} step={1}
              value={value.demandUnits ?? ""}
              onChange={(e) => {
                const v = Number.parseFloat(e.target.value);
                onChange({ ...value, demandUnits: Number.isFinite(v) && v > 0 ? v : null });
              }}
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">زمان خالص هر شیفت (دقیقه)</Label>
            <Input
              type="number" min={1} step={1}
              value={value.netAvailableMsPerShift != null ? value.netAvailableMsPerShift / 60000 : ""}
              onChange={(e) => {
                const v = Number.parseFloat(e.target.value);
                onChange({ ...value, netAvailableMsPerShift: Number.isFinite(v) && v > 0 ? Math.round(v * 60000) : null });
              }}
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">تعداد شیفت در دوره</Label>
            <Input
              type="number" min={1} max={30} step={1}
              value={value.shiftsPerPeriod ?? ""}
              onChange={(e) => {
                const v = Number.parseInt(e.target.value, 10);
                onChange({ ...value, shiftsPerPeriod: Number.isFinite(v) && v > 0 ? v : null });
              }}
            />
          </div>
          {value.demandUnits && value.netAvailableMsPerShift && value.shiftsPerPeriod ? (
            <p className="text-[10px] text-muted-foreground sm:col-span-3">
              تاکت محاسبه‌شده: {faSeconds((value.netAvailableMsPerShift * value.shiftsPerPeriod) / value.demandUnits)} ثانیه
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

function defaultInputs(): BalanceScenarioInputs {
  return {
    timeBasis: "standard",
    takt: { taktMs: 60000, demandUnits: null, netAvailableMsPerShift: null, shiftsPerPeriod: null },
    maxStations: null,
    objectives: { minimizeStations: 0.4, smoothLoad: 0.4, minChanges: 0.2 },
    activityTimeOverrides: {},
    referenceAssignment: null,
  };
}

function InputsForm({
  overview,
  value,
  onChange,
}: {
  overview: BalanceOverviewDto | undefined;
  value: BalanceScenarioInputs;
  onChange: (v: BalanceScenarioInputs) => void;
}) {
  const [overrideId, setOverrideId] = useState("");
  const [overrideSec, setOverrideSec] = useState("");
  const withTime = overview?.readiness.activitiesWithTime[value.timeBasis] ?? 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-1.5">
        <Label className="text-xs">مبنای زمان فعالیت‌ها (بند ۱ — تفکیک زمان‌ها)</Label>
        <Select value={value.timeBasis} onValueChange={(v) => onChange({ ...value, timeBasis: v as BalanceScenarioInputs["timeBasis"] })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {TIME_BASES.map((b) => (
              <SelectItem key={b} value={b}>{TIME_BASIS_LABELS_FA[b]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[10px] text-muted-foreground">
          {faDigits(withTime)} از {faDigits(overview?.readiness.activitiesActive ?? 0)} فعالیت روی این مبنا زمان معتبر دارد.
          {value.timeBasis === "override" ? " — برای هر فعالیت باید مقدار بازتنظیم ثبت شود." : ""}
        </p>
      </div>

      <TaktFields value={value.takt} onChange={(t) => onChange({ ...value, takt: t })} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label className="text-xs">سقف تعداد ایستگاه (اختیاری — محدودیت فضایی)</Label>
          <div className="flex items-center gap-2">
            <Switch
              checked={value.maxStations !== null}
              onCheckedChange={(on) => onChange({ ...value, maxStations: on ? 8 : null })}
            />
            {value.maxStations !== null ? (
              <Input
                type="number" min={1} max={200} className="w-24"
                value={value.maxStations}
                onChange={(e) => {
                  const v = Number.parseInt(e.target.value, 10);
                  onChange({ ...value, maxStations: Number.isFinite(v) && v >= 1 ? v : 1 });
                }}
              />
            ) : (
              <span className="text-xs text-muted-foreground">نامحدود</span>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium">وزن اهداف (بند ۵ — شفاف و قابل تنظیم؛ مجموع ≠ لازم نیست، نرمال می‌شود)</p>
        {(
          [
            ["minimizeStations", "کمینه‌سازی تعداد ایستگاه"],
            ["smoothLoad", "یکنواختی بار ایستگاه‌ها"],
            ["minChanges", "کمینه‌سازی تغییر نسبت به وضع موجود"],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="flex items-center gap-3">
            <span className="w-44 shrink-0 text-xs">{label}</span>
            <Slider
              className="flex-1"
              min={0}
              max={1}
              step={0.05}
              value={[value.objectives[key]]}
              onValueChange={([v]) => onChange({ ...value, objectives: { ...value.objectives, [key]: v } })}
            />
            <span className="w-10 text-right text-xs tabular-nums">{faDigits(value.objectives[key].toFixed(2))}</span>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium">بازتنظیم دستی زمان فعالیت‌ها (ms ← ثانیه) — اولویت بر تحلیل</p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="grid gap-1">
            <Label className="text-[10px]">فعالیت</Label>
            <Select value={overrideId} onValueChange={setOverrideId}>
              <SelectTrigger className="w-56"><SelectValue placeholder="انتخاب فعالیت…" /></SelectTrigger>
              <SelectContent className="max-h-64">
                {(overview?.activities ?? []).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.id} — {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label className="text-[10px]">زمان (ثانیه)</Label>
            <Input type="number" min={0} step="0.1" className="w-28" value={overrideSec} onChange={(e) => setOverrideSec(e.target.value)} />
          </div>
          <Button
            type="button" size="sm" variant="outline"
            disabled={!overrideId || !Number.isFinite(Number.parseFloat(overrideSec))}
            onClick={() => {
              const sec = Number.parseFloat(overrideSec);
              if (!overrideId || !Number.isFinite(sec)) return;
              onChange({ ...value, activityTimeOverrides: { ...value.activityTimeOverrides, [overrideId]: Math.round(sec * 1000) } });
              setOverrideId("");
              setOverrideSec("");
            }}
          >
            افزودن
          </Button>
        </div>
        {Object.keys(value.activityTimeOverrides).length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(value.activityTimeOverrides).map(([id, ms]) => (
              <Badge key={id} variant="secondary" className="gap-1 text-[10px]">
                {id}: {faSeconds(ms)}ث
                <button
                  type="button"
                  aria-label={`حذف بازتنظیم ${id}`}
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    const next = { ...value.activityTimeOverrides };
                    delete next[id];
                    onChange({ ...value, activityTimeOverrides: next });
                  }}
                >
                  ×
                </button>
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ScenarioInputsSummary({ inputs, taktMs }: { inputs: BalanceScenarioInputs; taktMs?: number }) {
  return (
    <div className="flex flex-wrap gap-1.5 text-[10px]">
      <Badge variant="outline">{TIME_BASIS_LABELS_FA[inputs.timeBasis]}</Badge>
      <Badge variant="outline">تاکت {taktMs != null ? faSeconds(taktMs) : "—"}ث</Badge>
      {inputs.maxStations != null ? <Badge variant="outline">سقف {faDigits(inputs.maxStations)} ایستگاه</Badge> : null}
      {Object.keys(inputs.activityTimeOverrides).length > 0 ? (
        <Badge variant="outline">{faDigits(Object.keys(inputs.activityTimeOverrides).length)} بازتنظیم زمان</Badge>
      ) : null}
      {inputs.referenceAssignment ? <Badge variant="outline">مرجع وضع موجود</Badge> : null}
    </div>
  );
}

export function ScenariosTab({ projectId, overview, selectedId, onSelect }: ScenariosTabProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [inputs, setInputs] = useState<BalanceScenarioInputs>(defaultInputs());
  const [notes, setNotes] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editInputs, setEditInputs] = useState<BalanceScenarioInputs | null>(null);

  const create = useCreateBalanceScenario(projectId);
  const update = useUpdateBalanceScenario(projectId, editingId);

  const scenarios = overview?.scenarios ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          هر سناریو یک مجموعه ورودی B10 است (تاکت/مبنای زمان/وزن اهداف/بازتنظیم‌ها)؛ هر اجرا یا تغییر دستی به‌صورت تاریخچه append-only ذخیره می‌شود.
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" size="sm">
              <Plus className="size-4" aria-hidden /> سناریوی جدید
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>سناریوی بالانس جدید</DialogTitle>
              <DialogDescription>ورودی‌ها را تعیین کنید — اعتبارسنجی همان لحظه انجام می‌شود.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">نام سناریو</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً: خط مونتاژ — شیفت دو — تقاضای روزانه ۴۸۰" />
              </div>
              <div className="max-h-[50vh] overflow-y-auto pe-1">
                <InputsForm overview={overview} value={inputs} onChange={setInputs} />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">یادداشت (اختیاری)</Label>
                <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>انصراف</Button>
              <Button
                disabled={!name.trim() || create.isPending}
                onClick={async () => {
                  await create.mutateAsync({ name: name.trim(), inputs, notes: notes.trim() || null });
                  setOpen(false);
                  setName("");
                  setNotes("");
                  setInputs(defaultInputs());
                }}
              >
                {create.isPending ? "در حال ایجاد…" : "ایجاد سناریو"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {scenarios.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            هنوز سناریویی ساخته نشده است — «سناریوی جدید» را بزنید.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {scenarios.map((s) => (
            <ScenarioCard
              key={s.id}
              scenario={s}
              overview={overview}
              selected={s.id === selectedId}
              onSelect={() => onSelect(s.id)}
              onEdit={() => {
                setEditingId(s.id);
                setEditInputs(s.inputs);
              }}
              onArchive={() => void update.mutate({ status: s.status === "archived" ? "active" : "archived" })}
              editState={{ update, editingId, editInputs, setEditInputs, closeEdit: () => setEditingId(null) }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ScenarioCard({
  scenario,
  overview,
  selected,
  onSelect,
  onEdit,
  onArchive,
  editState,
}: {
  scenario: BalanceScenarioDto;
  overview: BalanceOverviewDto | undefined;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onArchive: () => void;
  editState: {
    update: ReturnType<typeof useUpdateBalanceScenario>;
    editingId: string | null;
    editInputs: BalanceScenarioInputs | null;
    setEditInputs: (v: BalanceScenarioInputs) => void;
    closeEdit: () => void;
  };
}) {
  const isEditing = editState.editingId === scenario.id;
  return (
    <Card className={cn("cursor-pointer transition-colors", selected ? "border-primary ring-1 ring-primary" : "hover:border-muted-foreground/30")} onClick={onSelect}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm">{scenario.name}</CardTitle>
          <div className="flex items-center gap-1.5">
            {scenario.status === "archived" ? <Badge variant="outline">بایگانی</Badge> : null}
            {scenario.currentResult ? <StatusChip status={scenario.currentResult.status} /> : null}
          </div>
        </div>
        <ScenarioInputsSummary inputs={scenario.inputs} taktMs={scenario.currentResult ? undefined : undefined} />
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {scenario.currentResult ? (
          <p className="text-[11px] text-muted-foreground">
            نتیجه جاری: {scenario.currentResult.algorithmLabelFa} — {faDigits(scenario.currentResult.metrics.stationCount)} ایستگاه ·
            راندمان {faDigits(scenario.currentResult.metrics.efficiencyPct?.toFixed(1) ?? "—")}٪ · {faDigits(scenario.resultCount)} نتیجه در تاریخچه
          </p>
        ) : (
          <p className="text-[11px] text-muted-foreground">بدون نتیجه — الگوریتمی اجرا کنید.</p>
        )}

        <div className="flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
          {scenario.status === "active" ? (
            <>
              <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px]" onClick={onEdit}>
                <Settings2 className="size-3" aria-hidden /> ورودی‌ها
              </Button>
              <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px]" onClick={onArchive}>
                <Archive className="size-3" aria-hidden /> بایگانی
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px]" onClick={onArchive}>
              بازیابی از بایگانی
            </Button>
          )}
        </div>

        {isEditing && editState.editInputs ? (
          <div className="space-y-3 rounded-lg border bg-muted/40 p-3" onClick={(e) => e.stopPropagation()}>
            <p className="text-xs font-medium">ویرایش ورودی‌های سناریو</p>
            <InputsForm overview={overview} value={editState.editInputs} onChange={editState.setEditInputs} />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={editState.closeEdit}>انصراف</Button>
              <Button
                size="sm"
                disabled={editState.update.isPending}
                onClick={async () => {
                  if (!editState.editInputs) return;
                  await editState.update.mutateAsync({ inputs: editState.editInputs });
                  editState.closeEdit();
                }}
              >
                ذخیره ورودی‌ها
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
