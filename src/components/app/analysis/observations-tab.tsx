"use client";

/**
 * تب مشاهدات — جدول کامل مشاهدات نشانه‌خورده + عملیات جداگانه علامت پرت/حذف (بند ۲ فاز ۵).
 * فیلتر بر: عنصر، جلسه، وضعیت، علامت + پارامترهای زمینه سفارشی (بند ۶).
 * حذف: دیالوگ علت الزامی؛ علامت: برچسب بدون علت اجباری. تاریخچه از ممیزی قابل بازبینی است.
 */

import { useMemo, useState } from "react";
import { AlertTriangle, CircleOff, Filter, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CYCLE_STATUS_LABELS_FA, TIMING_METHOD_LABELS_FA, type IntegrityFlag } from "@/shared/timing/types";
import type { AnalysisDto } from "@/shared/contracts/analysis";
import { INTEGRITY_FLAG_LABELS_FA } from "@/shared/timing/types";
import { useMarkObservation, useSessionContext } from "@/hooks/use-analysis";
import { faDigits, fmtSec, HonestyWarnings, MarkBadges } from "./analysis-bits";

type MarkAction = "outlier" | "exclude" | "clear";

export function ObservationsTab({ projectId, analysis, signedIn }: { projectId: string; analysis: AnalysisDto | undefined; signedIn: boolean }) {
  const markMutation = useMarkObservation(projectId);
  const contextMutation = useSessionContext(projectId);
  const [filterElement, setFilterElement] = useState<string>("all");
  const [filterSession, setFilterSession] = useState<string>("all");
  const [filterMark, setFilterMark] = useState<string>("all");
  const [contextKey, setContextKey] = useState<string>("all");
  const [contextValue, setContextValue] = useState<string>("all");

  const [dialog, setDialog] = useState<{
    elementKey: string;
    readingEventId: string;
    sessionId: string;
    cycleSeq: number;
    action: MarkAction;
    /** وضعیت فعلی علامت‌ها — برای حفظ عمل جدا در به‌روزرسانی حالت کامل */
    currentOutlier: boolean;
    currentExcluded: boolean;
  } | null>(null);
  const [reason, setReason] = useState("");

  const rows = useMemo(() => {
    if (!analysis) return [];
    const out: Array<{
      sessionId: string;
      observer: string;
      method: string;
      cycleSeq: number;
      cycleStatus: string;
      elementKey: string;
      elementName: string;
      durationMs: number;
      readingEventId: string;
      corrected: boolean;
      flags: IntegrityFlag[];
      outlierMarked: boolean;
      excluded: boolean;
      reason: string | null;
      context: Record<string, string>;
    }> = [];
    for (const el of analysis.elements) {
      for (const o of el.observations) {
        out.push({
          sessionId: o.sessionId,
          observer: o.observer,
          method: TIMING_METHOD_LABELS_FA[o.sessionMethod],
          cycleSeq: o.cycleSeq,
          cycleStatus: o.cycleStatus,
          elementKey: o.elementKey,
          elementName: o.elementName,
          durationMs: o.durationMs,
          readingEventId: o.readingEventId,
          corrected: o.corrected,
          flags: o.flags,
          outlierMarked: !!o.mark?.outlierMarked,
          excluded: !!o.mark?.excluded,
          reason: o.mark?.reason ?? null,
          context: o.sessionContext,
        });
      }
    }
    return out
      .filter((r) => (filterElement === "all" ? true : r.elementKey === filterElement))
      .filter((r) => (filterSession === "all" ? true : r.sessionId === filterSession))
      .filter((r) =>
        filterMark === "all"
          ? true
          : filterMark === "outlier"
            ? r.outlierMarked
            : filterMark === "excluded"
              ? r.excluded
              : filterMark === "suspect"
                ? r.cycleStatus === "suspect" || r.cycleStatus === "recovered"
                : true,
      )
      .filter((r) =>
        contextKey === "all" || contextValue === "all"
          ? true
          : (r.context[contextKey] ?? "") === contextValue,
      )
      .sort((a, b) => a.sessionId.localeCompare(b.sessionId) || a.cycleSeq - b.cycleSeq || a.elementKey.localeCompare(b.elementKey));
  }, [analysis, filterElement, filterSession, filterMark, contextKey, contextValue]);

  // ابعاد زمینه سفارشی موجود (study.* سفارشی session-scope)
  const contextDimensions = useMemo(() => {
    if (!analysis) return [] as string[];
    const keys = new Set<string>();
    for (const s of analysis.sessions) {
      for (const k of Object.keys(s.sessionContext)) keys.add(k);
    }
    return [...keys];
  }, [analysis]);

  const contextValueOptions = useMemo(() => {
    if (!analysis || contextKey === "all") return [] as string[];
    const values = new Set<string>();
    for (const s of analysis.sessions) {
      const v = s.sessionContext[contextKey];
      if (v) values.add(v);
    }
    return [...values];
  }, [analysis, contextKey]);

  // ثبت زمینه جلسه — برای جلسات بدون زمینه (اختیاری)
  const [contextDialog, setContextDialog] = useState<string | null>(null);
  const [contextForm, setContextForm] = useState<Record<string, string>>({});
  const profileContextParams = useMemo(() => {
    // پارامترهای زمینه قابل ثبت — از تنظیمات وابسته نیست؛ کلیدهای متعارف profile
    return [
      { stableKey: "study.operator", labelFa: "اپراتور" },
      { stableKey: "study.machine", labelFa: "ماشین/تجهیزات" },
      { stableKey: "study.shift", labelFa: "شیفت" },
      { stableKey: "study.workstation", labelFa: "ایستگاه کاری" },
    ];
  }, []);

  if (!analysis) return null;

  const openDialog = (
    action: MarkAction,
    elementKey: string,
    readingEventId: string,
    sessionId: string,
    cycleSeq: number,
    currentOutlier: boolean,
    currentExcluded: boolean,
  ) => {
    setReason("");
    setDialog({ elementKey, readingEventId, sessionId, cycleSeq, action, currentOutlier, currentExcluded });
  };

  const submitMark = async () => {
    if (!dialog) return;
    // حالت هدف — دو عمل جدا حفظ می‌شوند:
    //  علامت پرت: toggle فقط همان پرچم · حذف: فقط excluded با علت · برداشتن: هر دو خاموش
    const target =
      dialog.action === "outlier"
        ? { outlierMarked: !dialog.currentOutlier, excluded: dialog.currentExcluded }
        : dialog.action === "exclude"
          ? { outlierMarked: dialog.currentOutlier, excluded: true }
          : { outlierMarked: false, excluded: false };
    if (dialog.action === "exclude" && !reason.trim()) return; // اعتبارسنجی سمت سرور هم قفل می‌کند
    await markMutation.mutateAsync({
      sessionId: dialog.sessionId,
      readingEventId: dialog.readingEventId,
      cycleSeq: dialog.cycleSeq,
      elementKey: dialog.elementKey,
      outlierMarked: target.outlierMarked,
      excluded: target.excluded,
      reason: dialog.action === "clear" ? null : reason.trim() || null,
    });
    setDialog(null);
  };

  const submitContext = async () => {
    if (!contextDialog) return;
    const values = Object.entries(contextForm)
      .filter(([, v]) => v.trim() !== "")
      .map(([stableKey, v]) => ({ stableKey, value: v.trim() }));
    if (values.length === 0) return;
    await contextMutation.mutateAsync({ sessionId: contextDialog, values });
    setContextDialog(null);
    setContextForm({});
  };

  return (
    <div className="space-y-4">
      {/* فیلترها — بند ۶: فیلتر بر پارامترهای سفارشی */}
      <Card className="py-0">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Filter className="size-4 text-primary" aria-hidden /> فیلترها
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 p-4 pt-0 sm:grid-cols-3 lg:grid-cols-5">
          <div className="space-y-1">
            <Label className="text-[11px]">عنصر</Label>
            <Select value={filterElement} onValueChange={setFilterElement}>
              <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه ({faDigits(analysis.elements.length)})</SelectItem>
                {analysis.elements.map((e) => (
                  <SelectItem key={e.elementKey} value={e.elementKey}>{e.elementName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">جلسه</Label>
            <Select value={filterSession} onValueChange={setFilterSession}>
              <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه ({faDigits(analysis.sessions.length)})</SelectItem>
                {analysis.sessions.map((s, i) => (
                  <SelectItem key={s.sessionId} value={s.sessionId}>
                    {faDigits(i + 1)} · {s.observer} · {s.sessionContext["study.shift"] ? `شیفت ${s.sessionContext["study.shift"]}` : "بدون زمینه"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">وضعیت</Label>
            <Select value={filterMark} onValueChange={setFilterMark}>
              <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه</SelectItem>
                <SelectItem value="outlier">علامت‌شده پرت</SelectItem>
                <SelectItem value="excluded">حذف‌شده</SelectItem>
                <SelectItem value="suspect">نیازمند بررسی</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">پارامتر زمینه</Label>
            <Select value={contextKey} onValueChange={setContextKey}>
              <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه</SelectItem>
                {contextDimensions.map((k) => (
                  <SelectItem key={k} value={k}>{k}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">مقدار زمینه</Label>
            <Select value={contextValue} onValueChange={setContextValue} disabled={contextKey === "all"}>
              <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه</SelectItem>
                {contextValueOptions.map((v) => (
                  <SelectItem key={v} value={v}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* جدول مشاهدات */}
      <Card className="py-0">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
            مشاهدات خام — {faDigits(rows.length)} ردیف
            <Badge variant="secondary" className="text-[10px]">فقط جلسات نهایی‌شده</Badge>
          </CardTitle>
          <div className="flex flex-wrap gap-2 pt-1">
            {analysis.sessions.filter((s) => Object.keys(s.sessionContext).length === 0).slice(0, 3).map((s, i) => (
              <Button
                key={s.sessionId}
                size="sm"
                variant="ghost"
                className="h-7 gap-1 text-[11px]"
                disabled={!signedIn}
                onClick={() => setContextDialog(s.sessionId)}
              >
                ثبت زمینه جلسه {faDigits(i + 1)} (اپراتور/شیفت/…)
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="max-h-[520px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">چرخه</TableHead>
                  <TableHead className="text-right">عنصر</TableHead>
                  <TableHead className="text-right">مدت (s)</TableHead>
                  <TableHead className="text-right">وضعیت چرخه</TableHead>
                  <TableHead className="text-right">پرچم/اصلاح</TableHead>
                  <TableHead className="text-right">علامت‌ها</TableHead>
                  <TableHead className="text-right">عملیات (جدا)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={`${r.sessionId}-${r.readingEventId}`} className={r.excluded ? "opacity-50" : undefined}>
                    <TableCell className="py-1.5 font-mono text-xs tabular-nums">{faDigits(r.cycleSeq)}</TableCell>
                    <TableCell className="max-w-40 truncate py-1.5 text-xs" title={r.elementKey}>{r.elementName}</TableCell>
                    <TableCell className="py-1.5 font-mono text-xs tabular-nums" dir="ltr">{fmtSec(r.durationMs)}</TableCell>
                    <TableCell className="py-1.5 text-xs">
                      <Badge
                        variant="outline"
                        className={
                          r.cycleStatus === "valid"
                            ? "text-[10px] text-emerald-700"
                            : r.cycleStatus === "incomplete"
                              ? "text-[10px] text-muted-foreground"
                              : "text-[10px] text-amber-700"
                        }
                      >
                        {CYCLE_STATUS_LABELS_FA[r.cycleStatus as keyof typeof CYCLE_STATUS_LABELS_FA]}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-1.5 text-[10px] text-muted-foreground">
                      {r.corrected ? <Badge variant="outline" className="me-1 text-[9px] text-violet-700">اصلاح</Badge> : null}
                      {r.flags.map((f) => (
                        <span key={f} title={INTEGRITY_FLAG_LABELS_FA[f]} className="me-1">⚠</span>
                      ))}
                      {r.flags.length === 0 && !r.corrected ? "—" : ""}
                    </TableCell>
                    <TableCell className="py-1.5">
                      <MarkBadges outlierMarked={r.outlierMarked} excluded={r.excluded} />
                      {r.reason ? <p className="text-[9px] text-muted-foreground">{r.reason}</p> : null}
                    </TableCell>
                    <TableCell className="py-1.5">
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1 px-2 text-[10px]"
                          disabled={!signedIn || markMutation.isPending}
                          aria-label={`${r.outlierMarked ? "برداشتن علامت پرت" : "علامت‌گذاری داده پرت"} عنصر ${r.elementName} چرخه ${r.cycleSeq}`}
                          onClick={() => openDialog("outlier", r.elementKey, r.readingEventId, r.sessionId, r.cycleSeq, r.outlierMarked, r.excluded)}
                        >
                          <AlertTriangle className="size-3" aria-hidden /> {r.outlierMarked ? "برداشتن پرت" : "علامت پرت"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1 px-2 text-[10px] text-red-700 hover:text-red-800 dark:text-red-400"
                          disabled={!signedIn || markMutation.isPending}
                          aria-label={`حذف از محاسبه عنصر ${r.elementName} چرخه ${r.cycleSeq}`}
                          onClick={() => openDialog("exclude", r.elementKey, r.readingEventId, r.sessionId, r.cycleSeq, r.outlierMarked, r.excluded)}
                        >
                          <Trash2 className="size-3" aria-hidden /> حذف از محاسبه
                        </Button>
                        {(r.outlierMarked || r.excluded) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 gap-1 px-2 text-[10px]"
                            disabled={!signedIn || markMutation.isPending}
                            aria-label="برداشتن علامت‌ها"
                            onClick={() => openDialog("clear", r.elementKey, r.readingEventId, r.sessionId, r.cycleSeq, r.outlierMarked, r.excluded)}
                          >
                            <CircleOff className="size-3" aria-hidden /> برداشتن
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <HonestyWarnings
            warnings={[
              "علامت‌گذاری «داده پرت» فقط برچسب است و حذف خودکار نیست؛ «حذف از محاسبه» عملی جدا با علت الزامی است (B9).",
              "مشاهدات چرخه‌های ناتمام خودکار وارد محاسبه نمی‌شوند (داده ناقص) — در شمارش‌ها جداگانه دیده می‌شوند.",
            ]}
            className="mt-3"
          />
        </CardContent>
      </Card>

      {/* دیالوگ علامت/حذف */}
      <Dialog open={!!dialog} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog?.action === "exclude" ? "حذف مشاهده از محاسبه" : dialog?.action === "outlier" ? "علامت‌گذاری «داده پرت»" : "برداشتن علامت‌ها"}
            </DialogTitle>
            <DialogDescription>
              {dialog?.action === "exclude"
                ? "حذف از محاسبه عملی جدا از علامت‌گذاری است؛ ثبت علت الزامی است (B9) و در تاریخچه/ممیزی باقی می‌ماند."
                : dialog?.action === "outlier"
                  ? "علامت فقط «مشکوک/پرت» را برچسب می‌زند؛ مشاهده همچنان در محاسبه می‌ماند مگر جداگانه حذف شود."
                  : "هر دو علامت (پرت/حذف) برداشته می‌شود و مشاهده دوباره وارد محاسبه می‌شود."}
            </DialogDescription>
          </DialogHeader>
          {dialog?.action !== "clear" ? (
            <div className="space-y-2">
              <Label htmlFor="mark-reason">
                {dialog?.action === "exclude" ? "علت حذف (الزامی)" : "یادداشت علامت (اختیاری)"}
              </Label>
              <Input
                id="mark-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={dialog?.action === "exclude" ? "مثلاً: وقفه ثبت‌نشده در چرخه ۳" : "مثلاً: قرائت هنگام حواس‌پرتی ناظر"}
              />
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>انصراف</Button>
            <Button
              onClick={() => void submitMark()}
              disabled={markMutation.isPending || (dialog?.action === "exclude" && !reason.trim())}
            >
              {markMutation.isPending ? "در حال ثبت…" : "ثبت"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* دیالوگ زمینه جلسه */}
      <Dialog open={!!contextDialog} onOpenChange={(open) => !open && setContextDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ثبت زمینه جلسه</DialogTitle>
            <DialogDescription>
              زمینه جلسه پارامترهای سفارشی (scopeType=session) است؛ ثبت آن تحلیل را بر اساس اپراتور/شیفت/ماشین/ایستگاه فیلترپذیر می‌کند (بند ۶ فاز ۵).
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {profileContextParams.map((p) => (
              <div key={p.stableKey} className="space-y-1">
                <Label htmlFor={`ctx-${p.stableKey}`} className="text-xs">{p.labelFa}</Label>
                <Input
                  id={`ctx-${p.stableKey}`}
                  value={contextForm[p.stableKey] ?? ""}
                  onChange={(e) => setContextForm((f) => ({ ...f, [p.stableKey]: e.target.value }))}
                  placeholder={p.stableKey === "study.shift" ? "مثلاً ۱" : "—"}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContextDialog(null)}>انصراف</Button>
            <Button onClick={() => void submitContext()} disabled={contextMutation.isPending}>
              {contextMutation.isPending ? "در حال ثبت…" : "ثبت زمینه"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
