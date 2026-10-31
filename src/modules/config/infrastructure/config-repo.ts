/**
 * زیرساخت ماژول پیکربندی — دسترسی Prisma به ConfigVersion (append-only).
 */

import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

type TxClient = Prisma.TransactionClient;

export interface ConfigVersionRow {
  id: string;
  projectId: string;
  semver: string;
  snapshotJson: string;
  reason: string | null;
  createdBy: string;
  createdAt: Date;
}

export async function findCurrentVersion(projectId: string): Promise<ConfigVersionRow | null> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: { currentConfigVersion: true },
  });
  return (project?.currentConfigVersion as ConfigVersionRow | null) ?? null;
}

export async function findVersionById(versionId: string): Promise<ConfigVersionRow | null> {
  const row = await db.configVersion.findUnique({ where: { id: versionId } });
  return (row as ConfigVersionRow | null) ?? null;
}

export async function insertConfigVersionRow(
  input: {
    id: string;
    projectId: string;
    semver: string;
    snapshotJson: string;
    reason: string;
    profileTemplateId: string | null;
    profileTemplateVersion: string | null;
    createdBy: string;
  },
  tx?: TxClient,
): Promise<void> {
  await (tx ?? db).configVersion.create({ data: input });
}

export async function setCurrentVersion(projectId: string, versionId: string, tx?: TxClient): Promise<void> {
  await (tx ?? db).project.update({
    where: { id: projectId },
    data: { currentConfigVersionId: versionId },
  });
}

/** بزرگ‌ترین semver ثبت‌شده پروژه (برای bump نسخه بعدی) */
export async function latestVersionNumbers(projectId: string): Promise<Array<{ semver: string }>> {
  const rows = await db.configVersion.findMany({
    where: { projectId },
    select: { semver: true },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({ semver: r.semver }));
}
