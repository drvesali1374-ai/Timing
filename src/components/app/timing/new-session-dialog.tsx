"use client";

/**
 * دیالوگ ایجاد جلسه زمان‌سنجی (فاز ۴ — بند ۷):
 * انتخاب روش (پیش‌فرض پروفایل)، منبع عناصر (فعالیت‌ها/نمودار فاز ۳/دستی)،
 * پیش‌روی عنصر، ناظر و تلورانس. ثبت زمان به نمودار وابسته نیست (منابع جایگزین).
 */

import { useMemo, useState } from "react";
import { Loader2, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/auth-client";
import { useSession } from "@/hooks/use-api";
import { useProjectActivities } from "@/hooks/use-config";
import { useDiagrams } from "@/hooks/use-diagrams";
import type { DiagramDetailDto } from "@/shared/contracts/diagrams";
import { TIMING_METHODS, TIMING_METHOD_LABELS_FA, TIMING_METHOD_NOTES_FA, type TimingMethod } from "@/shared/timing/types";
import { faDigits } from "./timing-bits";
import type { CreateTimingSessionInput, ElementSourceDto } from "@/shared/contracts/timing";

interface NewSessionDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (sessionId: string) => void;
  defaultMethod: TimingMethod;
}

interface ElementDraft {
  key: string;
  name: string;
  activityStableKey?: string;
  order: number;
}

export function NewSessionDialog({ projectId, open, onOpenChange, onCreated, defaultMethod }: NewSessionDialogProps) {
  const session = useSession();
  const [method, setMethod] = useState<TimingMethod>(defaultMethod);
  const [elementSource, setElementSource] = useState<ElementSourceDto>("activities");
  const [diagramId, setDiagramId] = useState<string>("");
  const [manualText, setManualText] = useState("");
  const [observer, setObserver] = useState("");
  const [advanceMode, setAdvanceMode] = useState<"manual" | "auto">("auto");
  const [tolerancePct, setTolerancePct] = useState(5);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activities = useProjectActivities(projectId, false);
  const diagrams = useDiagrams(projectId, false);

  // نام کاربر به‌عنوان ناظر پیش‌فرض
  const defaultObserver = session.data?.name ?? session.data?.email ?? "";
  const effectiveObserver = observer || defaultObserver;

  // عناصر بر اساس منبع
  const elements: ElementDraft[] = useMemo(() => {
    if (elementSource === "manual") {
      const lines = manualText
        .split(/[\n,،؛;]+/)
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, 200);
      return lines.map((name, i) => ({ key: `m${i + 1}`, name, order: i + 1 }));
    }
    if (elementSource === "activities") {
      const items = activities.data ?? [];
      return items.map((a, i) => ({ key: a.stableKey, name: a.name, activityStableKey: a.stableKey, order: i + 1 }));
    }
    return []; // diagram — هنگام انتخاب نمودار جداگانه پر می‌شود
  }, [elementSource, manualText, activities.data]);

  const [diagramElements, setDiagramElements] = useState<ElementDraft[] | null>(null);
  const [diagramLoading, setDiagramLoading] = useState(false);

  async function pickDiagram(id: string) {
    setDiagramId(id);
    setDiagramElements(null);
    if (!id) return;
    setDiagramLoading(true);
    try {
      const detail = await api<DiagramDetailDto>(`/api/projects/${projectId}/diagrams/${id}`);
      // گره‌های دارای ارجاع فعالیت به ترتیب گام — بدون کپی داده (فقط ارجاع + نام نمایشی)
      const nodes = (detail.doc?.nodes ?? [])
        .filter((n) => n.activityStableKey)
        .sort((a, b) => (a.stepNo ?? 0) - (b.stepNo ?? 0));
      setDiagramElements(
        nodes.map((n, i) => ({
          key: n.activityStableKey as string,
          name: n.title || n.activityStableKey || `گام ${i + 1}`,
          activityStableKey: n.activityStableKey ?? undefined,
          order: i + 1,
        })),
      );
    } catch {
      setDiagramElements([]);
    } finally {
      setDiagramLoading(false);
    }
  }

  const effectiveElements = elementSource === "diagram" ? (diagramElements ?? []) : elements;
  const canSubmit = effectiveObserver.trim().length > 0 && effectiveElements.length > 0 && !submitting;

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      const body: CreateTimingSessionInput = {
        method,
        observer: effectiveObserver.trim(),
        elements: effectiveElements,
        elementAdvanceMode: advanceMode,
        tolerancePct,
        elementSource,
        ...(elementSource === "diagram" && diagramId ? { diagramRefId: diagramId, diagramRefNote: "عناصر از گره‌های دارای ارجاع فعالیت نمودار" } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      };
      const res = await fetch(`/api/projects/${projectId}/timing/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => null)) as { id?: string; error?: { message?: string } } | null;
      if (!res.ok || !data?.id) {
        throw new Error(data?.error?.message ?? "ایجاد جلسه ناموفق بود.");
      }
      onCreated(data.id);
      onOpenChange(false);
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ایجاد جلسه ناموفق بود.");
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setMethod(defaultMethod);
    setElementSource("activities");
    setDiagramId("");
    setDiagramElements(null);
    setManualText("");
    setAdvanceMode("auto");
    setNotes("");
    setError(null);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Timer className="size-5 text-primary" aria-hidden /> جلسه زمان‌سنجی جدید
          </DialogTitle>
          <DialogDescription>
            عناصر جلسه هنگام ایجاد ثابت می‌شوند (پایداری تاریخی رکورد)؛ ثبت زمان به نمودار وابسته نیست.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* روش */}
          <div className="space-y-1.5">
            <Label className="text-xs">روش زمان‌سنجی</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as TimingMethod)}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMING_METHODS.map((m) => (
                  <SelectItem key={m} value={m} className="text-xs">
                    {TIMING_METHOD_LABELS_FA[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] leading-5 text-muted-foreground">{TIMING_METHOD_NOTES_FA[method]}</p>
          </div>

          {/* منبع عناصر */}
          <div className="space-y-2">
            <Label className="text-xs">منبع عناصر کار</Label>
            <RadioGroup
              value={elementSource}
              onValueChange={(v) => {
                setElementSource(v as ElementSourceDto);
                if (v !== "diagram") setDiagramElements(null);
              }}
              className="grid grid-cols-3 gap-2"
            >
              {[
                { v: "activities", label: "فعالیت‌ها" },
                { v: "diagram", label: "نمودار فرایندی" },
                { v: "manual", label: "دستی سریع" },
              ].map((opt) => (
                <Label
                  key={opt.v}
                  className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-normal has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/10"
                >
                  <RadioGroupItem value={opt.v} className="sr-only" />
                  {opt.label}
                </Label>
              ))}
            </RadioGroup>

            {elementSource === "activities" ? (
              activities.isLoading ? (
                <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" aria-hidden /> بارگذاری فعالیت‌ها…
                </p>
              ) : (activities.data?.length ?? 0) === 0 ? (
                <p className="rounded-lg border border-dashed bg-muted/30 p-2.5 text-[11px] leading-5 text-muted-foreground">
                  هنوز فعالیتی تعریف نشده است. از «ورود دستی سریع» استفاده کنید یا در کارگاه پیکربندی فعالیت بسازید —
                  ثبت زمان به فعالیت/نمودار وابسته نیست.
                </p>
              ) : (
                <div className="max-h-32 overflow-y-auto rounded-lg border bg-muted/20 p-2 text-[11px] leading-5">
                  {faDigits(activities.data?.length ?? 0)} عنصر:{" "}
                  {(activities.data ?? []).slice(0, 6).map((a) => a.name).join(" · ")}
                  {(activities.data?.length ?? 0) > 6 ? " …" : ""}
                </div>
              )
            ) : null}

            {elementSource === "diagram" ? (
              <div className="space-y-1.5">
                <Select value={diagramId} onValueChange={pickDiagram}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="انتخاب نمودار…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(diagrams.data ?? []).map((d) => (
                      <SelectItem key={d.id} value={d.id} className="text-xs">
                        {d.title} ({d.kind === "opc" ? "OPC" : "FPC"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {diagramLoading ? (
                  <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" aria-hidden /> خواندن گره‌های نمودار…
                  </p>
                ) : diagramElements ? diagramElements.length === 0 ? (
                  <p className="rounded-lg border border-amber-300 bg-amber-50/60 p-2.5 text-[11px] leading-5 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                    این نمودار گرهی با ارجاع فعالیت ندارد. در طراح نمودار، گام‌ها را به فعالیت‌ها متصل کنید یا از منبع
                    دیگر استفاده کنید.
                  </p>
                ) : (
                  <div className="rounded-lg border bg-muted/20 p-2 text-[11px] leading-5">
                    {faDigits(diagramElements.length)} عنصر از نمودار:{" "}
                    {diagramElements.slice(0, 6).map((e) => e.name).join(" · ")}
                    {diagramElements.length > 6 ? " …" : ""}
                  </div>
                ) : (
                  <p className="text-[11px] leading-5 text-muted-foreground">
                    نمودارهای فاز ۳ اختیاری‌اند؛ عناصر از گره‌های دارای ارجاع فعالیت به ترتیب گام خوانده می‌شوند.
                  </p>
                )}
              </div>
            ) : null}

            {elementSource === "manual" ? (
              <Textarea
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                placeholder={"هر خط یک عنصر (یا با کاما جدا کنید):\nقرار دادن قطعه\nپرس\nبازرسی"}
                className="min-h-24 text-xs"
                dir="rtl"
              />
            ) : null}
          </div>

          {/* ناظر + پیش‌روی */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ts-observer" className="text-xs">ناظر</Label>
              <Input
                id="ts-observer"
                value={observer}
                onChange={(e) => setObserver(e.target.value)}
                placeholder={defaultObserver}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">حرکت میان عناصر</Label>
              <Select value={advanceMode} onValueChange={(v) => setAdvanceMode(v as "manual" | "auto")}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto" className="text-xs">خودکار (پیش‌روی پس از ثبت)</SelectItem>
                  <SelectItem value="manual" className="text-xs">دستی (انتخاب عنصر)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* تلورانس */}
          <div className="space-y-1.5">
            <Label htmlFor="ts-tol" className="text-xs">
              تلورانس کنترل جمع چرخه (TS-005) — {faDigits(tolerancePct)}٪
            </Label>
            <input
              id="ts-tol"
              type="range"
              min={0}
              max={20}
              step={1}
              value={tolerancePct}
              onChange={(e) => setTolerancePct(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <p className="text-[11px] leading-5 text-muted-foreground">
              فقط روش پیوسته: انحراف جمع عناصر از زمان چرخه بیش از این درصد، چرخه را «نیازمند بررسی» علامت می‌زند.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ts-notes" className="text-xs">یادداشت جلسه (اختیاری)</Label>
            <Textarea id="ts-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-16 text-xs" />
          </div>

          {error ? (
            <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-2.5 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </p>
          ) : null}

          <div className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
            <span>عناصر: {effectiveElements.length > 0 ? <Badge variant="secondary" className="font-mono">{faDigits(effectiveElements.length)}</Badge> : "—"}</span>
            <span>ناظر: {effectiveObserver || "—"}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            انصراف
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Timer className="size-4" aria-hidden />}
            ایجاد و شروع ثبت
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
