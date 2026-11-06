// ═══════════════════════════════════════════════════════════
// نشانه‌گذاری Snapshot محاسبات به‌عنوان «نیازمند محاسبه مجدد» — FR-27
// هر تغییر مؤثر بر محاسبات (داده خام، ارزیابی، مجاز، روش،
// ساختار عناصر) باید نتایج snapshot قبلی را STALE کند؛
// خود snapshot حفظ می‌شود (تاریخ قابل بازتولید می‌ماند).
// ═══════════════════════════════════════════════════════════
import { db } from '@/lib/db'

export async function markProjectCalculationsStale(projectId: string | null | undefined): Promise<void> {
  if (!projectId) return
  await db.calculationRun.updateMany({
    where: { projectId, status: 'DONE' },
    data: { status: 'STALE' },
  })
}
