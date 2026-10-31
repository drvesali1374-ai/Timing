"use client";

/**
 * نمای جزئیات جلسه زمان‌سنجی — بازبینی داده خام (فاز ۴):
 *  - جدول کامل رویدادهای append-only (بدون حذف)
 *  - چرخه‌های مشتق با مدت عناصر و وضعیت TS-005
 *  - اصلاح رویداد با دلیل (correction — همراه سابقه)
 *  - خروجی خام JSON (بازیابی داده)
 */

import { useMemo, useState } from "react";
import { Download, PencilLine, ShieldQuestion } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/auth-client";
import { useSession } from "@/hooks/use-api";
import { correctableEvents } from "@/shared/timing/derive";
import { formatDurationMs, formatShortMs } from "@/shared/timing/types";
import type { ChronoEvent } from "@/shared/timing/types";
import type { TimingSessionDetailDto } from "@/shared/contracts/timing";
import { CycleStatusBadge, EventTypeBadge, IntegrityBanner, KpiCell, MethodBadge, faDigits } from "./timing-bits";

interface SessionDetailViewProps {
  projectId: string;
  sessionId: string;
  onBack: () => void;
  onOpenChronometer?: () => void; // ادامه/بازگشت به ثبت (اگر جلسه فعال است)
}

export function SessionDetailView({ projectId, sessionId, onBack, onOpenChronometer }: SessionDetailViewProps) {
  const session = useSession();
  const [correctionTarget, setCorrectionTarget] = useState<ChronoEvent | null>(null);
  const [correctionDraftId, setCorrectionDraftId] = useState<string | null>(null);
  const [newValueSec, setNewValueSec] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const detailQuery = useQuery({
    queryKey: ["timing-session", projectId, sessionId],
    queryFn: () => api<TimingSessionDetailDto>(`/api/projects/${projectId}/timing/sessions/${sessionId}`),
    enabled: !!session.data,
  });
  const detail = detailQuery.data ?? null;

  const correctable = useMemo(() => (detail ? correctableEvents(detail.events) : []), [detail]);

  async function submitCorrection() {
    if (!correctionTarget || !detail) return;
    const valueSec = Number(newValueSec.replace(",", "."));
    if (!Number.isFinite(valueSec) || valueSec < 0) {
      toast.error("مقدار اصلاحی باید عدد نامنفی (ثانیه) باشد.");
      return;
    }
    if (!reason.trim()) {
      toast.error("دلیل اصلاح الزامی است.");
      return;
    }
    setSaving(true);
    try {
      // اصلاح = رویداد جدید از طریق موتور (در نشست ثبت‌کننده) — اینجا مستقیم به سرور:
      const body = {
        events: [
          {
            clientEventId: correctionDraftId ?? crypto.randomUUID(), // پایدار در طول دیالوگ — retry بدون دوباره‌شماری
            seq: (detail.events[detail.events.length - 1]?.seq ?? 0) + 1,
            type: "correction",
            cycleNo: correctionTarget.cycleNo,
            elapsedActiveMs: correctionTarget.elapsedActiveMs,
            wallClock: new Date().toISOString(),
            correctionOf: correctionTarget.clientEventId,
            correctedValueMs: valueSec * 1000,
            correctionReason: reason.trim(),
          },
        ],
        origin: "normal",
      };
      const res = await fetch(
        `/api/projects/${projectId}/timing/sessions/${sessionId}/events`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(data?.error?.message ?? "ثبت اصلاح ناموفق بود.");
      }
      toast.success("اصلاح ثبت شد", { description: "رویداد اصلی حفظ می‌شود؛ آخرین اصلاح در محاسبات اعمال می‌شود." });
      setCorrectionTarget(null);
      setCorrectionDraftId(null);
      setNewValueSec("");
      setReason("");
      void detailQuery.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ثبت اصلاح ناموفق بود.");
    } finally {
      setSaving(false);
    }
  }

  if (detailQuery.isLoading) {
    return <div className="rounded-xl border bg-muted/20 p-8 text-center text-sm text-muted-foreground">بارگذاری جلسه…</div>;
  }
  if (!detail) {
    return (
      <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300" role="alert">
        جلسه یافت نشد.
        <Button variant="outline" size="sm" className="mt-3 block" onClick={onBack}>بازگشت</Button>
      </div>
    );
  }

  const active = detail.status === "running" || detail.status === "paused";
  const cycles = (detail.derived?.cycles ?? []) as Array<{
    seq: number;
    status: string;
    cycleTimeMs: number | null;
    elementsSumMs: number;
    deviationPct: number | null;
    elements: Array<{ elementName: string; durationMs: number; corrected: boolean }>;
    interruptions: Array<{ reason: string | null; durationMs: number | null; durationUnknown: boolean }>;
    flags: string[];
  }>;

  return (
    <div className="space-y-4">
      {/* هدر */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <MethodBadge method={detail.method} />
          <Badge variant="outline" className="text-[11px]">{detail.statusLabelFa}</Badge>
          <Badge variant="outline" className="text-[11px]">ناظر: {detail.observer}</Badge>
          <Badge variant="outline" className="text-[11px]">{faDigits(detail.eventCount)} رویداد</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onBack}>بازگشت به فهرست</Button>
          {active && onOpenChronometer ? (
            <Button size="sm" onClick={onOpenChronometer}>ادامه ثبت</Button>
          ) : null}
        </div>
      </div>

      <IntegrityBanner flags={detail.flags} />

      {/* KPI */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <KpiCell k="چرخه کامل" v={faDigits(detail.derived?.completedCycles ?? 0)} note={`از ${faDigits(cycles.length)}`} />
        <KpiCell k="زمان فعال" v={formatDurationMs(detail.derived?.activeMs ?? 0)} note="بدون مکث" />
        <KpiCell
          k="مکث"
          v={detail.derived?.pausedMs != null ? formatShortMs(detail.derived.pausedMs) : "نامشخص"}
          note={detail.derived?.pausedMs == null && (detail.derived?.interruptions?.length ?? 0) > 0 ? "شامل جزء بازیابی" : `${faDigits(detail.derived?.interruptions.length ?? 0)} وقفه`}
          tone={detail.derived?.pausedMs == null && (detail.derived?.interruptions?.length ?? 0) > 0 ? "warning" : "default"}
        />
        <KpiCell
          k="چرخه‌های مشکوک"
          v={faDigits(cycles.filter((c) => c.status === "suspect" || c.status === "recovered").length)}
          note="تلورانس/بازیابی"
          tone={cycles.some((c) => c.status === "suspect" || c.status === "recovered") ? "warning" : "default"}
        />
      </div>

      <Tabs defaultValue="cycles" dir="rtl">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="cycles" className="text-xs">چرخه‌ها و عناصر</TabsTrigger>
          <TabsTrigger value="events" className="text-xs">دفتر رویدادها ({faDigits(detail.eventCount)})</TabsTrigger>
        </TabsList>

        {/* چرخه‌ها */}
        <TabsContent value="cycles" className="mt-3 space-y-3">
          {cycles.length === 0 ? (
            <p className="rounded-lg border border-dashed bg-muted/30 p-4 text-center text-xs text-muted-foreground">
              هنوز چرخه‌ای ثبت نشده است.
            </p>
          ) : (
            cycles.map((c) => (
              <div key={c.seq} className="rounded-xl border bg-card p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">چرخه {faDigits(c.seq)}</span>
                    <CycleStatusBadge status={c.status} deviationPct={c.deviationPct} />
                  </div>
                  <span dir="ltr" className="font-mono text-xs text-muted-foreground">
                    C = {c.cycleTimeMs != null ? formatShortMs(c.cycleTimeMs) : "—"} · Σ = {formatShortMs(c.elementsSumMs)}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="py-1.5 pr-2 text-right font-medium">عنصر</th>
                        <th className="py-1.5 text-left font-medium">مدت (TS-003)</th>
                        <th className="py-1.5 text-left font-medium">وضعیت</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.elements.map((el, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-1.5 pr-2">{el.elementName}</td>
                          <td dir="ltr" className="py-1.5 text-left font-mono tabular-nums">{formatShortMs(el.durationMs)}</td>
                          <td className="py-1.5 text-left">
                            {el.corrected ? <Badge variant="outline" className="text-[9px]">اصلاح‌شده</Badge> : <span className="text-muted-foreground">—</span>}
                          </td>
                        </tr>
                      ))}
                      {c.elements.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="py-2 text-center text-muted-foreground">بدون قرائت عنصر</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
                {c.interruptions.length > 0 ? (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    وقفه‌ها:{" "}
                    {c.interruptions
                      .map((it) => `${it.reason ?? "بدون علت"} (${it.durationUnknown ? "مدت نامشخص" : it.durationMs != null ? formatShortMs(it.durationMs) : "باز"})`)
                      .join(" · ")}
                  </p>
                ) : null}
              </div>
            ))
          )}
        </TabsContent>

        {/* رویدادها */}
        <TabsContent value="events" className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground">
              رویدادها append-only هستند؛ اصلاح = رویداد جدید با ارجاع (بدون حذف). فقط رویداد‌های قرائت/عنصر/حلقه/شروع
              چرخه قابل اصلاح‌اند.
            </p>
            <Button variant="outline" size="sm" className="gap-1.5" asChild>
              <a href={`/api/projects/${projectId}/timing/sessions/${sessionId}/export`} download>
                <Download className="size-4" aria-hidden /> خروجی خام JSON
              </a>
            </Button>
          </div>
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/40 text-muted-foreground">
                  <th className="py-2 pr-3 text-right font-medium">#</th>
                  <th className="py-2 text-right font-medium">نوع</th>
                  <th className="py-2 text-right font-medium">عنصر</th>
                  <th className="py-2 text-left font-medium">قرائت</th>
                  <th className="py-2 text-left font-medium">Δ</th>
                  <th className="py-2 text-right font-medium">زمان تقویمی</th>
                  <th className="py-2 text-right font-medium">شرح</th>
                  <th className="py-2 text-center font-medium">اصلاح</th>
                </tr>
              </thead>
              <tbody>
                {detail.events.map((ev) => {
                  const isCorrectable = correctable.some((c) => c.clientEventId === ev.clientEventId);
                  return (
                    <tr key={ev.clientEventId} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="py-2 pr-3 font-mono text-muted-foreground">{faDigits(ev.seq)}</td>
                      <td className="py-2"><EventTypeBadge type={ev.type} /></td>
                      <td className="py-2">{ev.elementId ? (detail.elements.find((e) => e.key === ev.elementId)?.name ?? ev.elementId) : "—"}</td>
                      <td dir="ltr" className="py-2 text-left font-mono tabular-nums">{formatDurationMs(ev.elapsedActiveMs)}</td>
                      <td dir="ltr" className="py-2 text-left font-mono tabular-nums text-muted-foreground">
                        {ev.splitMs !== undefined ? formatShortMs(ev.splitMs) : "—"}
                      </td>
                      <td dir="ltr" className="py-2 text-left text-[10px] text-muted-foreground">
                        {new Date(ev.wallClock).toLocaleTimeString("fa-IR")}
                      </td>
                      <td className="py-2 text-muted-foreground">
                        {ev.interruptionReason ?? ev.note ?? (ev.correctionOf ? `اصلاح ${ev.correctionOf.slice(0, 8)}… → ${ev.correctedValueMs != null ? formatShortMs(ev.correctedValueMs) : "—"} (${ev.correctionReason ?? ""})` : "—")}
                        {ev.integrity && ev.integrity.length > 0 ? (
                          <Badge variant="outline" className="ms-1 border-amber-400 text-[9px] text-amber-700 dark:text-amber-400">
                            پرچم
                          </Badge>
                        ) : null}
                      </td>
                      <td className="py-2 text-center">
                        {isCorrectable && detail.status !== "finalized" ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            aria-label={`اصلاح رویداد ${faDigits(ev.seq)}`}
                            onClick={() => {
                              setCorrectionTarget(ev);
                              setCorrectionDraftId(crypto.randomUUID());
                              const currentSec = ev.type === "element" ? (ev.splitMs ?? ev.elapsedActiveMs) / 1000 : ev.elapsedActiveMs / 1000;
                              setNewValueSec(String(Math.round(currentSec * 100) / 100));
                              setReason("");
                            }}
                          >
                            <PencilLine className="size-3.5" aria-hidden />
                          </Button>
                        ) : detail.status === "finalized" ? (
                          <ShieldQuestion className="size-3.5 text-muted-foreground/50" aria-label="قفل" />
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {/* دیالوگ اصلاح */}
      <Dialog open={correctionTarget !== null} onOpenChange={(o) => !o && setCorrectionTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PencilLine className="size-5 text-primary" aria-hidden /> اصلاح رویداد {correctionTarget ? faDigits(correctionTarget.seq) : ""}
            </DialogTitle>
            <DialogDescription>
              اصلاح بدون حذف انجام می‌شود: رویداد اصلی حفظ و رویداد correction با دلیل ثبت می‌شود؛ آخرین اصلاح در محاسبات
              اعمال می‌شود.
            </DialogDescription>
          </DialogHeader>
          {correctionTarget ? (
            <div className="space-y-3">
              <div className="rounded-lg bg-muted/30 p-2.5 text-xs leading-5">
                <p>نوع: {correctionTarget.type === "element" ? "عنصر (بازگشت به صفر)" : correctionTarget.type === "reading" ? "قرائت پیوسته" : correctionTarget.type}</p>
                <p dir="ltr" className="font-mono">
                  مقدار فعلی:{" "}
                  {formatDurationMs(
                    correctionTarget.type === "element"
                      ? (correctionTarget.splitMs ?? correctionTarget.elapsedActiveMs)
                      : correctionTarget.elapsedActiveMs,
                  )}
                </p>
                <p className="text-muted-foreground">
                  {correctionTarget.type === "element"
                    ? "مقدار اصلاحی = مدت جدید همین عنصر"
                    : "مقدار اصلاحی = قرائت جدید کرنومتر (زمان فعال از شروع جلسه)"}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="corr-value" className="text-xs">مقدار جدید (ثانیه)</Label>
                <Input
                  id="corr-value"
                  value={newValueSec}
                  onChange={(e) => setNewValueSec(e.target.value)}
                  inputMode="decimal"
                  placeholder="مثلاً 12.5"
                  className="h-9 text-xs"
                  dir="ltr"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="corr-reason" className="text-xs">دلیل اصلاح (الزامی)</Label>
                <Textarea
                  id="corr-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="مثلاً: قرائت دیرهنگام — بازبینی ناظر"
                  className="min-h-16 text-xs"
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCorrectionTarget(null)} disabled={saving}>انصراف</Button>
            <Button onClick={submitCorrection} disabled={saving || !newValueSec.trim() || !reason.trim()}>
              {saving ? "در حال ثبت…" : "ثبت اصلاح"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
