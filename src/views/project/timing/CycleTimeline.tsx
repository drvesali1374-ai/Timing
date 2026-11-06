'use client'

// ═══════════════════════════════════════════════════════════
// نمایش خط زمانی چرخه — FR-10
// بازه‌های هم‌پوشانی روی خطوط زمانی مستقل (اپراتور/ماشین)
// به‌صورت میله‌های نسبی؛ مقیاس بر اساس دیرترین پایان.
// زمان سپری‌شده = دیرترین پایان − زودترین شروع (نه جمع!)
// ═══════════════════════════════════════════════════════════
import { useMemo } from 'react'
import { Timer } from 'lucide-react'
import type { CycleRowDto, SessionSheetDto } from '@/lib/api/endpoints'
import { formatTimeValue, type DisplayPrefs as Prefs } from '@/lib/format'
import { ELEMENT_TYPE_BADGE, elementTypeLabel } from './shared'

interface TimelineBar {
  key: string
  elementName: string
  elementType: string
  start: number
  end: number
}

export function CycleTimeline({
  cycle,
  sheet,
  prefs,
}: {
  cycle: CycleRowDto
  sheet: SessionSheetDto
  prefs: Prefs
}) {
  const { lanes, maxEnd, bars } = useMemo(() => {
    const elementById = new Map(sheet.elements.map((e) => [e.id, e]))
    const allBars: TimelineBar[] = []
    for (const o of cycle.observations) {
      if (o.startOffset === null || o.endOffset === null) continue
      const el = elementById.get(o.workElementId)
      if (!el) continue
      allBars.push({
        key: o.id,
        elementName: el.name,
        elementType: el.elementType,
        start: o.startOffset,
        end: o.endOffset,
      })
    }
    const laneMap = new Map<string, TimelineBar[]>()
    for (const o of cycle.observations) {
      if (o.startOffset === null || o.endOffset === null) continue
      const el = elementById.get(o.workElementId)
      if (!el) continue
      const laneType = o.laneType ?? (el.elementType === 'MACHINE' || el.elementType === 'OVERLAP' ? 'MACHINE' : 'OPERATOR')
      const label = laneType === 'MACHINE' ? 'ماشین' : 'اپراتور'
      const list = laneMap.get(label) ?? []
      list.push({
        key: o.id,
        elementName: el.name,
        elementType: el.elementType,
        start: o.startOffset,
        end: o.endOffset,
      })
      laneMap.set(label, list)
    }
    const end = allBars.length > 0 ? Math.max(...allBars.map((b) => b.end)) : 0
    return { lanes: Array.from(laneMap.entries()), maxEnd: end, bars: allBars }
  }, [cycle, sheet.elements])

  if (bars.length === 0) {
    return (
      <p className="rounded-xl bg-muted p-3 text-xs leading-6 text-muted-foreground">
        در این چرخه بازهٔ زمانی (شروع/پایان) ثبت نشده است. برای عناصر هم‌زمان، مقدار را به‌صورت «شروع-پایان»
        وارد کنید تا خط زمانی ترسیم شود.
      </p>
    )
  }

  return (
    <div className="space-y-3 rounded-xl border bg-surface-2/40 p-3" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-bold">
          <Timer className="size-4 text-brand" aria-hidden />
          خط زمانی چرخهٔ {formatTimeValue(cycle.cycleNo, prefs, 0)}
        </p>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          {cycle.elapsed !== null && (
            <span className="num rounded-full bg-brand-soft px-2 py-0.5 font-bold text-brand">
              سپری‌شده: {formatTimeValue(cycle.elapsed, prefs)} ثانیه
            </span>
          )}
          <span className="num">مقیاس: ۰ تا {formatTimeValue(maxEnd, prefs)} ثانیه</span>
        </div>
      </div>

      {/* خطوط زمانی */}
      <div className="space-y-2">
        {lanes.map(([laneLabel, laneBars]) => (
          <div key={laneLabel} className="space-y-1">
            <p className="text-[11px] font-bold text-muted-foreground">{laneLabel}</p>
            <div className="relative h-10 rounded-lg bg-background/70 ring-1 ring-border/60">
              {/* خط مقیاس */}
              <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-border" aria-hidden />
              {laneBars.map((bar) => (
                <div
                  key={bar.key}
                  className={`absolute top-1.5 flex h-7 items-center justify-center overflow-hidden rounded-md text-[10px] font-bold leading-none ring-2 ring-inset shadow-sm ${
                    bar.elementType === 'MACHINE'
                      ? 'bg-cyan-soft text-cyan ring-cyan/60'
                      : bar.elementType === 'WAITING'
                        ? 'bg-amber-soft text-amber ring-amber/60'
                        : bar.elementType === 'OVERLAP'
                          ? 'bg-green-soft text-green ring-green/60'
                          : 'bg-brand-soft text-brand ring-brand/60'
                  } ${bar.end - bar.start < maxEnd * 0.12 ? 'justify-start pr-1' : ''}`}
                  style={{
                    right: `${(bar.start / maxEnd) * 100}%`,
                    width: `${Math.max(((bar.end - bar.start) / maxEnd) * 100, 2.5)}%`,
                  }}
                  title={`${bar.elementName}: ${formatTimeValue(bar.start, prefs)} تا ${formatTimeValue(bar.end, prefs)} (${formatTimeValue(bar.end - bar.start, prefs)} ثانیه)`}
                >
                  {bar.end - bar.start >= maxEnd * 0.12 ? (
                    <span className="truncate px-1">{bar.elementName}</span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* راهنمای عناصر */}
      <ul className="grid gap-1 text-[11px] text-muted-foreground sm:grid-cols-2">
        {bars.map((b) => (
          <li key={b.key} className="flex items-center justify-between gap-2 rounded-lg bg-background/60 px-2 py-1">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className={`size-2 shrink-0 rounded-full ${ELEMENT_TYPE_BADGE[b.elementType as keyof typeof ELEMENT_TYPE_BADGE]?.className ?? 'bg-muted'}`} aria-hidden />
              <span className="truncate font-bold text-foreground">{b.elementName}</span>
              <span className="shrink-0">({elementTypeLabel(b.elementType)})</span>
            </span>
            <span className="num shrink-0">
              {formatTimeValue(b.start, prefs)}–{formatTimeValue(b.end, prefs)}
            </span>
          </li>
        ))}
      </ul>

      {cycle.elapsedExcludesSequential && (
        <p className="rounded-lg bg-amber-soft p-2 text-[11px] leading-5 text-amber">
          توجه: این چرخه علاوه بر بازه‌ها، عناصر ترتیبی بدون موقعیت هم دارد؛ «سپری‌شده» فقط از بازه‌های
          دارای شروع/پایان محاسبه شده است.
        </p>
      )}
    </div>
  )
}

