"use client";

/**
 * کارگاه طراح نمودارهای فرایندی (فاز ۳ — OPC/FPC).
 * چیدمان: فهرست نمودارها (راست، جمع‌شونده) · بوم ویرایشگر (وسط) · پنل خواص/اعتبارسنجی/دستیار (چپ، جمع‌شونده).
 * حالت تمام‌صفحه: همان نمونه واحد با پوشش fixed — انتخاب/undo/ذخیره خودکار از store زنده می‌مانند؛
 * فقط کلاس‌های چیدمان عوض می‌شوند (بازنمایی دوم ساخته نمی‌شود — بند ۸.۱).
 * ذخیره خودکار کنترل‌شده (debounce ۳s): آنلاین → revision جدید؛ آفلاین → صف محلی idempotent (ADR-006).
 * بازیابی پیش‌نویس محلی پس از reload + وضعیت صادقانه ذخیره/همگام‌سازی.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  ArrowLeft,
  BadgeCheck,
  CloudUpload,
  Download,
  FileImage,
  Layers,
  MoreHorizontal,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Printer,
  Save,
  Workflow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { ErrorState, FaDate, LoadingBlock, Spinner } from "@/components/app/ui-bits";
import { Hint } from "@/components/app/hint";
import { useProject } from "@/hooks/use-api";
import { useProjectActivities } from "@/hooks/use-config";
import {
  useDiagram,
  useDiagrams,
  useOfflineQueue,
  useOnline,
  usePatchDiagram,
  useSaveRevision,
} from "@/hooks/use-diagrams";
import { DIAGRAM_KIND_LABELS_FA, DIAGRAM_STATUS_LABELS_FA, DIAGRAM_VARIANT_LABELS_FA } from "@/shared/contracts/diagrams";
import { validateDiagram } from "@/shared/diagrams/validation";
import { useEditorStore } from "./editor-store";
import { DiagramCanvas } from "./diagram-canvas";
import { NodePropertiesPanel } from "./node-properties-panel";
import { ValidationPanel } from "./validation-panel";
import { AssistantPanel } from "./assistant-panel";
import { NewDiagramDialog } from "./new-diagram-dialog";
import { NoCompareHint, RevisionHistoryPanel, VariantComparePanel } from "./revision-compare-panels";
import { downloadPng, downloadSvg, printDiagram } from "./export-utils";
import { getDraft, deleteDraft } from "@/lib/diagram-local-store";
import type { DiagramListItemDto } from "@/shared/contracts/diagrams";
import { cn } from "@/lib/utils";

export interface DiagramWorkshopViewProps {
  projectId: string;
  onBack: () => void;
  onTitle?: (title: string) => void;
}

type SaveStatus = "saved" | "dirty" | "saving" | "local-queued" | "error";

export function DiagramWorkshopView({ projectId, onBack, onTitle }: DiagramWorkshopViewProps) {
  const projectQuery = useProject(projectId);
  const diagramsQuery = useDiagrams(projectId);
  const [selectedDiagramId, setSelectedDiagramId] = useState<string | null>(null);
  // انتخاب مؤثر: انتخاب کاربر یا اولین نمودار — مشتق در رندر (بدون setState در effect)
  const firstDiagramId = diagramsQuery.data?.[0]?.id ?? null;
  const activeDiagramId = selectedDiagramId ?? firstDiagramId;
  const diagramQuery = useDiagram(projectId, activeDiagramId);
  const activitiesQuery = useProjectActivities(projectId);

  const saveMutation = useSaveRevision(projectId);
  const patchMutation = usePatchDiagram(projectId);
  const online = useOnline();
  const offlineQueue = useOfflineQueue(projectId);

  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [newProposedFrom, setNewProposedFrom] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [draftRecovery, setDraftRecovery] = useState<{ doc: unknown; layout: unknown; savedAt: string } | null>(null);

  // ── حالت نمایش: تمام‌صفحه + جمع‌شدن پنل‌ها (تک‌نمونه — فقط کلاس چیدمان عوض می‌شود) ──
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [listPanelOpen, setListPanelOpen] = useState(true);
  const [propsPanelOpen, setPropsPanelOpen] = useState(true);

  const doc = useEditorStore((s) => s.doc);
  const layout = useEditorStore((s) => s.layout);
  const dirty = useEditorStore((s) => s.dirty);
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);

  const project = projectQuery.data;
  useEffect(() => {
    if (project?.title) onTitle?.(project.title);
  }, [project?.title, onTitle]);

  // خروج از تمام‌صفحه با Escape (بند ۸.۱-۶)
  useEffect(() => {
    if (!isFullscreen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [isFullscreen]);

  // بارگذاری سند در store + بررسی پیش‌نویس محلی (بازیابی پس از reload)
  const loadedDiagramId = useEditorStore((s) => s.diagramId);
  useEffect(() => {
    const detail = diagramQuery.data;
    if (!detail || detail.id === loadedDiagramId) return;
    useEditorStore.getState().init(detail.id, detail.doc, detail.layout);
    // پیش‌نویس محلی مقدم بر سند سرور (اگر هست) — به‌روزرسانی وضعیت پس از await
    void (async () => {
      try {
        const draft = await getDraft(projectId, detail.id);
        if (draft && draft.savedAt > detail.updatedAt) {
          setSaveStatus("saved");
          setDraftRecovery({ doc: draft.doc, layout: draft.layout, savedAt: draft.savedAt });
        } else {
          if (draft) await deleteDraft(projectId, detail.id);
          setSaveStatus("saved");
          setDraftRecovery(null);
        }
      } catch {
        setSaveStatus("saved");
        setDraftRecovery(null);
      }
    })();
  }, [diagramQuery.data, loadedDiagramId, projectId]);

  // کلیدهای فعالیت برای اعتبارسنجی مرجع‌ها
  const knownActivityKeys = useMemo(
    () => (activitiesQuery.data ?? []).map((a) => a.stableKey),
    [activitiesQuery.data],
  );
  const activities = useMemo(
    () => (activitiesQuery.data ?? []).map((a) => ({ stableKey: a.stableKey, name: a.name, workType: a.workType })),
    [activitiesQuery.data],
  );

  // اعتبارسنجی زنده برای متمایزکردن گره‌های خطادار/هشداردار
  const liveReport = useMemo(
    () => (doc ? validateDiagram(doc, { knownActivityKeys }) : null),
    [doc, knownActivityKeys],
  );
  const errorNodeIds = useMemo(() => new Set((liveReport?.errors ?? []).map((e) => e.nodeId).filter(Boolean) as string[]), [liveReport]);
  const warningNodeIds = useMemo(
    () => new Set((liveReport?.warnings ?? []).map((w) => w.nodeId).filter(Boolean) as string[]),
    [liveReport],
  );

  // ── ذخیره (خودکار debounce + دستی) ──
  const saveNow = useCallback(
    async (reason?: string) => {
      const state = useEditorStore.getState();
      if (!state.doc || !state.diagramId) return;
      const payload = {
        projectId,
        diagramId: state.diagramId,
        doc: state.doc,
        layout: state.layout,
        reason: reason ?? "ذخیره خودکار",
        appliedSuggestions: state.acceptedSuggestions,
      };
      if (online) {
        setSaveStatus("saving");
        try {
          await saveMutation.mutateAsync(payload);
          useEditorStore.getState().setDirty(false);
          setSaveStatus("saved");
        } catch {
          setSaveStatus("error");
        }
      } else {
        // آفلاین → صف محلی + پیش‌نویس (idempotent با clientOpId)
        try {
          await offlineQueue.enqueue(payload);
          await import("@/lib/diagram-local-store").then((m) =>
            m.putDraft({
              key: `${projectId}:${payload.diagramId}`,
              projectId,
              diagramId: payload.diagramId,
              doc: payload.doc,
              layout: payload.layout,
              savedAt: new Date().toISOString(),
            }),
          );
          useEditorStore.getState().setDirty(false);
          setSaveStatus("local-queued");
          toast.info("آفلاین: ذخیره در صف محلی — پس از اتصال همگام می‌شود.");
        } catch {
          setSaveStatus("error");
          toast.error("ذخیره محلی ناموفق بود.");
        }
      }
    },
    [online, saveMutation, offlineQueue, projectId],
  );

  // خودکار ۳s پس از آخرین تغییر
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!dirty || !doc) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      void saveNow("ذخیره خودکار");
    }, 3000);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [dirty, doc, saveNow]);

  // هشدار ترک صفحه با تغییر ذخیره‌نشده
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (useEditorStore.getState().dirty) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const diagrams = diagramsQuery.data ?? [];
  const currentDiagramMeta = diagrams.find((d) => d.id === activeDiagramId) ?? null;

  if (projectQuery.isLoading || diagramsQuery.isLoading) {
    return (
      <div className="space-y-4">
        <LoadingBlock lines={3} />
        <LoadingBlock lines={8} />
      </div>
    );
  }
  if (projectQuery.isError || !project) {
    return <ErrorState message="پروژه یافت نشد یا شما به آن دسترسی ندارید." onRetry={onBack} />;
  }

  const hasActiveDoc = !!activeDiagramId && !!doc;

  return (
    <div
      className={cn(
        // همان نمونه واحد — حالت عادی/تمام‌صفحه فقط کلاس چیدمان را عوض می‌کند؛
        // وضعیت store (انتخاب/undo/ذخیره خودکار) زنده می‌ماند (بند ۸.۱-۹).
        isFullscreen
          ? "fixed inset-0 z-[60] flex flex-col gap-2 overflow-hidden bg-background p-2 lg:p-3"
          : "space-y-4",
      )}
      aria-label={isFullscreen ? "کارگاه نمودار — حالت تمام‌صفحه" : undefined}
    >
      {/* سربرگ — فشرده در تمام‌صفحه */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {isFullscreen ? (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setIsFullscreen(false)}>
              <ArrowLeft className="size-4" aria-hidden /> خروج از تمام‌صفحه
            </Button>
          ) : (
            <Button variant="ghost" size="icon" onClick={onBack} aria-label="بازگشت به پروژه">
              <ArrowLeft className="size-4" />
            </Button>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold">طراح نمودارهای فرایندی</h1>
            {!isFullscreen ? (
              <p className="truncate text-xs text-muted-foreground">
                {project.title} · OPC/FPC · اتصال از هر چهار ضلع گام‌ها
              </p>
            ) : null}
          </div>
          {!isFullscreen ? (
            <Hint
              text="نمودار OPC توالی عملیات مونتاژ را نشان می‌دهد و FPC جریان گام‌به‌گام یک ماده/فرد/تجهیزات را. گام‌ها را از نوار ابزار اضافه کنید، سپس با کشیدن از نقاط اتصال هر ضلع، جریان را ترسیم کنید. محل دقیق اتصال‌ها هنگام ذخیره حفظ می‌شود."
              title="راهنمای طراح نمودار"
            />
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {/* پنل‌های جمع‌شونده — دکمه همیشه در دسترس */}
          {hasActiveDoc ? (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8"
                    onClick={() => setListPanelOpen((v) => !v)}
                    aria-label={listPanelOpen ? "جمع‌کردن فهرست نمودارها" : "نمایش فهرست نمودارها"}
                    aria-pressed={listPanelOpen}
                  >
                    {listPanelOpen ? <PanelRightClose className="size-4" /> : <PanelRightOpen className="size-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>فهرست نمودارهای پروژه</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8"
                    onClick={() => setPropsPanelOpen((v) => !v)}
                    aria-label={propsPanelOpen ? "جمع‌کردن پنل ویژگی‌ها" : "نمایش پنل ویژگی‌ها"}
                    aria-pressed={propsPanelOpen}
                  >
                    {propsPanelOpen ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>پنل ویژگی گام / اعتبارسنجی / دستیار</TooltipContent>
              </Tooltip>
            </>
          ) : null}
          {/* وضعیت ذخیره/آفلاین — صادقانه */}
          <Badge
            variant="outline"
            className={cn(
              "gap-1",
              saveStatus === "saved" && "border-emerald-300 text-emerald-700 dark:text-emerald-300",
              saveStatus === "dirty" && "border-amber-400 text-amber-700 dark:text-amber-300",
              saveStatus === "saving" && "border-stone-300",
              saveStatus === "local-queued" && "border-amber-500 text-amber-800 dark:text-amber-300",
              saveStatus === "error" && "border-red-400 text-red-700 dark:text-red-300",
            )}
          >
            {saveStatus === "saved" ? "ذخیره‌شده" : null}
            {saveStatus === "dirty" ? "تغییرات ذخیره‌نشده" : null}
            {saveStatus === "saving" ? (
              <>
                <Spinner /> در حال ذخیره…
              </>
            ) : null}
            {saveStatus === "local-queued" ? "ذخیره محلی (آفلاین)" : null}
            {saveStatus === "error" ? "خطای ذخیره" : null}
          </Badge>
          {!online ? (
            <Badge variant="outline" className="gap-1 border-amber-500 text-amber-800 dark:text-amber-300">
              آفلاین — طراحی/اعتبارسنجی فعال؛ ذخیره در صف
            </Badge>
          ) : null}
          {offlineQueue.count > 0 ? (
            <Badge variant="outline" className="gap-1 border-amber-500 text-amber-800 dark:text-amber-300">
              <CloudUpload className="size-3" aria-hidden /> در صف آفلاین: {offlineQueue.count}
              {offlineQueue.flushing ? " (در حال همگام‌سازی…)" : ""}
            </Badge>
          ) : null}
          {currentDiagramMeta ? (
            <Badge variant="secondary" className="font-mono">
              r{currentDiagramMeta.currentRev}
            </Badge>
          ) : null}
        </div>
      </div>

      {/* بازیابی پیش‌نویس محلی */}
      {draftRecovery && !isFullscreen ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/40">
          <p className="text-amber-900 dark:text-amber-200">
            پیش‌نویس محلی ذخیره‌نشده برای این نمودار پیدا شد ({new Date(draftRecovery.savedAt).toLocaleString("fa-IR")}) — بازیابی
            شود؟
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                if (activeDiagramId) {
                  useEditorStore.getState().init(activeDiagramId, draftRecovery.doc as never, draftRecovery.layout as never);
                  setDraftRecovery(null);
                  toast.success("پیش‌نویس محلی بازیابی شد — ذخیره را فراموش نکنید.");
                }
              }}
            >
              بازیابی
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                if (activeDiagramId) await deleteDraft(projectId, activeDiagramId);
                setDraftRecovery(null);
              }}
            >
              دور ریختن
            </Button>
          </div>
        </div>
      ) : null}

      {/* بدنه — فهرست (راست/جمع‌شونده) + بوم + پنل (چپ/جمع‌شونده) */}
      <div className={cn("min-h-0", isFullscreen ? "flex flex-1 flex-col gap-2 lg:flex-row" : "flex flex-col gap-4 lg:flex-row")}>
        {/* فهرست نمودارها — جمع‌شونده */}
        {listPanelOpen ? (
          <aside
            className={cn(
              "space-y-2 lg:shrink-0",
              isFullscreen ? "lg:w-56" : "lg:w-60",
              isFullscreen ? "flex flex-col overflow-hidden rounded-xl border bg-card lg:max-h-full" : "",
            )}
            aria-label="فهرست نمودارها"
          >
            <Button className="w-full gap-2" onClick={() => setNewDialogOpen(true)}>
              <Plus className="size-4" aria-hidden /> نمودار جدید
            </Button>
            <div
              className={cn(
                "space-y-1.5 overflow-y-auto rounded-xl border p-2",
                isFullscreen ? "flex-1 lg:max-h-none" : "max-h-[calc(100vh-320px)]",
              )}
            >
              {diagrams.length === 0 ? (
                <p className="p-3 text-center text-xs leading-relaxed text-muted-foreground">
                  هنوز نموداری نساخته‌اید. با OPC توالی مونتاژ و با FPC جریان گام‌به‌گام (زمان/مسافت) را ترسیم کنید.
                </p>
              ) : null}
              {diagrams.map((d) => (
                <DiagramListItem
                  key={d.id}
                  diagram={d}
                  active={d.id === activeDiagramId}
                  onClick={() => {
                    if (useEditorStore.getState().dirty) {
                      void saveNow("ذخیره پیش از تغییر نمودار");
                    }
                    setSelectedDiagramId(d.id);
                  }}
                />
              ))}
            </div>
          </aside>
        ) : null}

        {/* بوم + پنل ویژگی‌ها */}
        <div className={cn("min-w-0 flex-1", isFullscreen ? "flex gap-2 flex-col xl:flex-row" : "flex flex-col gap-4 xl:flex-row")}>
          <div
            className={cn(
              "flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card",
              isFullscreen ? "min-h-[320px]" : "min-h-[520px]",
            )}
          >
            {diagramQuery.isLoading && activeDiagramId ? (
              <div className="flex flex-1 items-center justify-center p-8">
                <Spinner />
              </div>
            ) : !activeDiagramId || !doc ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
                <Workflow className="size-10 text-muted-foreground/40" aria-hidden />
                <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
                  {diagrams.length === 0
                    ? "با دکمه «نمودار جدید» اولین OPC یا FPC این پروژه را بسازید؛ یا از دستیار آفلاین برای تبدیل متن فرایند به پیش‌نویس استفاده کنید."
                    : "نموداری از فهرست انتخاب کنید."}
                </p>
              </div>
            ) : (
              <>
                {/* نوار عملیات نمودار جاری — گروه ذخیره/خروجی + منوی عملیات بیشتر */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-3 py-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    {currentDiagramMeta ? (
                      <>
                        <Badge variant="outline" className="gap-1 text-[10px]">
                          {currentDiagramMeta.kind === "opc" ? (
                            <Network className="size-3" aria-hidden />
                          ) : (
                            <Workflow className="size-3" aria-hidden />
                          )}
                          {DIAGRAM_KIND_LABELS_FA[currentDiagramMeta.kind]}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          {DIAGRAM_VARIANT_LABELS_FA[currentDiagramMeta.variant]}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px]",
                            currentDiagramMeta.status === "confirmed" && "border-emerald-400 text-emerald-700 dark:text-emerald-300",
                          )}
                        >
                          {DIAGRAM_STATUS_LABELS_FA[currentDiagramMeta.status]}
                        </Badge>
                        <span className="truncate text-xs font-medium">{currentDiagramMeta.title}</span>
                      </>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    {/* گروه ذخیره و خروجی */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label="ذخیره نسخه"
                          disabled={!dirty && saveStatus === "saved"}
                          onClick={() => void saveNow("ذخیره دستی")}
                        >
                          <Save className="size-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>ذخیره revision جدید</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label="خروجی SVG"
                          onClick={() => {
                            if (!doc || !currentDiagramMeta) return;
                            downloadSvg(doc, layout, `diagram-${currentDiagramMeta.id.slice(0, 8)}`, {
                              diagramTitle: currentDiagramMeta.title,
                              projectTitle: project.title,
                            });
                            toast.success("SVG دانلود شد.");
                          }}
                        >
                          <Download className="size-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>خروجی SVG (برداری)</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label="خروجی PNG"
                          onClick={() => {
                            if (!doc || !currentDiagramMeta) return;
                            void downloadPng(doc, layout, `diagram-${currentDiagramMeta.id.slice(0, 8)}`, {
                              diagramTitle: currentDiagramMeta.title,
                              projectTitle: project.title,
                            })
                              .then(() => toast.success("PNG دانلود شد."))
                              .catch((e: Error) => toast.error(e.message));
                          }}
                        >
                          <FileImage className="size-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>خروجی PNG (تصویری)</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label="چاپ"
                          onClick={() => {
                            if (!doc || !currentDiagramMeta) return;
                            printDiagram(doc, layout, {
                              diagramTitle: currentDiagramMeta.title,
                              projectTitle: project.title,
                            });
                          }}
                        >
                          <Printer className="size-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>چاپ نمودار</TooltipContent>
                    </Tooltip>
                    {/* تأیید — عملیات اصلی تک‌مرحله‌ای */}
                    {currentDiagramMeta && currentDiagramMeta.status !== "confirmed" && liveReport?.valid ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-emerald-600"
                            aria-label="تأیید نمودار"
                            disabled={patchMutation.isPending}
                            onClick={() =>
                              patchMutation.mutate({ diagramId: currentDiagramMeta.id, status: "confirmed" })
                            }
                          >
                            <BadgeCheck className="size-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>تأیید (فقط بدون خطا) — ویرایش بعدی نسخه جدید می‌سازد</TooltipContent>
                      </Tooltip>
                    ) : null}
                    {/* عملیات کم‌کاربرد — منوی بیشتر */}
                    {currentDiagramMeta ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8" aria-label="عملیات بیشتر">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuLabel>عملیات نمودار</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {currentDiagramMeta.variant === "current" ? (
                            <DropdownMenuItem onClick={() => setNewProposedFrom(currentDiagramMeta.id)} className="gap-2">
                              <Layers className="size-4" aria-hidden /> ایجاد نسخه پیشنهادی برای مقایسه
                            </DropdownMenuItem>
                          ) : null}
                          {currentDiagramMeta.status !== "archived" ? (
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => patchMutation.mutate({ diagramId: currentDiagramMeta.id, status: "archived" })}
                              disabled={patchMutation.isPending}
                              className="gap-2"
                            >
                              <Archive className="size-4" aria-hidden /> بایگانی نمودار
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => patchMutation.mutate({ diagramId: currentDiagramMeta.id, status: "draft" })}
                              disabled={patchMutation.isPending}
                              className="gap-2"
                            >
                              <Archive className="size-4" aria-hidden /> خروج از بایگانی
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </div>
                </div>
                <div className={cn("min-h-0", isFullscreen ? "flex-1" : "h-[calc(100vh-330px)] min-h-[420px]")}>
                  <DiagramCanvas
                    kind={doc.kind}
                    distanceUnit={doc.distanceUnit}
                    errorNodeIds={errorNodeIds}
                    warningNodeIds={warningNodeIds}
                    isFullscreen={isFullscreen}
                    onToggleFullscreen={() => setIsFullscreen((v) => !v)}
                  />
                </div>
              </>
            )}
          </div>

          {/* پنل سمت چپ (در RTL) — جمع‌شونده */}
          {propsPanelOpen ? (
            <div
              className={cn(
                "min-h-0 shrink-0 overflow-hidden rounded-xl border bg-card xl:w-[340px]",
                isFullscreen ? "flex flex-col max-h-full xl:max-h-none" : "xl:max-h-[calc(100vh-220px)]",
              )}
              aria-label="پنل ویژگی‌ها و ابزارها"
            >
              {activeDiagramId && doc ? (
                <Tabs defaultValue={selectedNodeId ? "props" : "validation"} className="h-full">
                  <TabsList className="mx-3 mt-2 grid w-auto grid-cols-3">
                    <TabsTrigger value="props" className="text-xs">
                      گام انتخابی
                    </TabsTrigger>
                    <TabsTrigger value="validation" className="gap-1 text-xs">
                      اعتبارسنجی
                      {liveReport && liveReport.errors.length > 0 ? (
                        <Badge className="ms-1 bg-red-600 px-1 text-[9px] hover:bg-red-600">{liveReport.errors.length}</Badge>
                      ) : null}
                    </TabsTrigger>
                    <TabsTrigger value="assistant" className="gap-1 text-xs">
                      دستیار
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent
                    value="props"
                    className={cn("mt-0 overflow-y-auto", isFullscreen ? "max-h-none flex-1" : "max-h-[calc(100vh-330px)]")}
                  >
                    <NodePropertiesPanel activities={activities} />
                  </TabsContent>
                  <TabsContent
                    value="validation"
                    className={cn("mt-0 overflow-y-auto", isFullscreen ? "max-h-none flex-1" : "max-h-[calc(100vh-330px)]")}
                  >
                    <ValidationPanel
                      knownActivityKeys={knownActivityKeys}
                      onSelectNode={(id) => useEditorStore.getState().selectNode(id)}
                    />
                  </TabsContent>
                  <TabsContent
                    value="assistant"
                    className={cn("mt-0 overflow-y-auto", isFullscreen ? "max-h-none flex-1" : "max-h-[calc(100vh-330px)]")}
                  >
                    <AssistantPanel
                      kind={doc.kind}
                      knownActivityKeys={knownActivityKeys}
                      onCreateProposedVariant={() => setNewProposedFrom(activeDiagramId)}
                    />
                  </TabsContent>
                </Tabs>
              ) : (
                <p className="p-4 text-sm text-muted-foreground">برای استفاده از پنل‌ها یک نمودار بسازید/انتخاب کنید.</p>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* تاریخچه نسخه‌ها + مقایسه — ردیف دوم (فقط حالت عادی؛ در تمام‌صفحه با خروج از حالت در دسترس) */}
      {activeDiagramId && currentDiagramMeta && !isFullscreen ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="overflow-hidden rounded-xl border bg-card">
            <RevisionHistoryPanel projectId={projectId} diagramId={activeDiagramId} currentRev={currentDiagramMeta.currentRev} />
          </div>
          <div className="overflow-hidden rounded-xl border bg-card">
            {currentDiagramMeta.variant === "proposed" ? (
              <VariantComparePanel projectId={projectId} diagramId={activeDiagramId} kind={currentDiagramMeta.kind} />
            ) : (
              <NoCompareHint onCreate={() => setNewProposedFrom(activeDiagramId)} />
            )}
          </div>
        </div>
      ) : null}

      {newDialogOpen ? (
        <NewDiagramDialog
          projectId={projectId}
          open={newDialogOpen}
          onOpenChange={setNewDialogOpen}
          onCreated={(id) => setSelectedDiagramId(id)}
        />
      ) : null}
      {newProposedFrom ? (
        <NewDiagramDialog
          projectId={projectId}
          open={!!newProposedFrom}
          onOpenChange={(v) => !v && setNewProposedFrom(null)}
          onCreated={(id) => setSelectedDiagramId(id)}
          presetVariantOfId={newProposedFrom}
          presetVariant="proposed"
          presetKind={currentDiagramMeta?.kind}
        />
      ) : null}
    </div>
  );
}

function DiagramListItem({ diagram, active, onClick }: { diagram: DiagramListItemDto; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-lg border p-2.5 text-right transition-colors",
        active ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30",
      )}
      aria-current={active}
    >
      <div className="flex items-center justify-between gap-1.5">
        <span className="truncate text-xs font-semibold">{diagram.title}</span>
        <Badge variant="outline" className="shrink-0 text-[9px]">
          {diagram.kind === "opc" ? "OPC" : "FPC"}
        </Badge>
      </div>
      <div className="mt-1 flex items-center justify-between gap-1 text-[10px] text-muted-foreground">
        <span>
          {DIAGRAM_VARIANT_LABELS_FA[diagram.variant]} · {DIAGRAM_STATUS_LABELS_FA[diagram.status]} · r{diagram.currentRev}
        </span>
        <FaDate iso={diagram.updatedAt} />
      </div>
    </button>
  );
}
