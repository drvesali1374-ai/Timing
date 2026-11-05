'use client'

// ═══════════════════════════════════════════════════════════
// بوم نمودار فرایند OPC/FPC — فاز ۵ / FR-20
// ▸ درگ گره‌ها با Pointer Events + ذخیرهٔ خودکار مختصات (FR-20.7)
// ▸ یال‌های SVG: زنجیرهٔ توالی + اتصال دستی؛ کلیک روی یال = حذف
// ▸ حالت اتصال: انتخاب مبدأ → مقصد (فاز ۵ «اتصال گره‌ها»)
// ▸ ترتیب توالی: جابه‌جایی بالا/پایین با بازسازی زنجیره
// ▸ چیدمان خودکار لایه‌ای (FR-20.6)
// ═══════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ChevronDown,
  ChevronUp,
  Link2,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Waypoints,
} from 'lucide-react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDeleteDialog, EmptyState } from '@/components/common/Feedback'
import { chartsApi, type ChartEdgeDto, type ChartNodeDto, type ChartTypeValue } from '@/lib/api/endpoints'
import { qk } from '@/lib/api/keys'
import { PROCESS_TYPE_LABELS, PROCESS_TYPE_SYMBOLS, type ProcessType } from '@/domain/types'
import { useDisplayPrefs } from '@/store/display-store'
import { formatInt } from '@/lib/format'
import { cn } from '@/lib/utils'

// ابعاد مرجع گره — باید با ثابت‌های چیدمان بک‌اند هماهنگ بماند
const NODE_W = 200
const NODE_H = 96
const MARGIN = 48

const NODE_TYPES: ProcessType[] = ['OPERATION', 'INSPECTION', 'TRANSPORT', 'DELAY', 'STORAGE']
const OPC_TYPES: ProcessType[] = ['OPERATION', 'INSPECTION']

/** نماد و رنگ هر نوع رویداد (قرارداد رایج نمودارهای فرایند) */
const TYPE_STYLE: Record<string, { box: string }> = {
  OPERATION: { box: 'rounded-full border-2 border-brand text-brand bg-brand-soft' },
  INSPECTION: { box: 'rounded-md border-2 border-amber text-amber bg-amber-soft' },
  TRANSPORT: { box: 'rounded-md border-2 border-muted-foreground/60 text-muted-foreground' },
  DELAY: { box: 'rounded-md border-2 border-red text-red bg-red-soft' },
  STORAGE: { box: 'rounded-md border-2 border-green text-green bg-green-soft' },
}

interface Position {
  x: number
  y: number
}

function edgePath(s: Position, t: Position): string {
  const sc = { x: s.x + NODE_W / 2, y: s.y + NODE_H / 2 }
  const tc = { x: t.x + NODE_W / 2, y: t.y + NODE_H / 2 }
  const dy = tc.y - sc.y
  if (Math.abs(dy) > 24) {
    // جریان عمودی: پایین مبدأ → بالای مقصد
    const x1 = sc.x
    const y1 = s.y + NODE_H
    const x2 = tc.x
    const y2 = t.y - 2
    const mid = (y1 + y2) / 2
    return `M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`
  }
  // جریان افقی (هم‌لایه): پهلو به پهلو
  const x1 = tc.x > sc.x ? s.x + NODE_W : s.x
  const x2 = tc.x > sc.x ? t.x - 2 : t.x + NODE_W + 2
  const y1 = sc.y
  const y2 = tc.y
  const mid = (x1 + x2) / 2
  return `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`
}

export default function ChartCanvas({ projectId, chartType }: { projectId: string; chartType: ChartTypeValue }) {
  const prefs = useDisplayPrefs()
  const qc = useQueryClient()

  const chartQuery = useQuery({
    queryKey: qk.chart(projectId, chartType),
    queryFn: () => chartsApi.get(projectId, chartType),
  })

  // ── وضعیت محلی ──
  const [positions, setPositions] = useState<Record<string, Position>>({}) // درگ خوش‌بینانه
  const [dragging, setDragging] = useState<{ id: string; startX: number; startY: number; orig: Position } | null>(null)
  const [connectMode, setConnectMode] = useState(false)
  const [connectSource, setConnectSource] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [editNode, setEditNode] = useState<ChartNodeDto | null>(null)
  const [infoNode, setInfoNode] = useState<ChartNodeDto | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ChartNodeDto | null>(null)
  const [edgeTarget, setEdgeTarget] = useState<ChartEdgeDto | null>(null)
  const dragMovedRef = useRef(false)

  const data = chartQuery.data
  const nodes = useMemo(() => data?.nodes ?? [], [data])
  const edges = useMemo(() => data?.edges ?? [], [data])
  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])
  // توجه: ChartsView با key={chartType} رندر می‌شود؛ تغییر نوع نمودار = remount کامل و پاک‌سازی خودکار وضعیت محلی

  // ساخت/تغییر نمودار، وضعیت مرحلهٔ سایدبار را عوض می‌کند
  useEffect(() => {
    if (data) {
      void qc.invalidateQueries({ queryKey: qk.projectSummary(projectId) })
    }
  }, [data?.counts.total, data, projectId, qc])

  const pos = useCallback(
    (n: ChartNodeDto): Position => positions[n.id] ?? { x: n.positionX, y: n.positionY },
    [positions]
  )

  const invalidateAll = useCallback(async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: qk.chart(projectId, chartType) }),
      qc.invalidateQueries({ queryKey: qk.projectSummary(projectId) }),
    ])
  }, [qc, projectId, chartType])

  // ── جهش‌ها ──
  const savePositionMutation = useMutation({
    mutationFn: ({ nodeId, x, y }: { nodeId: string; x: number; y: number }) =>
      chartsApi.updateNode(nodeId, { positionX: x, positionY: y }),
    onError: (e: Error) => toast.error(`ذخیرهٔ مختصات گره ناموفق بود: ${e.message}`),
  })

  const moveOrderMutation = useMutation({
    mutationFn: (body: { nodeId: string; direction: 'up' | 'down' }) =>
      chartsApi.moveOrder(projectId, chartType, body),
    onSuccess: invalidateAll,
    onError: (e: Error) => toast.error(e.message),
  })

  const layoutMutation = useMutation({
    mutationFn: () => chartsApi.applyLayout(projectId, chartType),
    onSuccess: async () => {
      setPositions({})
      await invalidateAll()
      toast.success('چیدمان خودکار اعمال شد؛ چیدمان دستی قبلی جایگزین شد.')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const createNodeMutation = useMutation({
    mutationFn: (body: { label: string; nodeType: string }) => chartsApi.createNode(projectId, chartType, body),
    onSuccess: async () => {
      setCreateOpen(false)
      await invalidateAll()
      toast.success('گره دستی به انتهای توالی اضافه شد.')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const updateContentMutation = useMutation({
    mutationFn: ({ nodeId, body }: { nodeId: string; body: { label?: string; nodeType?: string } }) =>
      chartsApi.updateNode(nodeId, body),
    onSuccess: async () => {
      setEditNode(null)
      await invalidateAll()
      toast.success('گره به‌روزرسانی شد.')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteNodeMutation = useMutation({
    mutationFn: (nodeId: string) => chartsApi.deleteNode(nodeId),
    onSuccess: async () => {
      setDeleteTarget(null)
      await invalidateAll()
      toast.success('گره دستی حذف شد؛ گره‌های خودکار فعالیت‌ها دست‌نخورده‌اند.')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const createEdgeMutation = useMutation({
    mutationFn: (body: { sourceNodeId: string; targetNodeId: string }) => chartsApi.createEdge(projectId, body),
    onSuccess: async () => {
      setConnectSource(null)
      await invalidateAll()
      toast.success('اتصال ایجاد شد.')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteEdgeMutation = useMutation({
    mutationFn: (edgeId: string) => chartsApi.deleteEdge(edgeId),
    onSuccess: async () => {
      setEdgeTarget(null)
      await invalidateAll()
      toast.success('اتصال حذف شد؛ مشاهدات زمان‌سنجی تغییری نکرده‌اند.')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // ── درگ گره — Pointer Events (موس + لمس) ──
  const onPointerDown = (e: React.PointerEvent, node: ChartNodeDto) => {
    if (connectMode) return
    if ((e.target as HTMLElement).closest('button')) return
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    dragMovedRef.current = false
    setDragging({ id: node.id, startX: e.clientX, startY: e.clientY, orig: pos(node) })
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return
    const dx = e.clientX - dragging.startX
    const dy = e.clientY - dragging.startY
    if (Math.abs(dx) + Math.abs(dy) > 3) dragMovedRef.current = true
    setPositions((p) => ({ ...p, [dragging.id]: { x: Math.round(dragging.orig.x + dx), y: Math.round(dragging.orig.y + dy) } }))
  }

  const onPointerUp = () => {
    if (dragging && dragMovedRef.current) {
      const p = positions[dragging.id]
      if (p) savePositionMutation.mutate({ nodeId: dragging.id, x: p.x, y: p.y })
    }
    setDragging(null)
  }

  // ── حالت اتصال ──
  const onNodeClickConnect = (node: ChartNodeDto) => {
    if (!connectSource) {
      setConnectSource(node.id)
      toast.info(`گره مبدأ انتخاب شد: «${node.label}». اکنون گره مقصد را انتخاب کنید.`)
      return
    }
    if (connectSource === node.id) {
      setConnectSource(null)
      return
    }
    createEdgeMutation.mutate({ sourceNodeId: connectSource, targetNodeId: node.id })
  }

  // ── رندر ──
  if (chartQuery.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-[480px] w-full rounded-2xl" />
      </div>
    )
  }
  if (chartQuery.isError) {
    return (
      <EmptyState
        title="بارگذاری نمودار ناموفق بود"
        description={chartQuery.error instanceof Error ? chartQuery.error.message : 'خطای نامشخص'}
        action={<Button variant="outline" onClick={() => void chartQuery.refetch()}>تلاش دوباره</Button>}
      />
    )
  }
  if (!data) return null

  const counts = data.counts
  const allowedTypes = chartType === 'OPC' ? OPC_TYPES : NODE_TYPES

  if (counts.activitiesTotal === 0) {
    return (
      <EmptyState
        icon={<Waypoints className="size-7" aria-hidden />}
        title="هنوز فعالیتی تعریف نشده است"
        description="گره‌های نمودار فرایند به‌صورت خودکار از فعالیت‌های تعریف‌شده در «ساختار تولید» ساخته می‌شوند. ابتدا ایستگاه و فعالیت بسازید."
      />
    )
  }

  if (nodes.length === 0) {
    return (
      <EmptyState
        icon={<Waypoints className="size-7" aria-hidden />}
        title={chartType === 'OPC' ? 'فعالیتی برای OPC مشمول نیست' : 'گره‌ای برای نمایش نیست'}
        description={
          chartType === 'OPC'
            ? 'در نمودار OPC فقط فعالیت‌های از نوع «عملیات» و «بازرسی» نمایش داده می‌شوند. فعالیت‌های حمل‌ونقل، تأخیر و انبارش را در نمای FPC ببینید.'
            : 'گره‌ای برای نمایش وجود ندارد.'
        }
      />
    )
  }

  // ابعاد مؤثر بوم (با احتساب درگ محلی)
  let canvasW = data.canvas.width
  let canvasH = data.canvas.height
  for (const n of nodes) {
    const p = pos(n)
    canvasW = Math.max(canvasW, p.x + NODE_W + MARGIN)
    canvasH = Math.max(canvasH, p.y + NODE_H + MARGIN)
  }

  const unconnected = nodes.filter(
    (n) => !edges.some((e) => e.sourceNodeId === n.id || e.targetNodeId === n.id)
  ).length

  return (
    <div className="space-y-4">
      {/* نوار ابزار */}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" aria-hidden />
          گره دستی
        </Button>
        <Button
          size="sm"
          variant={connectMode ? 'default' : 'outline'}
          aria-pressed={connectMode}
          onClick={() => {
            setConnectMode((v) => !v)
            setConnectSource(null)
          }}
        >
          <Link2 className="size-4" aria-hidden />
          اتصال گره‌ها
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => layoutMutation.mutate()}
          disabled={layoutMutation.isPending}
        >
          {layoutMutation.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          چیدمان خودکار
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void qc.invalidateQueries({ queryKey: qk.chart(projectId, chartType) })}
          aria-label="بازخوانی نمودار از فعالیت‌ها"
        >
          <RefreshCw className="size-4" aria-hidden />
          بازخوانی
        </Button>
        <div className="ms-auto flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {NODE_TYPES.filter((t) => chartType === 'FPC' || OPC_TYPES.includes(t)).map((t) => (
            <span key={t} className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5', counts.byType[t] ? 'border-border' : 'opacity-40')}>
              <span aria-hidden>{PROCESS_TYPE_SYMBOLS[t]}</span>
              {PROCESS_TYPE_LABELS[t]}: {formatInt(counts.byType[t] ?? 0, prefs)}
            </span>
          ))}
          {counts.manual > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5">
              دستی: {formatInt(counts.manual, prefs)}
            </span>
          )}
        </div>
      </div>

      {/* بنر حالت اتصال */}
      {connectMode && (
        <div className="flex items-center gap-2 rounded-xl bg-amber-soft px-3 py-2 text-xs font-medium text-amber" role="status">
          <Link2 className="size-4 shrink-0" aria-hidden />
          حالت اتصال فعال است: ابتدا گره مبدأ و سپس گره مقصد را انتخاب کنید. برای پایان، دوباره «اتصال گره‌ها» را بزنید.
        </div>
      )}

      {unconnected > 0 && !connectMode && (
        <div className="rounded-xl bg-amber-soft px-3 py-2 text-xs text-amber" role="status">
          {formatInt(unconnected, prefs)} گره به هیچ گره دیگری متصل نیست؛ توالی نمودار را با «اتصال گره‌ها» کامل کنید.
        </div>
      )}

      {/* بوم */}
      <div
        className="relative max-h-[72vh] overflow-auto rounded-2xl border bg-gradient-subtle"
        dir="ltr"
        role="application"
        aria-label={`بوم نمودار ${chartType}`}
      >
        <div className="relative" style={{ width: canvasW, height: canvasH }}>
          {/* یال‌ها */}
          <svg className="pointer-events-none absolute inset-0" width={canvasW} height={canvasH} aria-hidden>
            <defs>
              <marker id={`arrow-${chartType}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" className="fill-brand" />
              </marker>
            </defs>
            {edges.map((e) => {
              const s = nodeById.get(e.sourceNodeId)
              const t = nodeById.get(e.targetNodeId)
              if (!s || !t) return null
              const d = edgePath(pos(s), pos(t))
              return (
                <g key={e.id} className="pointer-events-auto cursor-pointer" onClick={() => setEdgeTarget(e)}>
                  <title>حذف اتصال</title>
                  <path d={d} className="fill-none stroke-transparent" strokeWidth={14} />
                  <path
                    d={d}
                    className={cn(
                      'fill-none transition-colors hover:stroke-red',
                      e.isChain ? 'stroke-brand/55' : 'stroke-brand-2/70'
                    )}
                    strokeWidth={2}
                    strokeDasharray={e.isChain ? undefined : '6 4'}
                    markerEnd={`url(#arrow-${chartType})`}
                  />
                </g>
              )
            })}
          </svg>

          {/* گره‌ها */}
          {nodes.map((n) => {
            const p = pos(n)
            const isDragging = dragging?.id === n.id
            const isSource = connectSource === n.id
            const style = TYPE_STYLE[n.nodeType] ?? TYPE_STYLE.OPERATION
            return (
              <div
                key={n.id}
                className={cn(
                  'group absolute rounded-xl border bg-card p-2.5 shadow-sm transition-shadow',
                  connectMode ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing',
                  isDragging && 'z-50 shadow-lg ring-2 ring-brand/40',
                  isSource && 'ring-2 ring-amber',
                  'hover:shadow-md focus-visible:outline-2 focus-visible:outline-ring'
                )}
                style={{ left: p.x, top: p.y, width: NODE_W, touchAction: 'none', userSelect: 'none' }}
                dir="rtl"
                role="button"
                tabIndex={0}
                aria-label={`گره ${formatInt(n.sortOrder + 1, prefs)}: ${n.label}`}
                onPointerDown={(e) => onPointerDown(e, n)}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onClick={() => {
                  if (connectMode) onNodeClickConnect(n)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && connectMode) onNodeClickConnect(n)
                  if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    moveOrderMutation.mutate({ nodeId: n.id, direction: 'up' })
                  }
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    moveOrderMutation.mutate({ nodeId: n.id, direction: 'down' })
                  }
                }}
              >
                {/* شماره توالی */}
                <span className="absolute -start-1.5 -top-1.5 inline-flex size-6 items-center justify-center rounded-full border bg-background text-[11px] font-bold num">
                  {formatInt(n.sortOrder + 1, prefs)}
                </span>

                <div className="flex items-start gap-2.5">
                  <span className={cn('flex size-9 shrink-0 items-center justify-center text-lg font-bold', style.box)} aria-hidden>
                    {PROCESS_TYPE_SYMBOLS[n.nodeType as ProcessType]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold leading-6" title={n.label}>{n.label}</p>
                    <p className="truncate text-[11px] leading-5 text-muted-foreground">
                      {PROCESS_TYPE_LABELS[n.nodeType as ProcessType]}
                      {n.isManual ? ' · گره دستی' : n.stationName ? ` · ${n.stationName}` : ''}
                    </p>
                  </div>
                </div>

                {/* کنترل‌ها — با هاور یا فوکوس نمایان */}
                <div className="absolute -bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-full border bg-background p-0.5 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                  <button
                    type="button"
                    className="inline-flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-brand-soft hover:text-brand disabled:opacity-30"
                    aria-label={`جابه‌جایی «${n.label}» به بالا در توالی`}
                    disabled={moveOrderMutation.isPending || n.sortOrder === 0}
                    onClick={() => moveOrderMutation.mutate({ nodeId: n.id, direction: 'up' })}
                  >
                    <ChevronUp className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="inline-flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-brand-soft hover:text-brand disabled:opacity-30"
                    aria-label={`جابه‌جایی «${n.label}» به پایین در توالی`}
                    disabled={moveOrderMutation.isPending || n.sortOrder === nodes.length - 1}
                    onClick={() => moveOrderMutation.mutate({ nodeId: n.id, direction: 'down' })}
                  >
                    <ChevronDown className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="inline-flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-brand-soft hover:text-brand"
                    aria-label={n.isManual ? `ویرایش گره «${n.label}»` : `مشاهدهٔ جزئیات گره «${n.label}»`}
                    onClick={() => (n.isManual ? setEditNode(n) : setInfoNode(n))}
                  >
                    <Pencil className="size-3.5" aria-hidden />
                  </button>
                  {n.isManual && (
                    <button
                      type="button"
                      className="inline-flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-red-soft hover:text-red"
                      aria-label={`حذف گره «${n.label}»`}
                      onClick={() => setDeleteTarget(n)}
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <p className="text-xs leading-6 text-muted-foreground">
        {chartType === 'OPC' ? (
          <>
            OPC فقط عملیات و بازرسی را نشان می‌دهد؛ {formatInt(counts.activitiesIncluded, prefs)} از{' '}
            {formatInt(counts.activitiesTotal, prefs)} فعالیت در این نمودار هستند. گره‌های خودکار از فعالیت‌ها ساخته شده‌اند و با تغییر فعالیت به‌روز می‌شوند.
          </>
        ) : (
          <>
            FPC هر پنج نوع رویداد فرایند را پوشش می‌دهد؛ {formatInt(counts.activitiesIncluded, prefs)} از{' '}
            {formatInt(counts.activitiesTotal, prefs)} فعالیت گره خودکار دارند. یال‌های نقطه‌چین، اتصال دستی شما هستند؛ یال‌های ممتد، زنجیرهٔ توالی.
          </>
        )}
        {' '}جابه‌جایی گره‌ها با کشیدن، به‌صورت خودکار ذخیره می‌شود.
      </p>

      {/* دیالوگ ایجاد گره دستی */}
      <ManualNodeDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        allowedTypes={allowedTypes}
        onSubmit={(v) => createNodeMutation.mutate(v)}
        loading={createNodeMutation.isPending}
        title="گره دستی جدید"
        description="برای رویدادهایی که فعالیت زمان‌سنجی مستقیم ندارند (مثلاً انتقال بین ایستگاه‌ها یا انبارش موقت)."
      />

      {/* دیالوگ ویرایش گره دستی */}
      <ManualNodeDialog
        open={Boolean(editNode)}
        onOpenChange={(v) => !v && setEditNode(null)}
        allowedTypes={allowedTypes}
        initial={editNode ? { label: editNode.label, nodeType: editNode.nodeType } : undefined}
        onSubmit={(v) => editNode && updateContentMutation.mutate({ nodeId: editNode.id, body: v })}
        loading={updateContentMutation.isPending}
        title="ویرایش گره دستی"
        description="برچسب و نوع رویداد این گره را ویرایش کنید."
      />

      {/* دیالوگ اطلاعات گره خودکار */}
      <Dialog open={Boolean(infoNode)} onOpenChange={(v) => !v && setInfoNode(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>گره خودکار — متصل به فعالیت</DialogTitle>
            <DialogDescription>
              این گره از فعالیت «{infoNode?.activityName}» ساخته شده است. برچسب و نوع آن از مشخصات فعالیت می‌آید و
              شناسهٔ ارتباط پایدار است؛ برای تغییر، فعالیت را در «ساختار تولید» ویرایش کنید — این نمودار خودکار به‌روز
              می‌شود.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-brand-soft/60 p-3 text-sm">
            <span className="text-muted-foreground">برچسب:</span>
            <span className="font-bold">{infoNode?.label}</span>
            <span className="text-muted-foreground">نوع رویداد:</span>
            <span className="font-bold">{infoNode ? PROCESS_TYPE_LABELS[infoNode.nodeType as ProcessType] : ''}</span>
            <span className="text-muted-foreground">ایستگاه:</span>
            <span className="font-bold">{infoNode?.stationName ?? '—'}</span>
            <span className="text-muted-foreground">جایگاه توالی:</span>
            <span className="font-bold num">{infoNode ? formatInt(infoNode.sortOrder + 1, prefs) : ''}</span>
          </div>
        </DialogContent>
      </Dialog>

      {/* تأیید حذف گره دستی */}
      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="حذف گره دستی نمودار"
        entityName={deleteTarget?.label ?? ''}
        dependencies={{
          'اتصال‌های این گره': edges.filter(
            (e) => e.sourceNodeId === deleteTarget?.id || e.targetNodeId === deleteTarget?.id
          ).length,
        }}
        onConfirm={() => deleteTarget && deleteNodeMutation.mutate(deleteTarget.id)}
        loading={deleteNodeMutation.isPending}
      />

      {/* تأیید حذف اتصال */}
      <AlertDialog open={Boolean(edgeTarget)} onOpenChange={(v) => !v && setEdgeTarget(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف اتصال گره‌ها؟</AlertDialogTitle>
            <AlertDialogDescription>
              اتصال بین «{edgeTarget ? nodeById.get(edgeTarget.sourceNodeId)?.label : ''}» و «
              {edgeTarget ? nodeById.get(edgeTarget.targetNodeId)?.label : ''}» حذف می‌شود. این تغییر فقط نمودار را
              تغییر می‌دهد و هیچ دادهٔ زمان‌سنجی حذف نمی‌شود.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red text-white hover:bg-red/90"
              onClick={(e) => {
                e.preventDefault()
                if (edgeTarget) deleteEdgeMutation.mutate(edgeTarget.id)
              }}
            >
              حذف اتصال
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/** دیالوگ ایجاد/ویرایش گره دستی — فرم با mount تازه در هر بار باز شدن (بدون Effect) */
function ManualNodeDialog({
  open,
  onOpenChange,
  allowedTypes,
  initial,
  onSubmit,
  loading,
  title,
  description,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  allowedTypes: ProcessType[]
  initial?: { label: string; nodeType: string }
  onSubmit: (v: { label: string; nodeType: string }) => void
  loading?: boolean
  title: string
  description: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {open && (
          <ManualNodeForm
            key={initial ? `edit-${initial.label}-${initial.nodeType}` : 'create'}
            allowedTypes={allowedTypes}
            initial={initial}
            onSubmit={onSubmit}
            loading={loading}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function ManualNodeForm({
  allowedTypes,
  initial,
  onSubmit,
  loading,
  onCancel,
}: {
  allowedTypes: ProcessType[]
  initial?: { label: string; nodeType: string }
  onSubmit: (v: { label: string; nodeType: string }) => void
  loading?: boolean
  onCancel: () => void
}) {
  const [label, setLabel] = useState(initial?.label ?? '')
  const [nodeType, setNodeType] = useState<string>(initial?.nodeType ?? allowedTypes[0])

  const submit = () => {
    const trimmed = label.trim()
    if (!trimmed) {
      toast.error('برچسب گره الزامی است.')
      return
    }
    onSubmit({ label: trimmed, nodeType })
  }

  return (
    <>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="manual-node-label">برچسب گره</Label>
          <Input
            id="manual-node-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="مثلاً: انتقال قطعه به ایستگاه بعد"
            maxLength={200}
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label>نوع رویداد فرایندی</Label>
          <Select value={nodeType} onValueChange={setNodeType}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {allowedTypes.map((t) => (
                <SelectItem key={t} value={t}>
                  <span className="inline-flex items-center gap-2">
                    <span aria-hidden>{PROCESS_TYPE_SYMBOLS[t]}</span>
                    {PROCESS_TYPE_LABELS[t]}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {allowedTypes.length === 2
              ? 'در نمودار OPC فقط عملیات و بازرسی مجاز است.'
              : 'نوع رویداد، نماد گره در نمودار را تعیین می‌کند.'}
          </p>
        </div>
      </div>
      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onCancel}>انصراف</Button>
        <Button onClick={submit} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          ذخیره
        </Button>
      </DialogFooter>
    </>
  )
}
