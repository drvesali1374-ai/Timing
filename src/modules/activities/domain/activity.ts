/**
 * دامنه ماژول فعالیت‌ها — مدل مشترک B5 (مصرف‌کننده: نمودار فاز ۳، کرنومتر فاز ۴، بالانس فاز ۶).
 */

import { ApiError } from "@/shared/errors";

export const WORK_TYPE_LABELS_FA: Record<string, string> = {
  operatorManual: "دستی اپراتور",
  machineAuto: "خودکار ماشین",
  waiting: "انتظار/تأخیر",
  transport: "حرکت/جابه‌جایی",
  inspection: "بازرسی",
  setupChangeover: "راه‌اندازی/تعویض",
  overlap: "هم‌پوشان",
};

export const VA_CLASSIFICATION_LABELS_FA: Record<string, string> = {
  valueAdded: "ارزش‌افزا",
  nonValueAdded: "غیرارزش‌افزا",
  essentialNonVA: "غیرارزش‌افزای ضروری",
};

export const SOURCE_OF_TIME_LABELS_FA: Record<string, string> = {
  measured: "اندازه‌گیری‌شده",
  estimated: "برآوردی",
  referenced: "ارجاعی",
};

export const ACTIVITY_STABLE_KEY_RE = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)*$/;

/**
 * B5 — اعتبارسنجی پیش‌نیازها (تقدم/تأخر) — خالص و قطعی.
 * پیش‌نیاز = stableKey فعالیت مقدم در همان پروژه؛ خودارجاعی، تکرار و چرخه خطا است.
 */
export function validatePredecessors(
  stableKey: string,
  predecessors: readonly string[],
  /** همه کلیدهای موجود پروژه (فعال) — برای بررسی ارجاع */
  knownKeys: readonly string[],
): { ok: true } | { ok: false; code: "self" | "duplicate" | "unknown" | "cycle"; messageFa: string } {
  const seen = new Set<string>();
  for (const p of predecessors) {
    if (p === stableKey) {
      return { ok: false, code: "self", messageFa: "فعالیت نمی‌تواند پیش‌نیاز خودش باشد." };
    }
    if (seen.has(p)) {
      return { ok: false, code: "duplicate", messageFa: `پیش‌نیاز «${p}» تکراری است.` };
    }
    seen.add(p);
    if (!knownKeys.includes(p)) {
      return { ok: false, code: "unknown", messageFa: `پیش‌نیاز «${p}» در فعالیت‌های پروژه موجود نیست.` };
    }
  }
  return { ok: true };
}

/**
 * تشخیص چرخه در گراف تقدم (DFS رنگی) — خالص.
 * edges: [قبل، بعد] — یعنی «قبل» باید قبل از «بعد» انجام شود.
 */
export function findPrecedenceCycle(edges: ReadonlyArray<readonly [string, string]>): string[] | null {
  const adj = new Map<string, string[]>();
  for (const [before, after] of edges) {
    if (!adj.has(before)) adj.set(before, []);
    adj.get(before)!.push(after);
  }
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  const stack: string[] = []
  function dfs(node: string): string[] | null {
    color.set(node, GRAY);
    stack.push(node);
    for (const next of adj.get(node) ?? []) {
      const c = color.get(next) ?? WHITE;
      if (c === GRAY) {
        // چرخه: از next تا انتهای پشته
        const idx = stack.indexOf(next);
        return [...stack.slice(idx), next];
      }
      if (c === WHITE) {
        const cyc = dfs(next);
        if (cyc) return cyc;
      }
    }
    stack.pop();
    color.set(node, BLACK);
    return null;
  }
  for (const node of adj.keys()) {
    if ((color.get(node) ?? WHITE) === WHITE) {
      const cyc = dfs(node);
      if (cyc) return cyc;
    }
  }
  return null;
}

export function isWorkType(v: unknown): v is string {
  return typeof v === "string" && v in WORK_TYPE_LABELS_FA;
}

export function isVaClassification(v: unknown): v is string {
  return typeof v === "string" && v in VA_CLASSIFICATION_LABELS_FA;
}

export function isSourceOfTime(v: unknown): v is string {
  return typeof v === "string" && v in SOURCE_OF_TIME_LABELS_FA;
}

export function assertWorkType(v: unknown): string {
  if (!isWorkType(v)) {
    throw ApiError.badRequest("نوع کار نامعتبر است (B5).");
  }
  return v;
}

export function assertActivityStableKey(v: unknown): string {
  if (typeof v !== "string" || !ACTIVITY_STABLE_KEY_RE.test(v)) {
    throw ApiError.badRequest("شناسه فنی فعالیت باید حروف کوچک لاتین با خط تیره/نقطه باشد (مثل el.install-door).");
  }
  return v;
}
