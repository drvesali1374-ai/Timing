/**
 * لایه Application ماژول ایستگاه‌های کاری (ADR-017).
 * ایستگاه داده پروژه است؛ تغییرها ممیزی می‌شوند.
 */

import { uuidv7 } from "@/shared/ids";
import { ApiError } from "@/shared/errors";
import { getLogger } from "@/shared/logger";
import { AUDIT_ACTIONS, recordAudit } from "@/modules/audit/application/audit-service";
import { assertStationName } from "../domain/station";
import type { StationDto } from "@/shared/contracts/stations";
import type { BulkCreateStationsResult } from "@/shared/contracts/stations";
export type { StationDto, BulkCreateStationsResult } from "@/shared/contracts/stations";
import {
  countActivitiesByStation,
  findStationById,
  findStationByName,
  insertStationRow,
  listStationRows,
  maxStationOrder,
  updateStationRow,
  type StationRow,
} from "../infrastructure/station-repo";

const log = getLogger("stations");

function toDto(row: StationRow, activityCount: number): StationDto {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    orderIndex: row.orderIndex,
    archived: row.archived,
    activityCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** یک ایستگاه با شناسه (شامل بایگانی) — برای اعتبارسنجی cross-module از application */
export async function getStationById(projectId: string, id: string): Promise<StationDto | null> {
  const row = await findStationById(projectId, id);
  if (!row) return null;
  const counts = await countActivitiesByStation(projectId);
  return toDto(row, counts.get(id) ?? 0);
}

export async function listStations(projectId: string, includeArchived = false): Promise<StationDto[]> {
  const [rows, counts] = await Promise.all([listStationRows(projectId, includeArchived), countActivitiesByStation(projectId)]);
  return rows.map((r) => toDto(r, counts.get(r.id) ?? 0));
}

export interface CreateStationInput {
  projectId: string;
  userId: string;
  name: string;
  description?: string;
}

export async function createStation(input: CreateStationInput): Promise<StationDto> {
  const { projectId, userId } = input;
  const name = assertStationName(input.name);
  const existing = await findStationByName(projectId, name);
  if (existing) {
    if (existing.archived) {
      // نام‌بومی از ایستگاه بایگانی‌شده → بازگردانی به‌جای خطا (تجربه ساده)
      await updateStationRow(projectId, existing.id, { archived: false });
      await recordAudit({
        userId,
        action: AUDIT_ACTIONS.stationCreated,
        entityType: "WorkStation",
        entityId: existing.id,
        projectId,
        before: { archived: true },
        after: { archived: false, name },
      });
      const row = await findStationById(projectId, existing.id);
      if (!row) throw ApiError.internal();
      const [counts] = await Promise.all([countActivitiesByStation(projectId)]);
      return toDto(row, counts.get(row.id) ?? 0);
    }
    throw ApiError.conflict(`ایستگاه با نام «${name}» از قبل وجود دارد.`);
  }
  const id = uuidv7();
  const orderIndex = (await maxStationOrder(projectId)) + 1;
  await insertStationRow({
    id,
    projectId,
    name,
    description: input.description?.trim() || null,
    orderIndex,
    createdBy: userId,
  });
  await recordAudit({
    userId,
    action: AUDIT_ACTIONS.stationCreated,
    entityType: "WorkStation",
    entityId: id,
    projectId,
    after: { name, orderIndex },
  });
  log.info("station created", { projectId, name });
  const row = await findStationById(projectId, id);
  if (!row) throw ApiError.internal();
  return toDto(row, 0);
}

export interface BulkCreateStationsInput {
  projectId: string;
  userId: string;
  names: string[];
  descriptions?: Record<string, string>;
}

/** ورود گروهی نام ایستگاه‌ها — تکراری‌ها با دلیل فارسی رد می‌شوند (نه خطای کل دسته). */
export async function createStationsBulk(input: BulkCreateStationsInput): Promise<BulkCreateStationsResult> {
  const { projectId, userId } = input;
  const created: StationDto[] = [];
  const skipped: { name: string; reasonFa: string }[] = [];
  const seen = new Set<string>();
  for (const raw of input.names) {
    let name: string;
    try {
      name = assertStationName(raw);
    } catch (e) {
      skipped.push({ name: raw, reasonFa: (e as Error).message });
      continue;
    }
    if (seen.has(name)) {
      skipped.push({ name, reasonFa: "در همین فهرست تکراری است." });
      continue;
    }
    seen.add(name);
    const existing = await findStationByName(projectId, name);
    if (existing) {
      skipped.push({ name, reasonFa: "ایستگاهی با همین نام موجود است." });
      continue;
    }
    const dto = await createStation({
      projectId,
      userId,
      name,
      description: input.descriptions?.[name],
    });
    created.push(dto);
  }
  return { created, skipped };
}

export interface UpdateStationInput {
  projectId: string;
  userId: string;
  stationId: string;
  name?: string;
  description?: string | null;
}

export async function updateStation(input: UpdateStationInput): Promise<StationDto> {
  const { projectId, userId, stationId } = input;
  const row = await findStationById(projectId, stationId);
  if (!row) throw ApiError.notFound("ایستگاه یافت نشد.");
  const data: Partial<{ name: string; description: string | null }> = {};
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  if (input.name !== undefined) {
    const name = assertStationName(input.name);
    if (name !== row.name) {
      const clash = await findStationByName(projectId, name);
      if (clash && clash.id !== stationId) throw ApiError.conflict(`ایستگاه با نام «${name}» از قبل وجود دارد.`);
      before.name = row.name;
      after.name = name;
      data.name = name;
    }
  }
  if (input.description !== undefined) {
    const normalized = input.description?.trim() || null;
    if (normalized !== row.description) {
      before.description = row.description;
      after.description = normalized;
      data.description = normalized;
    }
  }
  if (Object.keys(data).length > 0) {
    await updateStationRow(projectId, stationId, data);
    await recordAudit({
      userId,
      action: AUDIT_ACTIONS.stationUpdated,
      entityType: "WorkStation",
      entityId: stationId,
      projectId,
      before,
      after,
    });
  }
  const updated = await findStationById(projectId, stationId);
  if (!updated) throw ApiError.internal();
  const counts = await countActivitiesByStation(projectId);
  return toDto(updated, counts.get(stationId) ?? 0);
}

export async function setStationArchived(
  projectId: string,
  userId: string,
  stationId: string,
  archived: boolean,
): Promise<StationDto> {
  const row = await findStationById(projectId, stationId);
  if (!row) throw ApiError.notFound("ایستگاه یافت نشد.");
  if (row.archived === archived) {
    const counts = await countActivitiesByStation(projectId);
    return toDto(row, counts.get(stationId) ?? 0);
  }
  if (archived) {
    const count = (await countActivitiesByStation(projectId)).get(stationId) ?? 0;
    if (count > 0) {
      throw ApiError.badRequest(`این ایستگاه ${count} فعالیت فعال دارد — ابتدا فعالیت‌ها را به ایستگاه دیگری منتقل یا بایگانی کنید.`);
    }
  }
  await updateStationRow(projectId, stationId, { archived });
  await recordAudit({
    userId,
    action: AUDIT_ACTIONS.stationArchived,
    entityType: "WorkStation",
    entityId: stationId,
    projectId,
    before: { archived: row.archived },
    after: { archived },
  });
  const updated = await findStationById(projectId, stationId);
  if (!updated) throw ApiError.internal();
  const counts = await countActivitiesByStation(projectId);
  return toDto(updated, counts.get(stationId) ?? 0);
}

/** جابه‌جایی ترتیب ایستگاه‌ها — فهرست کامل ترتیب جدید */
export async function reorderStations(projectId: string, userId: string, orderedIds: string[]): Promise<StationDto[]> {
  const rows = await listStationRows(projectId, true);
  const known = new Set(rows.map((r) => r.id));
  for (const id of orderedIds) {
    if (!known.has(id)) throw ApiError.badRequest("فهرست ترتیب شامل ایستگاه نامعتبر است.");
  }
  let idx = 0;
  for (const id of orderedIds) {
    idx += 1;
    await updateStationRow(projectId, id, { orderIndex: idx });
  }
  await recordAudit({
    userId,
    action: AUDIT_ACTIONS.stationUpdated,
    entityType: "WorkStation",
    entityId: projectId,
    projectId,
    after: { reordered: orderedIds.length },
  });
  return listStations(projectId, true);
}
