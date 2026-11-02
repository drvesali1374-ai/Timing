/**
 * ارتباط دوطرفه فعالیت ↔ گام نمودار (ADR-017 — دستورالعمل بخش ۷).
 * منبع حقیقت واحد: فیلد node.activityStableKey در سند (docJson) نسخه جاری نمودار.
 * از سمت نمودار: انتخاب فعالیت مرجع در پنل خواص (موجود).
 * از سمت فعالیت: مشاهده گام‌های ارجاع‌دهنده + افزودن گام مرتبط + قطع ارجاع.
 */

import { ApiError } from "@/shared/errors";
import { uuidv7 } from "@/shared/ids";
import { getLogger } from "@/shared/logger";
import { AUDIT_ACTIONS, recordAudit } from "@/modules/audit/application/audit-service";
import { db } from "@/lib/db";
import { listActivities } from "@/modules/activities/application/activity-service";
import { getDiagramDetail, saveRevision } from "@/modules/diagrams/application/diagram-service";
import { makeNode, isDiagramSymbolFor, type DiagramDoc, type DiagramKind, type DiagramSymbol } from "@/shared/diagrams/types";
import type { ActivityLinkEntryDto, ActivityLinksDto } from "@/shared/contracts/diagrams";
export type { ActivityLinkEntryDto, ActivityLinksDto } from "@/shared/contracts/diagrams";

const log = getLogger("diagram-links");

/** نقشه کامل ارتباط فعالیت↔گام از نسخه‌های جاری همه نمودارهای فعال. */
export async function getActivityLinks(projectId: string): Promise<ActivityLinksDto> {
  const diagrams = await db.diagram.findMany({
    where: { projectId, status: { not: "archived" } },
    select: { id: true, title: true, kind: true, currentRev: true },
  });
  const byActivity: Record<string, ActivityLinkEntryDto[]> = {};
  const invalidRefs: ActivityLinksDto["invalidRefs"] = [];

  const activityRows = await listActivities(projectId, true);
  const knownKeys = new Set(activityRows.map((a) => a.stableKey));
  const activeKeys = new Set(activityRows.filter((a) => !a.archived).map((a) => a.stableKey));

  for (const d of diagrams) {
    const rev = await db.diagramRevision.findFirst({
      where: { diagramId: d.id, revNo: d.currentRev },
      select: { docJson: true, revNo: true },
    });
    if (!rev) continue;
    let doc: DiagramDoc;
    try {
      doc = JSON.parse(rev.docJson) as DiagramDoc;
    } catch {
      continue;
    }
    for (const node of doc.nodes ?? []) {
      const key = node.activityStableKey;
      if (!key) continue;
      const entry: ActivityLinkEntryDto = {
        diagramId: d.id,
        diagramTitle: d.title,
        diagramKind: d.kind as DiagramKind,
        revNo: rev.revNo,
        nodeId: node.id,
        stepNo: node.stepNo ?? null,
        nodeTitle: node.title,
      };
      if (!knownKeys.has(key) || !activeKeys.has(key)) {
        invalidRefs.push({ stableKey: key, diagramId: d.id, diagramTitle: d.title, nodeId: node.id });
      }
      (byActivity[key] ??= []).push(entry);
    }
  }
  return { byActivity, invalidRefs };
}

export interface LinkNodeInput {
  projectId: string;
  userId: string;
  activityStableKey: string;
  diagramId: string;
  symbol: string;
  title?: string;
  reason?: string;
}

/**
 * افزودن گام نمودار مرتبط از سمت فعالیت — یک گام جدید با ارجاع به فعالیت می‌سازد.
 * history: revision جدید append-only (سازگاری تاریخچه حفظ می‌شود).
 */
export async function addDiagramStepForActivity(input: LinkNodeInput): Promise<ActivityLinksDto> {
  const { projectId, userId } = input;
  const activities = await listActivities(projectId, false);
  const activity = activities.find((a) => a.stableKey === input.activityStableKey);
  if (!activity) throw ApiError.notFound("فعالیت یافت نشد یا بایگانی است.");

  const detail = await getDiagramDetail(projectId, input.diagramId);
  if (detail.status === "archived") throw ApiError.badRequest("نمودار بایگانی‌شده قابل ویرایش نیست.");

  const kind = detail.doc.kind;
  if (!isDiagramSymbolFor(kind, input.symbol)) {
    throw ApiError.badRequest("نماد انتخاب‌شده با نوع نمودار سازگار نیست.");
  }

  const doc = detail.doc;
  // جلوگیری از ارجاع تکراری: اگر همین نمودار گامی با همین ارجاع دارد، خطا
  const duplicate = doc.nodes.some((n) => n.activityStableKey === input.activityStableKey);
  if (duplicate) {
    throw ApiError.conflict("این نمودار از قبل گامی به این فعالیت ارجاع دارد — برای تغییر، ارجاع موجود را ویرایش کنید.");
  }
  if (doc.nodes.length >= 400) throw ApiError.badRequest("سقف گام‌های نمودار پر است.");

  const nextId = `n${doc.nodes.length + 1}_${Date.now().toString(36).slice(-4)}`;
  const node = makeNode(kind, nextId, input.symbol as DiagramSymbol, input.title?.trim() || activity.name);
  node.activityStableKey = activity.stableKey;
  node.stepNo = doc.nodes.length + 1;
  if (activity.stationName) node.description = `ایستگاه: ${activity.stationName}`;

  const newDoc: DiagramDoc = { ...doc, nodes: [...doc.nodes, node] };
  // زنجیره خطی جدید را هم بساز تا گام بدون اتصال نماند (تجربه ساده)
  const prev = doc.nodes[doc.nodes.length - 1];
  const edges = [...doc.edges];
  if (prev && doc.kind === "opc") {
    edges.push({ id: `e${edges.length + 1}_${Date.now().toString(36).slice(-4)}`, from: prev.id, to: nextId });
  }

  await saveRevision(projectId, userId, input.diagramId, {
    doc: edges.length > doc.edges.length ? { ...newDoc, edges } : newDoc,
    layout: detail.layout,
    reason: input.reason?.trim() || `افزودن گام مرتبط با فعالیت «${activity.name}» از فهرست فعالیت‌ها`,
    origin: "normal",
    clientOpId: uuidv7(),
  });
  await recordAudit({
    userId,
    action: AUDIT_ACTIONS.diagramRevisionSaved,
    entityType: "Diagram",
    entityId: input.diagramId,
    projectId,
    after: { linkedActivity: activity.stableKey, nodeId: nextId },
  });
  log.info("diagram step linked from activity", { projectId, diagramId: input.diagramId, activity: activity.stableKey });
  return getActivityLinks(projectId);
}

/** قطع ارجاع یک گام از فعالیت (از سمت فعالیت) — فیلد ارجاع حذف، گام باقی می‌ماند. */
export async function unlinkDiagramStep(
  projectId: string,
  userId: string,
  activityStableKey: string,
  diagramId: string,
  nodeId: string,
  reason?: string,
): Promise<ActivityLinksDto> {
  const detail = await getDiagramDetail(projectId, diagramId);
  const node = detail.doc.nodes.find((n) => n.id === nodeId);
  if (!node) throw ApiError.notFound("گام نمودار یافت نشد.");
  if (node.activityStableKey !== activityStableKey) {
    throw ApiError.badRequest("این گام به فعالیت دیگری ارجاع دارد.");
  }
  const newNodes = detail.doc.nodes.map((n) => (n.id === nodeId ? { ...n, activityStableKey: null } : n));
  await saveRevision(projectId, userId, diagramId, {
    doc: { ...detail.doc, nodes: newNodes },
    layout: detail.layout,
    reason: reason?.trim() || `قطع ارجاع گام «${node.title}» از فعالیت`,
    origin: "normal",
    clientOpId: uuidv7(),
  });
  log.info("diagram step unlinked", { projectId, diagramId, nodeId });
  return getActivityLinks(projectId);
}
