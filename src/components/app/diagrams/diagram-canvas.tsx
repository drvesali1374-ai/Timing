"use client";

/**
 * بوم ویرایشگر نمودار — React Flow v12 (ADR-007) — کاملاً کنترل‌شده توسط store.
 * منبع حقیقت: editor-store (doc/layout)؛ گره/یال RF از store مشتق می‌شوند
 * (بدون state محلی موازی — رفع هشدار «node not initialized»).
 * ایجاد گام از نوار ابزار گروه‌بندی‌شده · اتصال چهارجهته (هر ضلع source+target) ·
 * zoom/pan · شبکه اختیاری · انتخاب/حذف · undo/redo · RTL بدون معکوس‌شدن پیکان.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  type Connection,
  type EdgeChange,
  type Node,
  type NodeChange,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toast } from "sonner";
import { ArrowDownAZ, Expand, Grid3x3, Map as MapIcon, Minimize, Redo2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useEditorStore } from "./editor-store";
import { DiagramStepNode, symbolColor, type DiagramStepNodeData } from "./diagram-nodes";
import {
  OPC_SYMBOL_LABELS_FA,
  FPC_SYMBOL_LABELS_FA,
  OPC_SYMBOLS,
  FPC_SYMBOLS,
  effectiveSourceSide,
  effectiveTargetSide,
  handleId,
  handleSideFromId,
  type DiagramKind,
  type DiagramSymbol,
} from "@/shared/diagrams/types";

const nodeTypes = { diagramStep: DiagramStepNode };

/** گروه ابزار با برچسب — جداکننده بصری بین خوشه‌های عملیاتی */
function ToolGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1 rounded-lg border bg-background/60 p-0.5" role="group" aria-label={label}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/**
 * کش هویت پایدار گره‌ها در سطح ماژول — بازسازی آبجکت در هر رندر، ری‌اینیش RF و
 * قطع drag را می‌گذاشت. فقط یک بوم هم‌زمان رندر می‌شود (کارگاه تک‌نمایی)؛
 * هنگام unmount پاک می‌شود.
 */
const nodeCache = new Map<string, Node>();

export interface DiagramCanvasProps {
  kind: DiagramKind;
  distanceUnit?: string;
  errorNodeIds: Set<string>;
  warningNodeIds: Set<string>;
  /** حالت تمام‌صفحه — دکمه در گروه «نمایش» */
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export function DiagramCanvas({ kind, distanceUnit, errorNodeIds, warningNodeIds, isFullscreen = false, onToggleFullscreen }: DiagramCanvasProps) {
  const doc = useEditorStore((s) => s.doc);
  const layout = useEditorStore((s) => s.layout);
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const addNode = useEditorStore((s) => s.addNode);
  const addEdgeToStore = useEditorStore((s) => s.addEdge);
  const removeNode = useEditorStore((s) => s.removeNode);
  const setNodePosition = useEditorStore((s) => s.setNodePosition);
  const selectNode = useEditorStore((s) => s.selectNode);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const applyAutoLayout = useEditorStore((s) => s.applyAutoLayout);
  const canUndo = useEditorStore((s) => s.history.length > 0);
  const canRedo = useEditorStore((s) => s.future.length > 0);

  const [showGrid, setShowGrid] = useState(false);
  const [showMiniMap, setShowMiniMap] = useState(false);

  // پاک‌سازی کش هویت هنگام unmount بوم
  useEffect(() => () => { nodeCache.clear(); }, []);

  // گره/یال از store مشتق (کنترل‌شده):
  //  - گره «بدون تغییر» همان آبجکت قبلی را برمی‌گرداند (پایداری → درگ/اتصال RF قطع نمی‌شود)
  //  - گره «تغییریافته» آبجکت جدید می‌سازد (RF تغییر position/selected/data را اعمال می‌کند)
  const rfNodes = useMemo<Node[]>(
    () => {
      const seen = new Set<string>();
      const result = (doc?.nodes ?? []).map((n) => {
        seen.add(n.id);
        const pos = layout.positions[n.id] ?? { x: 120, y: 120 };
        const selected = n.id === selectedNodeId;
        const hasError = errorNodeIds.has(n.id);
        const hasWarning = warningNodeIds.has(n.id);
        const prev = nodeCache.get(n.id);
        if (
          prev &&
          prev.position.x === pos.x &&
          prev.position.y === pos.y &&
          prev.selected === selected &&
          prev.data.node === n &&
          prev.data.kind === kind &&
          prev.data.distanceUnit === distanceUnit &&
          prev.data.hasError === hasError &&
          prev.data.hasWarning === hasWarning
        ) {
          return prev;
        }
        const created: Node = {
          id: n.id,
          type: "diagramStep",
          position: { ...pos },
          selected,
          data: {
            node: n,
            kind,
            distanceUnit,
            hasError,
            hasWarning,
          },
        };
        nodeCache.set(n.id, created);
        return created;
      });
      for (const id of [...nodeCache.keys()]) {
        if (!seen.has(id)) nodeCache.delete(id);
      }
      return result;
    },
    [doc, layout, kind, distanceUnit, selectedNodeId, errorNodeIds, warningNodeIds],
  );

  // یال‌ها — ضلع اتصال ذخیره‌شده به شناسه Handle نگاشت می‌شود؛
  // یال قدیمی بدون ضلع روی پیش‌فرض سازگار (مبدأ پایین → مقصد بالا) می‌نشیند.
  const rfEdges = useMemo(
    () =>
      (doc?.edges ?? []).map((e) => ({
        id: e.id,
        source: e.from,
        target: e.to,
        sourceHandle: handleId(effectiveSourceSide(e), "source"),
        targetHandle: handleId(effectiveTargetSide(e), "target"),
        label: e.label ?? undefined,
        markerEnd: { type: MarkerType.ArrowClosed, color: "#78716c" },
        style: { stroke: "#78716c", strokeWidth: 1.8 },
      })),
    [doc],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      for (const ch of changes) {
        if (ch.type === "position" && ch.position) {
          setNodePosition(ch.id, ch.position.x, ch.position.y);
        }
        if (ch.type === "remove") {
          removeNode(ch.id);
        }
        if (ch.type === "select" && ch.selected) {
          selectNode(ch.id);
        }
      }
    },
    [setNodePosition, removeNode, selectNode],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      for (const ch of changes) {
        if (ch.type === "remove") {
          useEditorStore.getState().removeEdge(ch.id);
        }
      }
    },
    [],
  );

  // اتصال چهارجهته — ضلع مبدأ/مقصد از شناسه Handle استخراج و در مدل داده ذخیره می‌شود
  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      if (connection.source === connection.target) {
        toast.error("اتصال خودحلقه مجاز نیست — اتصال نامعتبر.");
        return;
      }
      const fromSide = handleSideFromId(connection.sourceHandle);
      const toSide = handleSideFromId(connection.targetHandle);
      const created = addEdgeToStore(connection.source, connection.target, fromSide, toSide);
      if (!created) {
        toast.error("این اتصال قبلاً وجود دارد (یا معکوسش) — اتصال تکراری مجاز نیست.");
        return;
      }
    },
    [addEdgeToStore],
  );

  const symbols: ReadonlyArray<DiagramSymbol> = kind === "opc" ? OPC_SYMBOLS : FPC_SYMBOLS;
  const labels = kind === "opc" ? OPC_SYMBOL_LABELS_FA : FPC_SYMBOL_LABELS_FA;

  // میانبرها: Ctrl+Z / Ctrl+Shift+Z / Delete / Ctrl+D
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedNodeId) {
        e.preventDefault();
        removeNode(selectedNodeId);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d" && selectedNodeId) {
        e.preventDefault();
        useEditorStore.getState().duplicateNode(selectedNodeId);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo, selectedNodeId, removeNode]);

  if (!doc) return null;

  return (
    <div className="flex h-full min-h-0 flex-col" dir="ltr">
      {/* نوار ابزار گروه‌بندی‌شده — متن فارسی RTL داخل بوم LTR (جهت پیکان‌ها معکوس نمی‌شود) */}
      <div
        className="flex flex-wrap items-center gap-1.5 border-b bg-muted/40 px-2 py-1.5"
        dir="rtl"
        role="toolbar"
        aria-label="ابزار ویرایشگر نمودار"
      >
        {/* گروه نمادها */}
        <ToolGroup label="افزودن نماد">
          {symbols.map((s) => (
            <Button
              key={s}
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => addNode(s, `${labels[s]} ${doc.nodes.length + 1}`)}
              title={`افزودن گام ${labels[s]}`}
            >
              <span className="inline-block size-2.5 rounded-full" style={{ background: symbolColor(s) }} aria-hidden />
              {labels[s]}
            </Button>
          ))}
        </ToolGroup>

        {/* گروه ویرایش */}
        <ToolGroup label="ویرایش">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8" onClick={() => undo()} disabled={!canUndo} aria-label="لغو">
                <Undo2 className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>لغو (Ctrl+Z)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8" onClick={() => redo()} disabled={!canRedo} aria-label="بازگردانی">
                <Redo2 className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>بازگردانی (Ctrl+Shift+Z)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8" onClick={applyAutoLayout} aria-label="چیدمان خودکار">
                <ArrowDownAZ className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>چیدمان اولیه خودکار (توالی جریان عمودی)</TooltipContent>
          </Tooltip>
        </ToolGroup>

        {/* گروه نمایش */}
        <ToolGroup label="نمایش و تنظیم بوم">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => setShowGrid(!showGrid)}
                aria-label="شبکه"
                aria-pressed={showGrid}
              >
                <Grid3x3 className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>شبکه راهنما (اختیاری)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => setShowMiniMap(!showMiniMap)}
                aria-label="نقشه کوچک"
                aria-pressed={showMiniMap}
              >
                <MapIcon className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>نقشه کوچک (اختیاری)</TooltipContent>
          </Tooltip>
          {onToggleFullscreen ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={isFullscreen ? "size-8 bg-primary/10 text-primary" : "size-8"}
                  onClick={onToggleFullscreen}
                  aria-label={isFullscreen ? "خروج از حالت تمام‌صفحه" : "نمایش تمام‌صفحه"}
                  aria-pressed={isFullscreen}
                >
                  {isFullscreen ? <Minimize className="size-4" /> : <Expand className="size-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isFullscreen ? "خروج از تمام‌صفحه (Esc)" : "نمایش تمام‌صفحه — فضای کامل طراحی"}</TooltipContent>
            </Tooltip>
          ) : null}
        </ToolGroup>

        <div className="ms-auto flex items-center gap-2 text-[11px] text-muted-foreground" dir="rtl">
          <span>
            {doc.nodes.length} گام · {doc.edges.length} اتصال
          </span>
        </div>
      </div>

      {/* بوم */}
      <div className="min-h-0 flex-1">
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={(_, node) => selectNode(node.id)}
          onPaneClick={() => selectNode(null)}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          minZoom={0.2}
          maxZoom={2.5}
          proOptions={{ hideAttribution: true }}
          deleteKeyCode={null}
          multiSelectionKeyCode="Shift"
          connectionRadius={32}
          dir="ltr"
          aria-label="بوم ویرایشگر نمودار فرایند"
        >
          {showGrid ? <Background variant={BackgroundVariant.Dots} gap={22} size={1.5} color="#d6d3d1" /> : null}
          <Controls position="bottom-left" showInteractive={false} />
          {showMiniMap ? (
            <MiniMap
              pannable
              zoomable
              position="bottom-right"
              nodeColor={(n) => symbolColor(((n.data as DiagramStepNodeData).node.symbol) ?? "operation")}
            />
          ) : null}
        </ReactFlow>
      </div>
    </div>
  );
}
