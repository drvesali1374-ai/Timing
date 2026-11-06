'use client'

// ═══════════════════════════════════════════════════════════
// Undo/Redo مستقل و قابل پیش‌بینی برای برگه — FR-07 / ۷.۴
// هر عمل کاربر یک ورودی با closure های undo/redo می‌سازد؛
// پشته‌ها LIFO هستند و عمل جدید پشتهٔ redo را پاک می‌کند.
// پیش از هر undo/redo صف ذخیرهٔ سلول‌ها flush می‌شود.
// ═══════════════════════════════════════════════════════════
import { useCallback, useRef, useState } from 'react'

export interface HistoryEntry {
  label: string
  undo: () => Promise<void>
  redo: () => Promise<void>
}

export interface SheetHistory {
  canUndo: boolean
  canRedo: boolean
  undoLabel: string | null
  redoLabel: string | null
  /** ثبت عمل جدید؛ پشتهٔ redo پاک می‌شود */
  push: (entry: HistoryEntry) => void
  undo: () => Promise<void>
  redo: () => Promise<void>
  /** پاک‌سازی هنگام تعویض جلسه */
  clear: () => void
}

export function useSheetHistory(flush: () => Promise<void>): SheetHistory {
  const undoStackRef = useRef<HistoryEntry[]>([])
  const redoStackRef = useRef<HistoryEntry[]>([])

  // تصویر لحظه‌ای برای رندر (خواندن ref در رندر ممنوع است)
  const [snapshot, setSnapshot] = useState({
    undoCount: 0,
    redoCount: 0,
    undoLabel: null as string | null,
    redoLabel: null as string | null,
  })

  const sync = useCallback(() => {
    const u = undoStackRef.current
    const r = redoStackRef.current
    setSnapshot({
      undoCount: u.length,
      redoCount: r.length,
      undoLabel: u.length > 0 ? u[u.length - 1].label : null,
      redoLabel: r.length > 0 ? r[r.length - 1].label : null,
    })
  }, [])

  const push = useCallback(
    (entry: HistoryEntry) => {
      undoStackRef.current.push(entry)
      if (undoStackRef.current.length > 200) undoStackRef.current.shift()
      redoStackRef.current = []
      sync()
    },
    [sync]
  )

  const undo = useCallback(async () => {
    // ترتیب: اول تغییرات معلق ذخیره شوند تا بازگردانی روی آخرین وضعیت اعمال شود
    await flush()
    const entry = undoStackRef.current.pop()
    if (!entry) return
    try {
      await entry.undo()
    } finally {
      redoStackRef.current.push(entry)
      sync()
    }
  }, [flush, sync])

  const redo = useCallback(async () => {
    await flush()
    const entry = redoStackRef.current.pop()
    if (!entry) return
    try {
      await entry.redo()
    } finally {
      undoStackRef.current.push(entry)
      sync()
    }
  }, [flush, sync])

  const clear = useCallback(() => {
    undoStackRef.current = []
    redoStackRef.current = []
    sync()
  }, [sync])

  return {
    canUndo: snapshot.undoCount > 0,
    canRedo: snapshot.redoCount > 0,
    undoLabel: snapshot.undoLabel,
    redoLabel: snapshot.redoLabel,
    push,
    undo,
    redo,
    clear,
  }
}
