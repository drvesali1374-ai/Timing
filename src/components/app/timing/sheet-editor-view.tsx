"use client";

/**
 * ویرایشگر برگه ثبت زمان — جدول قابل‌ویرایش فعالیت × نمونه (دستورالعمل ۵٫۳).
 * ----------------------------------------------------------------
 *  - ورود مستقیم هر سلول (فرمت آزاد: 12.5 / ۱۲٫۵ / 00:12.5)
 *  - افزودن/حذف نمونه و افزودن فعالیت برگه
 *  - Paste ماتریسی از Excel با پیش‌نمایش
 *  - وقفه‌ها + وضعیت برگه (پیش‌نویس/تکمیل‌شده/نهایی‌شده) + اصلاح با دلیل
 *  - هیچ کرنومتری در کار نیست — اعداد اندازه‌گیری‌شدهٔ قبلی کاربر ثبت می‌شوند.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardPaste,
  Clock,
  FileSpreadsheet,
  PauseOctagon,
  Plus,
  RotateCcw,
  Save,
  Send,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, ErrorState, LoadingBlock, Spinner } from "@/components/app/ui-bits";
import { FieldHelp } from "@/components/app/field-help";
import { parseDurationMs, formatSecondsInput, formatDurationFa } from "@/shared/timing/parse-duration";
import { faDigits } from "./timing-bits";
import { InterruptionDialog, type InterruptionFormValue } from "./interruption-dialog";
import {
  useAddInterruption,
  useCorrectObservation,
  useManualSheet,
  useRemoveInterruption,
  useSaveSheetCells,
  useSetSheetSampleCount,
  useUpdateInterruption,
  useUpdateManualSheet,
} from "@/hooks/use-manual-sheets";
import { useProjectActivities } from "@/hooks/use-config";
import type { ManualInterruptionDto, ManualSheetDetailDto } from "@/shared/contracts/manual-study";

/** وضعیت ویرایش یک سلول */
interface CellState {
  text: string;
  parseOk: boolean;
  messageFa?: string;
  savedMs?: number | null;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  draft: "outline",
  completed: "secondary",
  finalized: "default",
};

export function SheetEditorView({
  projectId,
  sheetId,
  onBack,
}: {
  projectId: string;
  sheetId: string;
  onBack: () => void;
}) {
  const sheet = useManualSheet(projectId, sheetId);
  const activities = useProjectActivities(projectId);
  const saveCells = useSaveSheetCells(projectId);
  const setSampleCount = useSetSheetSampleCount(projectId);
  const updateSheet = useUpdateManualSheet(projectId);
  const addInterruption = useAddInterruption(projectId);
  const updateInterruption = useUpdateInterruption(projectId);
  const removeInterruption = useRemoveInterruption(projectId);
  const correctObs = useCorrectObservation(projectId);

  // state محلی سلول‌ها: `${activityId}:${sampleIndex}` → متن و اعتبارسنجی
  const [cells, setCells] = useState<Record<string, CellState>>({});
  // ترتیب ردیف‌های برگه (فعالیت‌های موجود در برگه)
  const [rowActivityIds, setRowActivityIds] = useState<string[]>([]);
  const [sampleCols, setSampleCols] = useState(0);
  const [addActivityOpen, setAddActivityOpen] = useState(false);
  const [addActivityId, setAddActivityId] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pastePreview, setPastePreview] = useState<string[][] | null>(null);
  const [interruptionOpen, setInterruptionOpen] = useState(false);
  const [editingInterruption, setEditingInterruption] = useState<ManualInterruptionDto | null>(null);
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [finalizeReason, setFinalizeReason] = useState("");
  const [revertOpen, setRevertOpen] = useState(false);
  const [revertReason, setRevertReason] = useState("");
  const [correctCell, setCorrectCell] = useState<{ activityId: string; sampleIndex: number; observationId: string; currentMs: number } | null>(null);
  const [correctValue, setCorrectValue] = useState("");
  const [correctReason, setCorrectReason] = useState("");

  const data = sheet.data;

  // همگام‌سازی state محلی با داده سرور (بارگذاری/بازخوانی)
  const sheetRevRef = useRef<string | null>(null);
  useEffect(() => {
    if (!data) return;
    const rev = `${data.id}:${data.updatedAt}:${data.observationCount}`;
    if (sheetRevRef.current === rev) return;
    sheetRevRef.current = rev;
    const next: Record<string, CellState> = {};
    for (const row of data.rows) {
      const cellMap = new Map(row.cells.map((c) => [c.sampleIndex, c]));
      for (let s = 1; s <= data.sampleCount; s++) {
        const c = cellMap.get(s);
        const key = `${row.activityId}:${s}`;
        if (c) {
          next[key] = { text: formatSecondsInput(c.durationMs), parseOk: true, savedMs: c.durationMs };
        } else {
          next[key] = { text: "", parseOk: true, savedMs: null };
        }
      }
    }
    setCells(next);
    setRowActivityIds(data.rows.map((r) => r.activityId));
    setSampleCols(Math.max(data.sampleCount, 5));
  }, [data]);

  const rowById = useMemo(() => {
    const m = new Map<string, ManualSheetDetailDto["rows"][number]>();
    data?.rows.forEach((r) => m.set(r.activityId, r));
    return m;
  }, [data]);

  const cellKey = (activityId: string, sample: number) => `${activityId}:${sample}`;

  const onCellChange = (activityId: string, sample: number, text: string) => {
    setCells((prev) => {
      const cur = prev[cellKey(activityId, sample)] ?? { text: "", parseOk: true };
      const trimmed = text.trim();
      if (trimmed === "") {
        return { ...prev, [cellKey(activityId, sample)]: { text, parseOk: true } };
      }
      const p = parseDurationMs(text);
      return {
        ...prev,
        [cellKey(activityId, sample)]:
          p.ok ? { text, parseOk: true, savedMs: cur.savedMs } : { text, parseOk: false, messageFa: p.messageFa, savedMs: cur.savedMs },
      };
    });
  };

  const dirtyCells = useMemo(() => {
    const list: Array<{ activityId: string; sampleIndex: number; value: string; observationId?: string }> = [];
    if (!data) return list;
    for (const row of data.rows) {
      const cellMap = new Map(row.cells.map((c) => [c.sampleIndex, c]));
      for (let s = 1; s <= sampleCols; s++) {
        const st = cells[cellKey(row.activityId, s)];
        if (!st) continue;
        const saved = cellMap.get(s);
        const text = st.text.trim();
        if (text === "") {
          if (saved) list.push({ activityId: row.activityId, sampleIndex: s, value: "" });
          continue;
        }
        const p = parseDurationMs(text);
        if (!p.ok) continue;
        if (!saved || saved.durationMs !== p.ms) {
          list.push({ activityId: row.activityId, sampleIndex: s, value: text, observationId: saved?.observationId });
        }
      }
    }
    return list;
  }, [cells, data, sampleCols]);

  const invalidCells = useMemo(() => {
    const bad: Array<{ activityId: string; sampleIndex: number; messageFa: string }> = [];
    for (const [key, st] of Object.entries(cells)) {
      if (!st.parseOk && st.text.trim() !== "") {
        const [activityId, sample] = key.split(":");
        bad.push({ activityId, sampleIndex: Number(sample), messageFa: st.messageFa ?? "مقدار نامعتبر" });
      }
    }
    return bad;
  }, [cells]);

  const isFinalized = data?.status === "finalized";
  const pending = saveCells.isPending || updateSheet.isPending || correctObs.isPending;

  const save = useCallback(() => {
    if (dirtyCells.length === 0 || invalidCells.length > 0 || isFinalized) return;
    saveCells.mutate({
      sheetId,
      cells: dirtyCells.map((c) => ({ activityId: c.activityId, sampleIndex: c.sampleIndex, value: c.value || null })),
      source: "manual",
    });
  }, [dirtyCells, invalidCells, isFinalized, saveCells, sheetId]);

  const addRow = () => {
    if (!addActivityId || !data) return;
    const exists = rowActivityIds.includes(addActivityId);
    if (!exists) setRowActivityIds((prev) => [...prev, addActivityId]);
    setAddActivityOpen(false);
    setAddActivityId("");
  };

  const removeRow = (activityId: string) => {
    if (!data || isFinalized) return;
    const toClear = data.rows
      .find((r) => r.activityId === activityId)
      ?.cells.map((c) => ({ activityId, sampleIndex: c.sampleIndex, value: "" })) ?? [];
    setRowActivityIds((prev) => prev.filter((id) => id !== activityId));
    if (toClear.length > 0) {
      saveCells.mutate({ sheetId, cells: toClear, source: "manual" });
    }
  };

  const changeSampleCount = (delta: number) => {
    const next = Math.max(0, Math.min(60, sampleCols + delta));
    if (next === sampleCols || isFinalized) return;
    if (delta < 0) {
      setSampleCount.mutate({ sheetId, sampleCount: next }, { onSuccess: () => setSampleCols(next) });
    } else {
      setSampleCols(next);
    }
  };

  // ── Paste از Excel: تجزیه ماتریس + پیش‌نمایش ──
  const parsePaste = () => {
    const lines = pasteText.split(/\r?\n/).filter((l) => l.trim() !== "");
    const matrix = lines.map((l) => l.split(/\t|;|,/).map((c) => c.trim()));
    setPastePreview(matrix.slice(0, 50));
  };

  const applyPaste = () => {
    if (!pastePreview || !data) return;
    const payload: Array<{ activityId: string; sampleIndex: number; durationMs?: number; value?: string }> = [];
    pastePreview.forEach((rowCells, i) => {
      const target = data.rows[i];
      if (!target) return;
      rowCells.forEach((raw, j) => {
        const sampleIndex = j + 1;
        if (sampleIndex > 60) return;
        if (raw === "") return;
        const p = parseDurationMs(raw);
        if (p.ok) payload.push({ activityId: target.activityId, sampleIndex, durationMs: p.ms });
      });
    });
    if (payload.length > 0) {
      saveCells.mutate({ sheetId, cells: payload, source: "paste" }, { onSuccess: () => setPasteOpen(false) });
    }
  };

  const submitInterruption = (v: InterruptionFormValue) => {
    if (editingInterruption) {
      updateInterruption.mutate(
        {
          sheetId,
          interruptionId: editingInterruption.id,
          reason: v.reason,
          reasonOther: v.reasonOther || null,
          durationValue: v.durationKnown ? v.durationValue : "",
          durationKnown: v.durationKnown,
          note: v.note,
        },
        { onSuccess: () => { setInterruptionOpen(false); setEditingInterruption(null); } },
      );
    } else {
      addInterruption.mutate(
        {
          sheetId,
          activityId: v.activityId,
          reason: v.reason,
          reasonOther: v.reasonOther || null,
          durationValue: v.durationKnown ? v.durationValue : "",
          durationKnown: v.durationKnown,
          note: v.note,
        },
        { onSuccess: () => { setInterruptionOpen(false); setEditingInterruption(null); } },
      );
    }
  };

  const submitCorrection = () => {
    if (!correctCell) return;
    correctObs.mutate(
      {
        sheetId,
        observationId: correctCell.observationId,
        value: correctValue,
        reason: correctReason,
      },
      {
        onSuccess: () => {
          setCorrectCell(null);
          setCorrectValue("");
          setCorrectReason("");
        },
      },
    );
  };

  if (sheet.isLoading) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={onBack} className="gap-2">
          <ArrowRight className="size-4" aria-hidden /> بازگشت
        </Button>
        <LoadingBlock lines={8} />
      </div>
    );
  }
  if (sheet.isError || !data) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={onBack} className="gap-2">
          <ArrowRight className="size-4" aria-hidden /> بازگشت
        </Button>
        <ErrorState message={(sheet.error as Error)?.message ?? "خطا در بارگذاری برگه."} onRetry={() => void sheet.refetch()} />
      </div>
    );
  }

  const availableActivities = (activities.data ?? []).filter(
    (a) => !a.archived && !rowActivityIds.includes(a.id) && !data.rows.some((r) => r.activityId === a.id),
  );

  return (
    <div className="space-y-4">
      {/* سربرگ برگه */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-bold">{data.title}</h1>
            <Badge variant={STATUS_VARIANT[data.status] ?? "outline"} className="text-[11px]">
              {data.statusFa}
            </Badge>
            {dirtyCells.length > 0 && !isFinalized ? (
              <Badge variant="outline" className="border-amber-500/50 text-[11px] text-amber-700 dark:text-amber-400">
                {faDigits(dirtyCells.length)} تغییر ذخیره‌نشده
              </Badge>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            {faDigits(data.rows.filter((r) => r.cells.length > 0).length)} فعالیت با داده · {faDigits(data.observationCount)} مشاهده ·{" "}
            {faDigits(data.interruptionCount)} وقفه · واحد زمان: ثانیه
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={onBack} className="gap-2">
            <ArrowRight className="size-4" aria-hidden /> بازگشت
          </Button>
          {!isFinalized ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPasteOpen(true)}
                className="gap-2"
              >
                <ClipboardPaste className="size-4" aria-hidden /> چسباندن از Excel
              </Button>
              <Button size="sm" onClick={save} disabled={pending || dirtyCells.length === 0 || invalidCells.length > 0} className="gap-2">
                {saveCells.isPending ? <Spinner /> : <Save className="size-4" aria-hidden />} ذخیره برگه
              </Button>
              {data.status === "draft" ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={data.observationCount === 0 || pending}
                  onClick={() => updateSheet.mutate({ sheetId, status: "completed" })}
                >
                  <CheckCircle2 className="size-4" aria-hidden /> علامت‌گذاری تکمیل‌شده
                </Button>
              ) : null}
              {data.status !== "finalized" ? (
                <Button
                  size="sm"
                  variant="default"
                  className="gap-2"
                  disabled={data.observationCount === 0 || pending}
                  onClick={() => setFinalizeOpen(true)}
                >
                  <Send className="size-4" aria-hidden /> ارسال به کارگاه تحلیل
                </Button>
              ) : null}
            </>
          ) : (
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setRevertOpen(true)}>
              <RotateCcw className="size-4" aria-hidden /> بازگردانی به قابل‌ویرایش
            </Button>
          )}
        </div>
      </div>

      {isFinalized ? (
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs leading-6">
          این برگه نهایی شده و داده‌هایش در کارگاه تحلیل استفاده می‌شود. برای تغییر یک مقدار، روی سلول کلیک کنید و
          «اصلاح با دلیل» را انجام دهید — اصلاح در تاریخچه ثبت می‌شود.
        </div>
      ) : invalidCells.length > 0 ? (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs leading-6 text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div>
            <strong>{faDigits(invalidCells.length)} مقدار نامعتبر:</strong>{" "}
            {invalidCells.slice(0, 3).map((c) => {
              const row = data.rows.find((r) => r.activityId === c.activityId);
              return `«${row?.activityName ?? "?"} نمونه ${faDigits(c.sampleIndex)}»: ${c.messageFa}`;
            }).join(" · ")}
            {invalidCells.length > 3 ? " …" : ""} — مقادیر نامعتبر ذخیره نمی‌شوند.
          </div>
        </div>
      ) : null}

      {/* جدول فعالیت × نمونه */}
      <Card className="overflow-hidden py-0">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 p-3 pb-0">
          <CardTitle className="flex items-center gap-2 text-sm">
            <FileSpreadsheet className="size-4 text-primary" aria-hidden /> جدول ثبت زمان‌ها
            <FieldHelp
              label="جدول ثبت زمان‌ها"
              content={{
                meaning: "هر سطر یک فعالیت و هر ستون یک نمونه (چرخه اندازه‌گیری) است — زمان‌هایی که قبلاً با کرنومتر یا ابزار اندازه گرفته‌اید را اینجا وارد کنید.",
                input: "در هر سلول، زمان آن فعالیت در آن نمونه را به ثانیه بنویسید.",
                format: "عدد ثانیه (12.5) یا دقیقه:ثانیه (00:12.5) — ارقام فارسی/لاتین و جداکننده نقطه/ویرگول پذیرفته می‌شود.",
                example: "نصب قطعه در ۵ بار اندازه‌گیری: 12.1 ، 12.5 ، 12.3 ، 12.2 ، 12.6",
                usage: "پس از «ارسال به کارگاه تحلیل»، همین داده‌ها مبنای میانگین، داده پرت، زمان نماینده/نرمال/استاندارد و بالانس خط می‌شوند.",
              }}
            />
          </CardTitle>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">نمونه‌ها: {faDigits(sampleCols)}</span>
            <Button variant="outline" size="icon-sm" onClick={() => changeSampleCount(1)} disabled={isFinalized || sampleCols >= 60} aria-label="افزودن نمونه">
              <Plus className="size-4" />
            </Button>
            <Button variant="outline" size="icon-sm" onClick={() => changeSampleCount(-1)} disabled={isFinalized || sampleCols <= 0} aria-label="حذف نمونه آخر">
              <Trash2 className="size-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto p-3">
          {data.rows.length === 0 && rowActivityIds.length === 0 ? (
            <EmptyState
              title="هنوز فعالیتی در این برگه نیست"
              description="از فعالیت‌های تعریف‌شده پروژه، سطرهای جدول را بسازید و زمان‌های اندازه‌گیری‌شده را وارد کنید."
              action={
                availableActivities.length > 0 ? (
                  <Button size="sm" onClick={() => setAddActivityOpen(true)} className="gap-2">
                    <Plus className="size-4" aria-hidden /> افزودن فعالیت
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b">
                  <th className="w-44 p-2 text-start align-bottom text-xs font-medium text-muted-foreground">
                    فعالیت
                  </th>
                  <th className="w-24 p-1.5 text-start align-bottom text-xs font-medium text-muted-foreground">ایستگاه</th>
                  {Array.from({ length: sampleCols }, (_, i) => (
                    <th key={i} className="min-w-24 p-1.5 text-center text-xs font-medium text-muted-foreground">
                      نمونه {faDigits(i + 1)}
                    </th>
                  ))}
                  <th className="w-12 p-1.5" />
                </tr>
              </thead>
              <tbody>
                {rowActivityIds.map((activityId) => {
                  const row = rowById.get(activityId);
                  const cellMap = new Map((row?.cells ?? []).map((c) => [c.sampleIndex, c]));
                  const avg = (row?.cells ?? []).filter((c) => !c.excluded).length > 0
                    ? (row?.cells ?? []).filter((c) => !c.excluded).reduce((a, c) => a + c.durationMs, 0) /
                      (row?.cells ?? []).filter((c) => !c.excluded).length
                    : null;
                  return (
                    <tr key={activityId} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="p-2 align-middle">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium leading-5">{row?.activityName ?? "—"}</span>
                          {avg != null ? (
                            <Badge variant="secondary" className="shrink-0 text-[10px] font-mono" dir="ltr">
                              ~{formatDurationFa(Math.round(avg))}
                            </Badge>
                          ) : null}
                        </div>
                      </td>
                      <td className="p-2 align-middle text-xs text-muted-foreground">{row?.stationName ?? "—"}</td>
                      {Array.from({ length: sampleCols }, (_, i) => {
                        const sample = i + 1;
                        const key = cellKey(activityId, sample);
                        const st = cells[key];
                        const saved = cellMap.get(sample);
                        const dirty =
                          st &&
                          ((st.text.trim() === "" && !!saved) ||
                            (st.text.trim() !== "" &&
                              st.parseOk &&
                              (() => {
                                const p = parseDurationMs(st.text);
                                return p.ok && (!saved || saved.durationMs !== p.ms);
                              })()));
                        return (
                          <td key={sample} className="p-1.5 align-middle">
                            {isFinalized ? (
                              <button
                                type="button"
                                onClick={() =>
                                  saved &&
                                  setCorrectCell({
                                    activityId,
                                    sampleIndex: sample,
                                    observationId: saved.observationId,
                                    currentMs: saved.durationMs,
                                  })
                                }
                                className="w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-center font-mono text-sm tabular-nums hover:border-border hover:bg-muted/40 disabled:cursor-default"
                                title={saved ? "اصلاح با دلیل" : undefined}
                                disabled={!saved}
                              >
                                {saved ? (
                                  <span className={saved.excluded ? "line-through opacity-40" : saved.corrected ? "text-amber-600 dark:text-amber-400" : ""}>
                                    {st?.text ?? formatSecondsInput(saved.durationMs)}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground/40">—</span>
                                )}
                              </button>
                            ) : (
                              <Input
                                dir="ltr"
                                className="h-8 border-transparent bg-transparent text-center font-mono text-sm tabular-nums focus-visible:border-ring focus-visible:bg-background"
                                placeholder="·"
                                value={st?.text ?? ""}
                                aria-invalid={st ? !st.parseOk : undefined}
                                onChange={(e) => onCellChange(activityId, sample, e.target.value)}
                                data-dirty={dirty ? "1" : undefined}
                              />
                            )}
                          </td>
                        );
                      })}
                      <td className="p-1.5 align-middle">
                        {!isFinalized ? (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => removeRow(activityId)}
                            aria-label={`حذف سطر ${row?.activityName ?? ""}`}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {!isFinalized && availableActivities.length > 0 ? (
            <Button variant="outline" size="sm" onClick={() => setAddActivityOpen(true)} className="mt-3 gap-2">
              <Plus className="size-4" aria-hidden /> افزودن فعالیت به برگه
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {/* وقفه‌ها */}
      <Card className="py-0">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-0">
          <CardTitle className="flex items-center gap-2 text-sm">
            <PauseOctagon className="size-4 text-primary" aria-hidden /> وقفه‌ها و یادداشت‌ها
            <FieldHelp
              label="وقفه‌ها"
              content={{
                meaning: "توقف‌هایی که هنگام اندازه‌گیری رخ داده‌اند (خرابی، کمبود قطعه، گفت‌وگو و…).",
                input: "هر وقفه را با علت و مدت ثبت کنید؛ اگر مدت را نمی‌دانید «نامشخص» را علامت بزنید.",
                example: "کمبود قطعه در نمونه ۳ برای ۴۵ ثانیه.",
                usage: "در گزارش تحلیل، وقفه‌ها جدا از زمان‌های عنصر گزارش می‌شوند و زمینه بهبود را نشان می‌دهند.",
              }}
            />
          </CardTitle>
          {!isFinalized ? (
            <Button variant="outline" size="sm" onClick={() => { setEditingInterruption(null); setInterruptionOpen(true); }} className="gap-2">
              <Plus className="size-4" aria-hidden /> ثبت وقفه
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="p-3">
          {data.interruptions.length === 0 ? (
            <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
              وقفه‌ای ثبت نشده — اگر هنگام اندازه‌گیری توقفی رخ داده، آن را با علت و مدت ثبت کنید.
            </p>
          ) : (
            <ul className="space-y-2">
              {data.interruptions.map((int) => (
                <li key={int.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2.5">
                  <div className="min-w-0 space-y-0.5">
                    <p className="flex flex-wrap items-center gap-1.5 text-sm">
                      <Badge variant="outline" className="text-[10px]">{int.reasonFa}</Badge>
                      <span className="font-mono text-xs" dir="ltr">
                        {int.durationKnown ? formatDurationFa(int.durationMs ?? 0) : "مدت نامشخص"}
                      </span>
                      {int.activityName ? <span className="text-xs text-muted-foreground">· {int.activityName}</span> : null}
                    </p>
                    {int.note ? <p className="text-xs text-muted-foreground">{int.note}</p> : null}
                  </div>
                  {!isFinalized ? (
                    <div className="flex shrink-0 gap-1">
                      <Button variant="ghost" size="sm" onClick={() => { setEditingInterruption(int); setInterruptionOpen(true); }}>
                        ویرایش
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => removeInterruption.mutate({ sheetId, interruptionId: int.id })}
                      >
                        حذف
                      </Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* دیالوگ افزودن فعالیت */}
      <Dialog open={addActivityOpen} onOpenChange={setAddActivityOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>افزودن فعالیت به برگه</DialogTitle>
            <DialogDescription>فعالیت انتخاب‌شده به‌عنوان سطر جدید جدول اضافه می‌شود.</DialogDescription>
          </DialogHeader>
          <Select value={addActivityId} onValueChange={setAddActivityId}>
            <SelectTrigger aria-label="انتخاب فعالیت">
              <SelectValue placeholder="یک فعالیت انتخاب کنید" />
            </SelectTrigger>
            <SelectContent>
              {availableActivities.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAddActivityOpen(false)}>
              انصراف
            </Button>
            <Button onClick={addRow} disabled={!addActivityId}>
              افزودن
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* دیالوگ Paste از Excel */}
      <Dialog open={pasteOpen} onOpenChange={setPasteOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>چسباندن داده از Excel</DialogTitle>
            <DialogDescription>
              داده را از Excel کپی و اینجا بچسبانید — سطرها به‌ترتیب به سطرهای جدول و ستون‌ها به نمونه‌ها نگاشت می‌شوند.
              پیش‌نمایش را بررسی و سپس تأیید کنید.
            </DialogDescription>
          </DialogHeader>
          {pastePreview ? (
            <div className="space-y-3">
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-xs">
                  <tbody>
                    {pastePreview.map((rowCells, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="bg-muted/40 p-1.5 text-[11px] text-muted-foreground">
                          {data.rows[i]?.activityName ?? `سطر ${faDigits(i + 1)} (بدون فعالیت)`}
                        </td>
                        {rowCells.map((c, j) => {
                          const p = parseDurationMs(c);
                          return (
                            <td
                              key={j}
                              className={`p-1.5 text-center font-mono tabular-nums ${c !== "" && !p.ok ? "bg-destructive/10 text-destructive" : ""}`}
                            >
                              {c === "" ? "—" : c}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">
                {pastePreview.length > data.rows.length
                  ? `فقط ${faDigits(data.rows.length)} سطر اول به فعالیت‌های موجود نگاشت می‌شود.`
                  : "مقادیر نامعتبر (قرمز) نادیده گرفته می‌شوند."}
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setPastePreview(null); setPasteText(""); }}>
                  ویرایش مجدد
                </Button>
                <Button onClick={applyPaste} disabled={saveCells.isPending} className="gap-2">
                  {saveCells.isPending ? <Spinner /> : <CheckCircle2 className="size-4" aria-hidden />} تأیید و ذخیره
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Label htmlFor="paste-area">داده کپی‌شده از Excel</Label>
              <Textarea
                id="paste-area"
                dir="ltr"
                rows={8}
                className="font-mono text-xs"
                placeholder={"12.1\t12.5\t12.3\n4.2\t4.5\t4.1\n6.2\t6.0\t6.5"}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
              />
              <div className="flex justify-end">
                <Button onClick={parsePaste} disabled={pasteText.trim() === ""} className="gap-2">
                  <ClipboardPaste className="size-4" aria-hidden /> پیش‌نمایش
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* دیالوگ نهایی‌سازی (ارسال به تحلیل) */}
      <Dialog open={finalizeOpen} onOpenChange={setFinalizeOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>ارسال برگه به کارگاه تحلیل</DialogTitle>
            <DialogDescription>
              داده‌های این برگه به تحلیل مهندسی زمان (میانگین، داده پرت، زمان نماینده/نرمال/استاندارد) اضافه می‌شود.
              پس از ارسال، تغییر مقادیر فقط با «اصلاح با دلیل» ممکن است.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="finalize-reason">دلیل (اختیاری)</Label>
            <Input
              id="finalize-reason"
              placeholder="مثال: تکمیل اندازه‌گیری روز اول"
              value={finalizeReason}
              onChange={(e) => setFinalizeReason(e.target.value)}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setFinalizeOpen(false)}>
              انصراف
            </Button>
            <Button
              onClick={() =>
                updateSheet.mutate(
                  { sheetId, status: "finalized", reason: finalizeReason || undefined },
                  { onSuccess: () => setFinalizeOpen(false) },
                )
              }
              disabled={updateSheet.isPending}
              className="gap-2"
            >
              {updateSheet.isPending ? <Spinner /> : <Send className="size-4" aria-hidden />} ارسال به تحلیل
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* دیالوگ بازگردانی */}
      <Dialog open={revertOpen} onOpenChange={setRevertOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>بازگردانی برگه به قابل‌ویرایش</DialogTitle>
            <DialogDescription>
              برگه از تحلیل خارج و دوباره قابل ویرایش می‌شود. ثبت دلیل الزامی است و در تاریخچه می‌ماند.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="revert-reason">دلیل بازگردانی *</Label>
            <Input
              id="revert-reason"
              placeholder="مثال: کشف خطای اندازه‌گیری در نمونه ۳"
              value={revertReason}
              onChange={(e) => setRevertReason(e.target.value)}
              required
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRevertOpen(false)}>
              انصراف
            </Button>
            <Button
              onClick={() =>
                updateSheet.mutate(
                  { sheetId, status: "completed", reason: revertReason },
                  { onSuccess: () => setRevertOpen(false) },
                )
              }
              disabled={updateSheet.isPending || revertReason.trim() === ""}
              className="gap-2"
            >
              {updateSheet.isPending ? <Spinner /> : <RotateCcw className="size-4" aria-hidden />} بازگردانی
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* دیالوگ اصلاح مشاهده (با دلیل) */}
      <Dialog open={correctCell !== null} onOpenChange={(o) => !o && setCorrectCell(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>اصلاح مقدار مشاهده</DialogTitle>
            <DialogDescription>
              مقدار فعلی:{" "}
              <span className="font-mono" dir="ltr">
                {correctCell ? formatDurationFa(correctCell.currentMs) : ""}
              </span>{" "}
              — مقدار جدید و دلیل اصلاح را وارد کنید؛ تغییر در تاریخچه ثبت می‌شود.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="correct-value">مقدار جدید *</Label>
              <Input
                id="correct-value"
                dir="ltr"
                className="font-mono"
                placeholder="مثال: 12.5"
                value={correctValue}
                onChange={(e) => setCorrectValue(e.target.value)}
              />
              {correctValue.trim() !== "" && !parseDurationMs(correctValue).ok ? (
                <p className="text-xs text-red-600 dark:text-red-400">{(parseDurationMs(correctValue) as { messageFa: string }).messageFa}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="correct-reason">دلیل اصلاح *</Label>
              <Input
                id="correct-reason"
                placeholder="مثال: قرائت اشتباه کرنومتر ثبت شده بود"
                value={correctReason}
                onChange={(e) => setCorrectReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCorrectCell(null)}>
              انصراف
            </Button>
            <Button
              onClick={submitCorrection}
              disabled={
                correctObs.isPending ||
                correctValue.trim() === "" ||
                !parseDurationMs(correctValue).ok ||
                correctReason.trim() === ""
              }
              className="gap-2"
            >
              {correctObs.isPending ? <Spinner /> : <Clock className="size-4" aria-hidden />} ثبت اصلاح
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* دیالوگ وقفه */}
      {interruptionOpen ? (
        <InterruptionDialog
          open={interruptionOpen}
          onOpenChange={(o) => {
            setInterruptionOpen(o);
            if (!o) setEditingInterruption(null);
          }}
          rows={data.rows}
          editing={editingInterruption}
          pending={addInterruption.isPending || updateInterruption.isPending}
          onSubmit={submitInterruption}
        />
      ) : null}
    </div>
  );
}
