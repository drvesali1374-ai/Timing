'use client'

// ═══════════════════════════════════════════════════════════
// صف ذخیرهٔ سلول‌های برگه — FR-23 / ۶.۶
// batching با تأخیر کوتاه، حفظ ترتیب تغییرات هر رکورد،
// صف خطا با Retry صریح و flush هنگام خروج از صفحه.
// هیچ پیام موفقیت قبل از تأیید Backend نمایش داده نمی‌شود.
// ═══════════════════════════════════════════════════════════
import { useCallback, useEffect, useRef, useState } from 'react'
import { timingApi, type SessionSheetDto } from '@/lib/api/endpoints'
import type { CellPayload } from './shared'

export type CellSaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

export interface CellSaver {
  status: CellSaveStatus
  lastError: string | null
  /** ثبت/ادغام تغییر یک سلول در صف (کلید = cycle×element) */
  schedule: (cycleId: string, payload: CellPayload) => void
  /** ارسال فوری صف (خروج از صفحه، Undo، ...) */
  flush: () => Promise<void>
  retry: () => void
  /** آیا تغییری در صف است */
  hasPending: () => boolean
}

export function useCellSaver(onSheet: (sheet: SessionSheetDto) => void): CellSaver {
  const [status, setStatus] = useState<CellSaveStatus>('idle')
  const [lastError, setLastError] = useState<string | null>(null)

  // صف ترتیب‌دار: cycleId → Map<elementId, payload> — ۶.۶
  const queueRef = useRef<Map<string, Map<string, CellPayload>>>(new Map())
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savingRef = useRef(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const doFlush = useCallback(async () => {
    if (savingRef.current) return
    if (queueRef.current.size === 0) return
    savingRef.current = true
    setStatus('saving')
    setLastError(null)

    // برداشتن عمیق صف فعلی؛ تغییرات جدید در صف جدید می‌مانند
    const batch = queueRef.current
    queueRef.current = new Map()

    try {
      for (const [cycleId, cellsMap] of batch) {
        const cells = Array.from(cellsMap.values())
        if (cells.length === 0) continue
        const res = await timingApi.updateCells(cycleId, cells)
        if (!mountedRef.current) return
        onSheet(res.sheet)
        if (res.warnings.length > 0) {
          // هشدار بدون توقف جریان کار — ۷.۶
          setLastError(null)
        }
      }
      if (!mountedRef.current) return
      setStatus('saved')
    } catch (err) {
      if (!mountedRef.current) return
      // تغییرات ناموفق به صف برمی‌گردند — ترتیب حفظ می‌شود — FR-23
      for (const [cycleId, cellsMap] of batch) {
        const existing = queueRef.current.get(cycleId) ?? new Map<string, CellPayload>()
        for (const [k, v] of cellsMap) existing.set(k, v)
        queueRef.current.set(cycleId, existing)
      }
      setStatus('error')
      setLastError(err instanceof Error ? err.message : 'خطای نامشخص در ذخیرهٔ سلول‌ها')
      return
    } finally {
      savingRef.current = false
    }

    // اگر حین ذخیره تغییرات جدید رسیده بود
    if (queueRef.current.size > 0) {
      void doFlush()
    }
  }, [onSheet])

  const schedule = useCallback(
    (cycleId: string, payload: CellPayload) => {
      const cycleMap = queueRef.current.get(cycleId) ?? new Map<string, CellPayload>()
      cycleMap.set(payload.workElementId, payload)
      queueRef.current.set(cycleId, cycleMap)
      setStatus('dirty')
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        void doFlush()
      }, 700)
    },
    [doFlush]
  )

  const flush = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    await doFlush()
  }, [doFlush])

  const retry = useCallback(() => {
    setStatus('dirty')
    void doFlush()
  }, [doFlush])

  const hasPending = useCallback(() => queueRef.current.size > 0, [])

  return { status, lastError, schedule, flush, retry, hasPending }
}
