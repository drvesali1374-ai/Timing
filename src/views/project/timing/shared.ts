// ═══════════════════════════════════════════════════════════
// زمان‌سنجی — انواع و ابزارهای مشترک UI برگه — FR-07
// پارس اعداد فارسی/لاتین، قالب‌بندی نمایش، مدل ستون عنصر
// ═══════════════════════════════════════════════════════════
import type { CycleRowDto, ObservationCellDto, SessionSheetDto } from '@/lib/api/endpoints'
import { parseNumber } from '@/lib/persian'
import type { DisplayPrefs } from '@/lib/format'
import { formatTimeValue } from '@/lib/format'
import { ELEMENT_TYPE_LABELS, type ElementType } from '@/domain/types'

/** نوع مقدار یک سلول پس از پارس ورودی کاربر */
export type ParsedCellValue =
  | { kind: 'EMPTY' }
  | { kind: 'NUMBER'; value: number }
  | { kind: 'INTERVAL'; start: number; end: number }
  | { kind: 'INVALID'; reason: string }

/** پارس ورودی سلول — یک عدد یا بازهٔ «شروع-پایان» — FR-07 */
export function parseCellInput(text: string): ParsedCellValue {
  const t = text.trim()
  if (t === '' || t === '-' || t === '—' || t === '–') return { kind: 'EMPTY' }
  const normalized = t
    .replace(/\s*تا\s*/, '-')
    .replace(/\s*\.\.\s*/, '-')
    .replace(/\s*:\s*/, '-')
    .replace(/\s*-\s*/, '-')
  const intervalMatch = normalized.match(/^(-?[\d.,٫\u0660-\u0669\u06f0-\u06f9]+)-(-?[\d.,٫\u0660-\u0669\u06f0-\u06f9]+)$/)
  if (intervalMatch) {
    const start = parseNumber(intervalMatch[1])
    const end = parseNumber(intervalMatch[2])
    if (Number.isFinite(start) && Number.isFinite(end)) return { kind: 'INTERVAL', start, end }
    return { kind: 'INVALID', reason: 'عدد بازه معتبر نیست' }
  }
  const n = parseNumber(normalized)
  if (!Number.isFinite(n)) return { kind: 'INVALID', reason: 'مقدار عددی معتبر نیست (ارقام فارسی یا لاتین)' }
  return { kind: 'NUMBER', value: n }
}

/** بارهای ارسالی سلول به API */
export interface CellPayload {
  workElementId: string
  rawDuration?: number | null
  cumulativeReading?: number | null
  startOffset?: number | null
  endOffset?: number | null
}

/** حالت ورود یک عنصر در برگه */
export interface ElementColumn {
  index: number
  id: string
  name: string
  elementType: ElementType
  entryMode: 'SEQ' | 'INT'
}

export function buildColumns(sheet: SessionSheetDto, overrides: Record<string, 'SEQ' | 'INT'>): ElementColumn[] {
  return sheet.elements.map((e, i) => ({
    index: i,
    id: e.id,
    name: e.name,
    elementType: e.elementType as ElementType,
    entryMode: overrides[e.id] ?? e.defaultEntry,
  }))
}

export function findObservation(cycle: CycleRowDto, workElementId: string): ObservationCellDto | undefined {
  return cycle.observations.find((o) => o.workElementId === workElementId)
}

/** متن نمایشی یک سلول بر اساس دادهٔ سرور — دو رقم اعشار پیش‌فرض — FR-07 */
export function cellDisplayValue(
  obs: ObservationCellDto | undefined,
  method: 'SNAPBACK' | 'CONTINUOUS',
  prefs: DisplayPrefs
): string {
  if (!obs) return ''
  if (obs.startOffset !== null || obs.endOffset !== null) {
    if (obs.startOffset !== null && obs.endOffset !== null) {
      return `${formatTimeValue(obs.startOffset, prefs)} – ${formatTimeValue(obs.endOffset, prefs)}`
    }
    return obs.startOffset !== null ? `${formatTimeValue(obs.startOffset, prefs)} – ؟` : `؟ – ${formatTimeValue(obs.endOffset, prefs)}`
  }
  if (method === 'CONTINUOUS' && obs.cumulativeReading !== null) {
    return formatTimeValue(obs.cumulativeReading, prefs)
  }
  if (obs.rawDuration !== null) return formatTimeValue(obs.rawDuration, prefs)
  return ''
}

/** مقدار ویرایش اولیهٔ سلول هنگام شروع تایپ (لاتین، بدون قالب‌بندی) */
export function cellEditValue(
  obs: ObservationCellDto | undefined,
  method: 'SNAPBACK' | 'CONTINUOUS'
): { seq: string; start: string; end: string } {
  if (!obs) return { seq: '', start: '', end: '' }
  const round = (v: number | null) => (v === null ? '' : String(Math.round(v * 1e6) / 1e6))
  return {
    seq: round(method === 'CONTINUOUS' ? obs.cumulativeReading : obs.rawDuration),
    start: round(obs.startOffset),
    end: round(obs.endOffset),
  }
}

/** ساخت payload از ورودی پارس‌شده بر اساس روش جلسه و حالت عنصر */
export function payloadFromParsed(
  parsed: ParsedCellValue,
  column: ElementColumn,
  method: 'SNAPBACK' | 'CONTINUOUS'
): CellPayload | { error: string } {
  const base: CellPayload = { workElementId: column.id }
  if (parsed.kind === 'EMPTY') {
    // پاک‌کردن کامل سلول — خالی با صفر یکسان نیست — ۸.۲
    if (column.entryMode === 'INT') {
      base.startOffset = null
      base.endOffset = null
    } else if (method === 'CONTINUOUS') {
      base.cumulativeReading = null
    } else {
      base.rawDuration = null
    }
    return base
  }
  if (parsed.kind === 'INVALID') return { error: parsed.reason }
  if (parsed.kind === 'INTERVAL') {
    if (parsed.start < 0) return { error: 'شروع بازه نمی‌تواند منفی باشد' }
    if (parsed.end <= parsed.start) return { error: 'پایان بازه باید بزرگ‌تر از شروع آن باشد' }
    base.startOffset = parsed.start
    base.endOffset = parsed.end
    return base
  }
  // NUMBER
  if (parsed.value < 0) return { error: 'زمان منفی مجاز نیست' }
  if (method === 'CONTINUOUS') base.cumulativeReading = parsed.value
  else base.rawDuration = parsed.value
  return base
}

/** مقدار قبلی سلول برای Undo — دقیقاً همان فیلدهایی که اکنون مقدار دارند */
export function captureBefore(
  obs: ObservationCellDto | undefined,
  workElementId: string
): CellPayload {
  const p: CellPayload = { workElementId }
  if (!obs) return p
  p.rawDuration = obs.rawDuration
  p.cumulativeReading = obs.cumulativeReading
  p.startOffset = obs.startOffset
  p.endOffset = obs.endOffset
  return p
}

export const ELEMENT_TYPE_BADGE: Record<ElementType, { label: string; className: string }> = {
  MANUAL: { label: 'دستی', className: 'bg-brand-soft text-brand' },
  MACHINE: { label: 'ماشین', className: 'bg-cyan-soft text-cyan' },
  WAITING: { label: 'انتظار', className: 'bg-amber-soft text-amber' },
  OVERLAP: { label: 'هم‌پوشان', className: 'bg-green-soft text-green' },
}

export function elementTypeLabel(t: string): string {
  return ELEMENT_TYPE_LABELS[t as ElementType] ?? t
}

/** دلایل استاندارد خروج از محاسبه — FR-11 */
export const EXCLUSION_REASONS = [
  'اپراتور کار را در میانهٔ چرخه متوقف کرد',
  'مداخلهٔ بیرونی در چرخه (سرپرست/مواد/قطعه)',
  'خطای ثبت یا خواندن زمان',
  'مواد یا قطعهٔ غیرمعیار',
  'چرخهٔ نمایندهٔ شرایط عادی نیست',
] as const
