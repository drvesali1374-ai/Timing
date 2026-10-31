/**
 * زیرساخت ماژول نمودارها — Prisma.
 * هر ذخیره = یک DiagramRevision جدید append-only (نسخه‌بندی نمودار).
 */

import { db } from "@/lib/db";

export interface DiagramRow {
  id: string;
  projectId: string;
  kind: string;
  variant: string;
  variantOfId: string | null;
  title: string;
  description: string | null;
  subject: string | null;
  distanceUnit: string | null;
  status: string;
  currentRev: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DiagramRevisionRow {
  id: string;
  diagramId: string;
  revNo: number;
  reason: string | null;
  docJson: string;
  layoutJson: string;
  validationJson: string;
  appliedSuggestionsJson: string | null;
  origin: string;
  clientOpId: string | null;
  createdBy: string;
  createdAt: Date;
}

export async function listDiagramRows(projectId: string, includeArchived = false): Promise<DiagramRow[]> {
  return db.diagram.findMany({
    where: includeArchived ? { projectId } : { projectId, status: { not: "archived" } },
    orderBy: [{ createdAt: "desc" }],
  });
}

export async function findDiagramById(projectId: string, id: string): Promise<DiagramRow | null> {
  return db.diagram.findFirst({ where: { id, projectId } });
}

export async function insertDiagramRow(input: {
  id: string;
  projectId: string;
  kind: string;
  variant: string;
  variantOfId: string | null;
  title: string;
  description: string | null;
  subject: string | null;
  distanceUnit: string | null;
  status: string;
  currentRev: number;
  createdBy: string;
}): Promise<DiagramRow> {
  return db.diagram.create({ data: input });
}

export async function updateDiagramRow(
  projectId: string,
  id: string,
  data: Partial<Pick<DiagramRow, "title" | "description" | "subject" | "distanceUnit" | "status" | "currentRev" | "variantOfId">>,
): Promise<void> {
  await db.diagram.updateMany({ where: { id, projectId }, data });
}

export async function countDiagrams(projectId: string): Promise<number> {
  return db.diagram.count({ where: { projectId, status: { not: "archived" } } });
}

// ── revisions ──

export async function insertRevisionRow(input: {
  id: string;
  diagramId: string;
  revNo: number;
  reason: string | null;
  docJson: string;
  layoutJson: string;
  validationJson: string;
  appliedSuggestionsJson: string | null;
  origin: string;
  clientOpId: string | null;
  createdBy: string;
}): Promise<DiagramRevisionRow> {
  return db.diagramRevision.create({ data: input });
}

export async function latestRevision(diagramId: string): Promise<DiagramRevisionRow | null> {
  return db.diagramRevision.findFirst({ where: { diagramId }, orderBy: { revNo: "desc" } });
}

export async function findRevisionByClientOpId(projectId: string, clientOpId: string): Promise<DiagramRevisionRow | null> {
  const rev = await db.diagramRevision.findFirst({ where: { clientOpId }, orderBy: { revNo: "desc" } });
  if (!rev) return null;
  const diagram = await db.diagram.findFirst({ where: { id: rev.diagramId, projectId } });
  return diagram ? rev : null;
}

export async function listRevisionRows(diagramId: string): Promise<DiagramRevisionRow[]> {
  return db.diagramRevision.findMany({ where: { diagramId }, orderBy: { revNo: "desc" } });
}

export async function findRevisionByNo(diagramId: string, revNo: number): Promise<DiagramRevisionRow | null> {
  return db.diagramRevision.findUnique({ where: { diagramId_revNo: { diagramId, revNo } } });
}
