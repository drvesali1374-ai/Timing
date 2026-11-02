/**
 * زیرساخت ماژول ایستگاه‌های کاری — Prisma (ADR-017).
 */

import { db } from "@/lib/db";

export interface StationRow {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  orderIndex: number;
  archived: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function listStationRows(projectId: string, includeArchived = false): Promise<StationRow[]> {
  return db.workStation.findMany({
    where: includeArchived ? { projectId } : { projectId, archived: false },
    orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
  });
}

export async function findStationById(projectId: string, id: string): Promise<StationRow | null> {
  return db.workStation.findFirst({ where: { id, projectId } });
}

export async function findStationByName(projectId: string, name: string): Promise<StationRow | null> {
  return db.workStation.findUnique({ where: { projectId_name: { projectId, name } } });
}

export async function insertStationRow(input: {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  orderIndex: number;
  createdBy: string;
}): Promise<void> {
  await db.workStation.create({ data: input });
}

export async function updateStationRow(
  projectId: string,
  id: string,
  data: Partial<{ name: string; description: string | null; orderIndex: number; archived: boolean }>,
): Promise<void> {
  await db.workStation.update({ where: { id }, data });
}

export async function maxStationOrder(projectId: string): Promise<number> {
  const last = await db.workStation.findFirst({
    where: { projectId },
    orderBy: { orderIndex: "desc" },
    select: { orderIndex: true },
  });
  return last?.orderIndex ?? 0;
}

export async function countStationActivities(stationId: string): Promise<number> {
  return db.activity.count({ where: { stationId, archived: false } });
}

/** تعداد فعالیت‌های هر ایستگاه — یک کوئری گروهی */
export async function countActivitiesByStation(projectId: string): Promise<Map<string, number>> {
  const rows = await db.activity.groupBy({
    by: ["stationId"],
    where: { projectId, archived: false, stationId: { not: null } },
    _count: { _all: true },
  });
  const map = new Map<string, number>();
  for (const r of rows) {
    if (r.stationId) map.set(r.stationId, r._count._all);
  }
  return map;
}
