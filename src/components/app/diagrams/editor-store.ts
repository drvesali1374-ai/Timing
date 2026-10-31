"use client";

/**
 * وضعیت ویرایشگر نمودار — Zustand (فقط وضعیت نمایش/تعامل؛ منطق دامنه = shared/diagrams).
 * undo/redo: تاریخچه نقطه‌چین {doc, layout} با سقف ۵۰ گام.
 * تغییرات «کوچک» (درگ) تاریخچه نمی‌سازند؛ فقط تغییرات ساختاری/ویژگی.
 */

import { create } from "zustand";
import { autoLayout } from "@/shared/diagrams/layout";
import { makeNode, type DiagramDoc, type DiagramLayout, type DiagramNode, type DiagramSymbol } from "@/shared/diagrams/types";

interface HistoryEntry {
  doc: DiagramDoc;
  layout: DiagramLayout;
}

interface EditorState {
  diagramId: string | null;
  doc: DiagramDoc | null;
  layout: DiagramLayout;
  /** شناسه گره انتخاب‌شده (تک) */
  selectedNodeId: string | null;
  history: HistoryEntry[];
  future: HistoryEntry[];
  dirty: boolean;
  /** پیشنهادهای پذیرفته‌شده برای ثبت در revision بعدی */
  acceptedSuggestions: Array<{ id: string; version: string; title: string }>;

  // actions
  init: (diagramId: string, doc: DiagramDoc, layout: DiagramLayout) => void;
  reset: () => void;
  pushHistory: () => void;
  undo: () => boolean;
  redo: () => boolean;
  setDirty: (d: boolean) => void;
  selectNode: (nodeId: string | null) => void;

  addNode: (symbol: DiagramSymbol, title: string, at?: { x: number; y: number }) => string;
  updateNode: (nodeId: string, patch: Partial<DiagramNode>) => void;
  removeNode: (nodeId: string) => void;
  duplicateNode: (nodeId: string) => string | null;
  addEdge: (from: string, to: string) => string | null;
  removeEdge: (edgeId: string) => void;
  setNodePosition: (nodeId: string, x: number, y: number) => void;
  applyAutoLayout: () => void;
  setSubject: (subject: "material" | "person" | "equipment") => void;
  acceptSuggestion: (s: { id: string; version: string; title: string }) => void;
  rejectSuggestion: (id: string) => void;
}

const HISTORY_CAP = 50;

function cloneDoc(doc: DiagramDoc): DiagramDoc {
  return JSON.parse(JSON.stringify(doc)) as DiagramDoc;
}

let nodeCounter = 0;
function freshNodeId(): string {
  nodeCounter += 1;
  return `n${Date.now().toString(36)}${nodeCounter}`;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  diagramId: null,
  doc: null,
  layout: { positions: {} },
  selectedNodeId: null,
  history: [],
  future: [],
  dirty: false,
  acceptedSuggestions: [],

  init: (diagramId, doc, layout) =>
    set({
      diagramId,
      doc: cloneDoc(doc),
      layout: JSON.parse(JSON.stringify(layout)) as DiagramLayout,
      history: [],
      future: [],
      dirty: false,
      selectedNodeId: null,
      acceptedSuggestions: [],
    }),

  reset: () =>
    set({
      diagramId: null,
      doc: null,
      layout: { positions: {} },
      history: [],
      future: [],
      dirty: false,
      selectedNodeId: null,
      acceptedSuggestions: [],
    }),

  pushHistory: () => {
    const { doc, layout, history } = get();
    if (!doc) return;
    const entry: HistoryEntry = { doc: cloneDoc(doc), layout: JSON.parse(JSON.stringify(layout)) as DiagramLayout };
    const next = [...history, entry];
    if (next.length > HISTORY_CAP) next.shift();
    set({ history: next, future: [], dirty: true });
  },

  undo: () => {
    const { history, future, doc, layout } = get();
    if (history.length === 0 || !doc) return false;
    const prev = history[history.length - 1];
    const current: HistoryEntry = { doc: cloneDoc(doc), layout: JSON.parse(JSON.stringify(layout)) as DiagramLayout };
    set({
      doc: prev.doc,
      layout: prev.layout,
      history: history.slice(0, -1),
      future: [current, ...future].slice(0, HISTORY_CAP),
      dirty: true,
      selectedNodeId: null,
    });
    return true;
  },

  redo: () => {
    const { history, future, doc, layout } = get();
    if (future.length === 0 || !doc) return false;
    const nextEntry = future[0];
    const current: HistoryEntry = { doc: cloneDoc(doc), layout: JSON.parse(JSON.stringify(layout)) as DiagramLayout };
    set({
      doc: nextEntry.doc,
      layout: nextEntry.layout,
      history: [...history, current].slice(-HISTORY_CAP),
      future: future.slice(1),
      dirty: true,
      selectedNodeId: null,
    });
    return true;
  },

  setDirty: (d) => set({ dirty: d }),
  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

  addNode: (symbol, title, at) => {
    const { doc, layout } = get();
    if (!doc) return "";
    get().pushHistory();
    const id = freshNodeId();
    const node = makeNode(doc.kind, id, symbol, title || "گام جدید");
    // شماره گام خودکار
    const maxStep = doc.nodes.reduce((m, n) => Math.max(m, n.stepNo ?? 0), 0);
    node.stepNo = maxStep + 1;
    const pos = at ?? {
      x: 80 + ((doc.nodes.length % 6) * 60),
      y: 80 + Math.floor(doc.nodes.length / 6) * 150,
    };
    const newDoc = { ...cloneDoc(doc), nodes: [...doc.nodes, node] };
    const newLayout: DiagramLayout = {
      positions: { ...layout.positions, [id]: pos },
    };
    set({ doc: newDoc, layout: newLayout, selectedNodeId: id });
    return id;
  },

  updateNode: (nodeId, patch) => {
    const { doc } = get();
    if (!doc) return;
    get().pushHistory();
    const nodes = doc.nodes.map((n) => (n.id === nodeId ? { ...n, ...patch } : n));
    set({ doc: { ...cloneDoc(doc), nodes } });
  },

  removeNode: (nodeId) => {
    const { doc, layout } = get();
    if (!doc) return;
    get().pushHistory();
    const nodes = doc.nodes.filter((n) => n.id !== nodeId);
    const edges = doc.edges.filter((e) => e.from !== nodeId && e.to !== nodeId);
    const positions = { ...layout.positions };
    delete positions[nodeId];
    set({
      doc: { ...cloneDoc(doc), nodes, edges },
      layout: { positions },
      selectedNodeId: null,
    });
  },

  duplicateNode: (nodeId) => {
    const { doc, layout } = get();
    if (!doc) return null;
    const src = doc.nodes.find((n) => n.id === nodeId);
    if (!src) return null;
    get().pushHistory();
    const id = freshNodeId();
    const copy: DiagramNode = { ...(JSON.parse(JSON.stringify(src)) as DiagramNode), id, title: `${src.title} (کپی)` };
    const maxStep = doc.nodes.reduce((m, n) => Math.max(m, n.stepNo ?? 0), 0);
    copy.stepNo = maxStep + 1;
    const srcPos = layout.positions[nodeId] ?? { x: 100, y: 100 };
    const newLayout: DiagramLayout = {
      positions: { ...layout.positions, [id]: { x: srcPos.x + 60, y: srcPos.y + 60 } },
    };
    set({
      doc: { ...cloneDoc(doc), nodes: [...doc.nodes, copy] },
      layout: newLayout,
      selectedNodeId: id,
    });
    return id;
  },

  addEdge: (from, to) => {
    const { doc } = get();
    if (!doc) return null;
    if (from === to) return null;
    const exists = doc.edges.some((e) => e.from === from && e.to === to) || doc.edges.some((e) => e.from === to && e.to === from);
    if (exists) return null;
    get().pushHistory();
    const id = `e${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
    const edges = [...doc.edges, { id, from, to }];
    set({ doc: { ...cloneDoc(doc), edges } });
    return id;
  },

  removeEdge: (edgeId) => {
    const { doc } = get();
    if (!doc) return;
    get().pushHistory();
    const edges = doc.edges.filter((e) => e.id !== edgeId);
    set({ doc: { ...cloneDoc(doc), edges } });
  },

  setNodePosition: (nodeId, x, y) => {
    const { layout } = get();
    set({ layout: { positions: { ...layout.positions, [nodeId]: { x, y } } }, dirty: true });
  },

  applyAutoLayout: () => {
    const { doc } = get();
    if (!doc) return;
    get().pushHistory();
    const layout = autoLayout(doc);
    set({ layout });
  },

  setSubject: (subject) => {
    const { doc } = get();
    if (!doc || doc.kind !== "fpc") return;
    get().pushHistory();
    set({ doc: { ...cloneDoc(doc), subject } });
  },

  acceptSuggestion: (s) => {
    const { acceptedSuggestions } = get();
    if (acceptedSuggestions.some((x) => x.id === s.id)) return;
    set({ acceptedSuggestions: [...acceptedSuggestions, s] });
  },

  rejectSuggestion: (id) => {
    const { acceptedSuggestions } = get();
    set({ acceptedSuggestions: acceptedSuggestions.filter((x) => x.id !== id) });
  },
}));
