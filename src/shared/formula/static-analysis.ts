/**
 * تحلیل ایستای زبان عبارتی — پیش از ذخیره/اجرا (FORMULA_CATALOG §۵٫۵).
 *
 * ۱. استخراج شناسه‌های مصرفی (پارامترها/نتایج فرمول‌های دیگر)
 * ۲. بررسی تعداد آرگومان توابع بسته
 * ۳. استنتاج نوع تقریبی + کشف ناسازگاری نوع ثابت
 * ۴. هشدار تقسیم بر صفرِ ثابت
 * ۵. گراف وابستگی فرمول‌ها + کشف چرخه (DFS)
 */

import type { ExprNode } from "./ast";
import { walkAll } from "./ast";
import { FUNCTION_SIGNATURES } from "./functions";
import type { FormulaError } from "./evaluator";

export interface SymbolInfo {
  /** نوع تقریبی نماد */
  type: "number" | "string" | "boolean" | "numberArray" | "any";
  /** واحد اگر معلوم است */
  unit?: string;
  /** منبع نماد */
  source: "parameter" | "formulaResult";
}

export type SymbolTable = Record<string, SymbolInfo>;

export interface StaticAnalysisResult {
  errors: FormulaError[];
  warnings: Array<{ messageFa: string; astNodeId?: number }>;
  /** شناسه‌های مصرفی به تفکیک منبع */
  refs: {
    parameters: string[];
    formulaResults: string[];
    unknown: string[];
  };
  /** نوع تقریبی نتیجه عبارت */
  inferredType: "number" | "string" | "boolean" | "numberArray" | "any";
}

/** تحلیل ایستای یک عبارت در برابر جدول نمادها */
export function analyzeAst(root: ExprNode, symbols: SymbolTable): StaticAnalysisResult {
  const errors: FormulaError[] = [];
  const warnings: Array<{ messageFa: string; astNodeId?: number }> = [];
  const parameterRefs = new Set<string>();
  const formulaRefs = new Set<string>();
  const unknownRefs = new Set<string>();

  walkAll(root, (node) => {
    if (node.kind === "ident") {
      // hasOwnProperty: مقاومت به شناسه‌های زنجیره پروتوتایپ مثل «__proto__»
      const known = Object.prototype.hasOwnProperty.call(symbols, node.name);
      const info = known ? symbols[node.name] : undefined;
      if (!info) {
        unknownRefs.add(node.name);
        errors.push({
          code: "ref",
          messageFa: `شناسه «${node.name}» شناخته نشد — نه پارامتر است، نه نتیجه فرمول دیگر، نه تابع.`,
          astNodeId: node.id,
        });
      } else if (info.source === "parameter") {
        parameterRefs.add(node.name);
      } else {
        formulaRefs.add(node.name);
      }
    }

    if (node.kind === "call") {
      const sig = FUNCTION_SIGNATURES[node.callee];
      if (!sig) {
        errors.push({
          code: "ref",
          messageFa: `تابع «${node.callee}» در فهرست بسته توابع مجاز نیست.`,
          astNodeId: node.id,
        });
      } else if (node.args.length < sig.minArgs || node.args.length > sig.maxArgs) {
        errors.push({
          code: "type",
          messageFa: `تابع «${node.callee}» بین ${sig.minArgs} تا ${sig.maxArgs} آرگومان می‌گیرد (${node.args.length} داده شده).`,
          astNodeId: node.id,
        });
      }
    }

    // تقسیم بر صفر ثابت → هشدار (نه خطا)
    if (node.kind === "binary" && node.op === "/") {
      if (node.right.kind === "num" && node.right.value === 0) {
        warnings.push({
          messageFa: "تقسیم بر صفر ثابت در عبارت — این شاخه همیشه خطای div0 خواهد داشت.",
          astNodeId: node.id,
        });
      }
    }

    // الحاق رشته + عدد → خطای نوع
    if (node.kind === "binary" && node.op === "+") {
      if (node.left.kind === "str" && node.right.kind === "num") {
        errors.push({ code: "type", messageFa: "الحاق رشته با عدد مجاز نیست — انواع را هم‌نوع کنید.", astNodeId: node.id });
      }
      if (node.left.kind === "num" && node.right.kind === "str") {
        errors.push({ code: "type", messageFa: "جمع عدد با رشته مجاز نیست — انواع را هم‌نوع کنید.", astNodeId: node.id });
      }
    }
  });

  const inferredType = inferType(root, symbols);
  return {
    errors,
    warnings,
    refs: {
      parameters: [...parameterRefs],
      formulaResults: [...formulaRefs],
      unknown: [...unknownRefs],
    },
    inferredType,
  };
}

/** استنتاج نوع تقریبی (بدون خطا — best-effort) */
function inferType(node: ExprNode, symbols: SymbolTable): StaticAnalysisResult["inferredType"] {
  switch (node.kind) {
    case "num":
      return "number";
    case "str":
      return "string";
    case "bool":
      return "boolean";
    case "null":
      return "any";
    case "ident":
      return symbols[node.name]?.type ?? "any";
    case "unary":
      return node.op === "-" ? "number" : "boolean";
    case "binary": {
      if (["||", "&&", "==", "!=", "<", "<=", ">", ">="].includes(node.op)) return "boolean";
      return "number";
    }
    case "call": {
      const sig = FUNCTION_SIGNATURES[node.callee];
      return (sig?.returnType as StaticAnalysisResult["inferredType"]) ?? "any";
    }
    case "if": {
      const t = inferType(node.thenExpr, symbols);
      const e = inferType(node.elseExpr, symbols);
      return t === e ? t : "any";
    }
  }
}

// ── گراف وابستگی فرمول‌ها و کشف چرخه ────────────────────────

export interface FormulaNode {
  /** کلید یکتای فرمول در پیکربندی */
  key: string;
  /** نام نماد نتیجه این فرمول در جدول نمادها (مثل «TS-011.result») */
  resultSymbol: string;
  /** عبارت پارس‌شده (null اگر parse نشده) */
  ast: ExprNode | null;
}

export interface DependencyGraphReport {
  /** یال‌ها: فرمولی که نتیجه فرمول دیگر را مصرف می‌کند */
  edges: Array<{ from: string; to: string }>;
  cycles: string[][];
}

/**
 * ساخت گراف وابستگی فرمول‌ها و کشف چرخه — چرخه = خطای ساختاری پیش از اجرا.
 * from = فرمول مصرف‌کننده، to = فرمولی که نتیجه‌اش مصرف می‌شود.
 */
export function buildDependencyGraph(formulas: FormulaNode[]): DependencyGraphReport {
  const symbolToKey = new Map<string, string>();
  for (const f of formulas) symbolToKey.set(f.resultSymbol, f.key);

  const edges: Array<{ from: string; to: string }> = [];
  for (const f of formulas) {
    if (!f.ast) continue;
    walkAll(f.ast, (node) => {
      if (node.kind === "ident") {
        const targetKey = symbolToKey.get(node.name);
        if (targetKey && targetKey !== f.key) {
          edges.push({ from: f.key, to: targetKey });
        } else if (targetKey === f.key) {
          // خودارجاعی مستقیم هم چرخه است
          edges.push({ from: f.key, to: targetKey });
        }
      }
    });
  }

  const cycles = findCycles(edges);
  return { edges, cycles };
}

/** کشف چرخه با DFS (رنگ سفید/خاکستری/سیاه) */
export function findCycles(edges: Array<{ from: string; to: string }>): string[][] {
  const graph = new Map<string, string[]>();
  for (const { from, to } of edges) {
    if (!graph.has(from)) graph.set(from, []);
    graph.get(from)!.push(to);
  }
  const state = new Map<string, 0 | 1 | 2>();
  const stack: string[] = [];
  const cycles: string[][] = [];
  const seen = new Set<string>();

  function dfs(node: string): void {
    state.set(node, 1);
    stack.push(node);
    for (const next of graph.get(node) ?? []) {
      const s = state.get(next) ?? 0;
      if (s === 1) {
        const idx = stack.indexOf(next);
        const cycle = stack.slice(idx).concat(next);
        const signature = cycle.join("|");
        if (!seen.has(signature)) {
          seen.add(signature);
          cycles.push(cycle);
        }
      } else if (s === 0) {
        dfs(next);
      }
    }
    stack.pop();
    state.set(node, 2);
  }

  for (const node of graph.keys()) {
    if ((state.get(node) ?? 0) === 0) dfs(node);
  }
  return cycles;
}
