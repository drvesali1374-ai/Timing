/**
 * زیرساخت ماژول فعالیت‌ها — Prisma.
 */

import { db } from "@/lib/db";

export interface ActivityRow {
  id: string;
  projectId: string;
  stableKey: string;
  name: string;
  description: string | null;
  workType: string;
  vaClassification: string | null;
  constraintsJson: string | null;
  stationHint: string | null;
  skillRequired: string | null;
  sourceOfTime: string;
  order: number;
  predecessorsJson: string | null;
  archived: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function listActivityRows(projectId: string, includeArchived = false): Promise<ActivityRow[]> {
  return db.activity.findMany({
    where: includeArchived ? { projectId } : { projectId, archived: false },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });
}

export async function findActivityByKey(projectId: string, stableKey: string): Promise<ActivityRow | null> {
  return db.activity.findUnique({ where: { projectId_stableKey: { projectId, stableKey } } });
}

export async function findActivityById(projectId: string, id: string): Promise<ActivityRow | null> {
  return db.activity.findFirst({ where: { id, projectId } });
}

export async function insertActivityRow(input: {
  id: string;
  projectId: string;
  stableKey: string;
  name: string;
  description: string | null;
  workType: string;
  vaClassification: string | null;
  constraintsJson: string | null;
  stationHint: string | null;
  skillRequired: string | null;
  sourceOfTime: string;
  order: number;
  predecessorsJson: string | null;
  createdBy: string;
}): Promise<void> {
  await db.activity.create({ data: input });
}

export async function updateActivityRow(
  projectId: string,
  id: string,
  data: Partial<ActivityRow>,
): Promise<void> {
  await db.activity.update({ where: { id, projectId }, data });
}

export async function countActivities(projectId: string, includeArchived = false): Promise<number> {
  return db.activity.count({ where: includeArchived ? { projectId } : { projectId, archived: false } });
}

/** بیشترین ترتیب فعلی — برای افزودن در انتها */
export async function maxActivityOrder(projectId: string): Promise<number> {
  const row = await db.activity.findFirst({ where: { projectId }, orderBy: { order: "desc" }, select: { order: true } });
  return row?.order ?? 0;
}

/** نمونه‌سازی قالب‌های عنصر پروفایل هنگام ایجاد پروژه — کپی مستقل (A5) */
export async function instantiateActivityTemplates(input: {
  projectId: string;
  createdBy: string;
  templates: Array<{ stableKey: string; nameFa: string; workType: string; description?: string; vaClassification?: string }>;
}): Promise<number> {
  let order = 0;
  for (const template of input.templates) {
    order += 1;
    await insertActivityRow({
      id: crypto.randomUUID(),
      projectId: input.projectId,
      stableKey: template.stableKey,
      name: template.nameFa,
      description: template.description ?? null,
      workType: template.workType,
      vaClassification: template.vaClassification ?? null,
      constraintsJson: null,
      stationHint: null,
      skillRequired: null,
      sourceOfTime: "measured",
      order,
      predecessorsJson: null,
      createdBy: input.createdBy,
    });
  }
  return order;
}
