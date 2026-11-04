'use client'

// ═══════════════════════════════════════════════════════════
// فهرست قابل مرتب‌سازی با Drag & Drop — FR-02
// پوشش عمومی روی @dnd-kit برای ایستگاه/فعالیت/عنصر
// ═══════════════════════════════════════════════════════════
import { useState, type ReactNode } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SortableItemProps {
  id: string
  children: ReactNode
  handleClassName?: string
}

export function SortableItem({ id, children, handleClassName }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group/sortable relative flex items-stretch gap-0',
        isDragging && 'z-10 opacity-80'
      )}
    >
      <button
        type="button"
        className={cn(
          'flex w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-r-lg text-faint opacity-0 transition-opacity hover:bg-muted focus-visible:opacity-100 group-hover/sortable:opacity-100 active:cursor-grabbing',
          handleClassName
        )}
        aria-label="جابه‌جایی"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" aria-hidden />
      </button>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  renderItem,
  className,
}: {
  items: T[]
  onReorder: (orderedIds: string[]) => void
  renderItem: (item: T, index: number) => ReactNode
  className?: string
}) {
  const [activeIds, setActiveIds] = useState(items.map((i) => i.id))
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // همگام‌سازی با داده بیرونی
  const ids = items.map((i) => i.id)
  if (JSON.stringify(ids) !== JSON.stringify(activeIds)) {
    setActiveIds(ids)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = activeIds.indexOf(String(active.id))
    const newIndex = activeIds.indexOf(String(over.id))
    if (oldIndex < 0 || newIndex < 0) return
    const newIds = arrayMove(activeIds, oldIndex, newIndex)
    setActiveIds(newIds)
    onReorder(newIds)
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={activeIds} strategy={verticalListSortingStrategy}>
        <div className={cn('space-y-2', className)}>
          {items.map((item, index) => (
            <SortableItem key={item.id} id={item.id}>
              {renderItem(item, index)}
            </SortableItem>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
