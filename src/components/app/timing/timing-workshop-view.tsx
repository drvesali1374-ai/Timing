"use client";

/**
 * کارگاه ثبت مشاهدات زمان‌سنجی — پارادایم ورود دستی (ADR-017 / دستورالعمل بخش ۵).
 * ----------------------------------------------------------------
 * مسیر اصلی: «برگه ثبت زمان» — جدول فعالیت × نمونه برای زمان‌های اندازه‌گیری‌شده قبلی.
 * سوابق جلسات کرنومتری (داده‌های تاریخی) در تب جدا به‌صورت فقط‌خواندنی قابل مشاهده‌اند
 * (دستورالعمل ۵٫۸ — بدون حذف، بدون تبدیل ساختگی)؛ ایجاد جلسه جدید کرنومتری از
 * مسیر اصلی حذف شده است.
 */

import { useMemo, useState } from "react";
import { ClipboardList, FilePlus2, History, Send, Table2, Timer, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, ErrorState, FaDate, LoadingCards, LoadingBlock, PageHeader, Spinner } from "@/components/app/ui-bits";
import { FieldHelp } from "@/components/app/field-help";
import { useTimingSessions } from "@/hooks/use-timing";
import { useSession } from "@/hooks/use-api";
import { useCreateManualSheet, useManualSheets } from "@/hooks/use-manual-sheets";
import { formatDurationMs } from "@/shared/timing/types";
import { faDigits, IntegrityBanner, MethodBadge, SaveStateChip } from "./timing-bits";
import { SheetEditorView } from "./sheet-editor-view";
import { SessionDetailView } from "./session-detail-view";

interface TimingWorkshopViewProps {
  projectId: string;
  onBack: () => void;
  onTitle?: (title: string) => void;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  draft: "outline",
  completed: "secondary",
  finalized: "default",
};

export function TimingWorkshopView({ projectId, onBack, onTitle }: TimingWorkshopViewProps) {
  const session = useSession();
  const sheets = useManualSheets(projectId);
  const sessions = useTimingSessions(projectId);
  const createSheet = useCreateManualSheet(projectId);

  const [tab, setTab] = useState<"sheets" | "legacy">("sheets");
  const [editingSheetId, setEditingSheetId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [legacyDetailId, setLegacyDetailId] = useState<string | null>(null);

  const kpis = useMemo(() => {
    const list = sheets.data ?? [];
    return [
      { k: "برگه‌های ثبت", v: faDigits(list.length), icon: Table2 },
      { k: "در حال تکمیل", v: faDigits(list.filter((s) => s.status === "draft" && s.observationCount > 0).length), icon: ClipboardList },
      { k: "ارسال‌شده به تحلیل", v: faDigits(list.filter((s) => s.status === "finalized").length), icon: Send },
      { k: "جمع مشاهدات ثبت‌شده", v: faDigits(list.reduce((a, s) => a + s.observationCount, 0)), icon: TrendingUp },
    ];
  }, [sheets.data]);

  // نمای ویرایش برگه (تمام‌عرض)
  if (editingSheetId) {
    return <SheetEditorView projectId={projectId} sheetId={editingSheetId} onBack={() => setEditingSheetId(null)} />;
  }

  // نمای جزئیات جلسه قدیمی (فقط‌خواندنی)
  if (legacyDetailId) {
    return (
      <SessionDetailView
        projectId={projectId}
        sessionId={legacyDetailId}
        onBack={() => setLegacyDetailId(null)}
        onOpenChronometer={() => {
          /* جلسات قدیمی فقط مشاهده می‌شوند — ادامه ثبت زنده از مسیر جدید حذف شده (۵٫۸) */
        }}
      />
    );
  }

  const submitCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    createSheet.mutate(
      { title: newTitle.trim() },
      {
        onSuccess: (s) => {
          setCreateOpen(false);
          setNewTitle("");
          setEditingSheetId(s.id);
        },
      },
    );
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="ثبت مشاهدات زمان‌سنجی"
        description="زمان‌هایی که با کرنومتر یا ابزار اندازه‌گیری کرده‌اید را در برگه ثبت وارد کنید — بدون نیاز به کرنومتر داخلی."
        actions={
          <>
            <Button variant="outline" onClick={onBack} className="gap-2">
              بازگشت به پروژه
            </Button>
            <Button onClick={() => setCreateOpen(true)} disabled={!session.data} className="gap-2">
              <FilePlus2 className="size-4" aria-hidden /> برگه ثبت جدید
            </Button>
          </>
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as "sheets" | "legacy")}>
        <TabsList>
          <TabsTrigger value="sheets" className="gap-1.5">
            <Table2 className="size-4" aria-hidden /> برگه‌های ثبت زمان
          </TabsTrigger>
          <TabsTrigger value="legacy" className="gap-1.5">
            <History className="size-4" aria-hidden /> سوابق جلسات کرنومتری
            {(sessions.data?.length ?? 0) > 0 ? (
              <Badge variant="secondary" className="text-[10px]">{faDigits(sessions.data?.length ?? 0)}</Badge>
            ) : null}
          </TabsTrigger>
        </TabsList>

        {/* ── تب اصلی: برگه‌های ثبت دستی ── */}
        <TabsContent value="sheets" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {kpis.map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.k} className="py-0">
                  <CardContent className="flex items-center gap-3 p-4">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="size-4.5" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[11px] text-muted-foreground">{item.k}</p>
                      <p className="font-mono text-lg font-bold tabular-nums">{item.v}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {sheets.isLoading ? (
            <LoadingCards count={3} />
          ) : sheets.isError ? (
            <ErrorState message={(sheets.error as Error)?.message ?? "خطا در بارگذاری برگه‌ها."} onRetry={() => void sheets.refetch()} />
          ) : (sheets.data?.length ?? 0) === 0 ? (
            <EmptyState
              title="هنوز برگه ثبت زمانی ندارید"
              description="یک برگه جدید بسازید، فعالیت‌ها را به جدول اضافه کنید و زمان‌های اندازه‌گیری‌شده خود را (مثلاً از یادداشت یا Excel) وارد کنید."
              action={
                <Button onClick={() => setCreateOpen(true)} className="gap-2">
                  <FilePlus2 className="size-4" aria-hidden /> ایجاد نخستین برگه ثبت
                </Button>
              }
            />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {sheets.data?.map((s) => (
                <Card key={s.id} className="min-w-0 py-0 transition-shadow hover:shadow-md">
                  <CardHeader className="flex-row items-start justify-between space-y-0 p-4 pb-2">
                    <div className="min-w-0 space-y-1.5">
                      <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
                        <Badge variant={STATUS_VARIANT[s.status] ?? "outline"} className="text-[11px]">{s.statusFa}</Badge>
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {faDigits(s.observationCount)} مشاهده · {faDigits(s.interruptionCount)} وقفه ·{" "}
                        {s.sampleCount > 0 ? `${faDigits(s.sampleCount)} نمونه` : "بدون داده"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        <FaDate iso={s.createdAt} withTime />
                      </p>
                      {s.note ? <p className="truncate text-[11px] text-muted-foreground">{s.note}</p> : null}
                    </div>
                    <Button size="sm" variant={s.observationCount > 0 && s.status !== "finalized" ? "default" : "outline"} onClick={() => setEditingSheetId(s.id)} className="shrink-0 gap-1.5">
                      <Table2 className="size-4" aria-hidden /> {s.status === "finalized" ? "مشاهده" : "ادامه ثبت"}
                    </Button>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}

          <div className="rounded-lg border border-dashed bg-muted/30 p-3 text-[11px] leading-6 text-muted-foreground">
            <span className="font-semibold text-foreground">راهنمای سریع:</span> هر سطر جدول یک فعالیت و هر ستون یک نمونه
            اندازه‌گیری است. مقدارها را به ثانیه بگذارید (مثل 12.5) یا از Excel بچسبانید؛ ارقام فارسی و قالب{" "}
            <span dir="ltr" className="font-mono">00:12.5</span> هم پذیرفته می‌شود. با «ارسال به کارگاه تحلیل» داده‌ها مبنای
            محاسبات مهندسی زمان می‌شوند.
          </div>
        </TabsContent>

        {/* ── تب میراث: سوابق جلسات کرنومتری (فقط مشاهده — ۵٫۸) ── */}
        <TabsContent value="legacy" className="mt-4 space-y-4">
          <div className="rounded-lg border border-dashed bg-muted/30 p-3 text-xs leading-6 text-muted-foreground">
            جلسات ثبت‌شده با کرنومتر داخلی در نسخه‌های قبلی — داده‌های آن‌ها محفوظ است و در تحلیل همان‌طور استفاده
            می‌شود. ایجاد جلسه جدید کرنومتری از این نسخه حذف شده و مسیر اصلی ثبت، «برگه ثبت زمان» است.
          </div>
          {sessions.isLoading ? (
            <LoadingBlock lines={4} />
          ) : sessions.isError ? (
            <ErrorState message={(sessions.error as Error)?.message ?? "خطا در بارگذاری جلسات."} onRetry={() => void sessions.refetch()} />
          ) : (sessions.data?.length ?? 0) === 0 ? (
            <EmptyState
              title="جلسه کرنومتری ثبت نشده است"
              description="این پروژه سوابق جلسه کرنومتری ندارد — برای ثبت داده جدید از «برگه ثبت زمان» استفاده کنید."
            />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {sessions.data?.map((s) => (
                <Card key={s.id} className="min-w-0 py-0">
                  <CardHeader className="flex-row items-start justify-between space-y-0 p-4 pb-2">
                    <div className="min-w-0 space-y-1.5">
                      <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
                        <MethodBadge method={s.method} />
                        <Badge variant={s.status === "finalized" ? "secondary" : "outline"} className="text-[11px]">
                          {s.statusLabelFa}
                        </Badge>
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        ناظر: {s.observer} · {faDigits(s.elementCount)} عنصر · {faDigits(s.completedCycles)} چرخه کامل
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        <FaDate iso={s.createdAt} withTime />
                        {s.startedAtWall && s.endedAtWall
                          ? ` · ${formatDurationMs(new Date(s.endedAtWall).getTime() - new Date(s.startedAtWall).getTime())} تقویمی`
                          : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      {s.status === "finalized" ? <SaveStateChip state="synced" detail="قفل تحلیل" /> : null}
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setLegacyDetailId(s.id)}>
                        <ClipboardList className="size-4" aria-hidden /> مشاهده
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    {s.flags.length > 0 ? <IntegrityBanner flags={s.flags} compact /> : s.notes ? (
                      <p className="truncate rounded-lg bg-muted/30 p-2 text-[11px] text-muted-foreground">{s.notes}</p>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* دیالوگ ایجاد برگه */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>برگه ثبت زمان جدید</DialogTitle>
            <DialogDescription>
              برگه‌ای برای ثبت دستی زمان‌های اندازه‌گیری‌شده — فعالیت‌ها را بعداً به جدول اضافه می‌کنید.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitCreate} className="space-y-3">
            <div className="space-y-1.5">
              <span className="inline-flex items-center gap-1.5">
                <Label htmlFor="sheet-title">عنوان برگه *</Label>
                <FieldHelp
                  label="عنوان برگه"
                  content={{
                    meaning: "نام شناسا این مجموعه اندازه‌گیری — مثلاً بر اساس تاریخ یا بخش خط.",
                    input: "یک عنوان کوتاه و مشخص بنویسید.",
                    example: "«اندازه‌گیری خط مونتاژ — ۱۴ آبان» یا «ایستگاه مونتاژ — شیفت صبح».",
                    usage: "در فهرست برگه‌ها و گزارش تحلیل (ردیابی منبع داده) نمایش داده می‌شود.",
                    required: true,
                  }}
                />
              </span>
              <Input
                id="sheet-title"
                placeholder="مثال: اندازه‌گیری خط مونتاژ — امروز"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                required
              />
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                انصراف
              </Button>
              <Button type="submit" disabled={createSheet.isPending || !newTitle.trim()} className="gap-2">
                {createSheet.isPending ? <Spinner /> : <Timer className="size-4" aria-hidden />} ایجاد و شروع ثبت
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
