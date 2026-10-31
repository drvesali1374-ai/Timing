/**
 * نقطه ورود موتور فرمول (Application) — قرارداد ENGINE_CONTRACTS §۱:
 *   parse → analyze (ایستا) → evaluate (اجرا با ورودی‌های مشخص).
 *
 * این ماژول خالص است: هیچ DB/UI/زمان-سیستمی در آن نیست؛ قطعیت تضمین‌شده.
 */

import type { ExprNode } from "./ast";
import { serializeAst, deserializeAst, type SerializedFormulaAst } from "./ast";
import { parseFormula } from "./parser";
import {
  evaluateAst,
  runtimeToPlain,
  type EvalInput,
  type EvalOutcome,
  type FormulaError,
  type InputMap,
  type TraceStep,
} from "./evaluator";
import { analyzeAst, buildDependencyGraph, type FormulaNode, type SymbolTable, type StaticAnalysisResult } from "./static-analysis";
import { functionCatalogFa } from "./functions";

// ── انواع عمومی قرارداد ─────────────────────────────────────

export type FormulaStatus = "valid" | "invalid" | "incomplete";

export interface EngineEvalResult {
  value: number | string | boolean | null | Array<number | string | boolean | null>;
  unit?: string;
  status: FormulaStatus;
  errors: FormulaError[];
  trace: TraceStep[];
  inputRefs: string[];
}

export interface ParseReport {
  ok: boolean;
  ast?: ExprNode;
  serialized?: SerializedFormulaAst;
  error?: { messageFa: string; position: number };
}

// ── Parse ────────────────────────────────────────────────────

export function parse(expr: string): ParseReport {
  const result = parseFormula(expr);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  return { ok: true, ast: result.ast, serialized: serializeAst(result.ast) };
}

/** بازساخت AST از فرم سریال‌شده در snapshot */
export function fromSerialized(serialized: SerializedFormulaAst): ExprNode {
  return deserializeAst(serialized);
}

// ── تحلیل ایستا ──────────────────────────────────────────────

export function analyze(expr: string, symbols: SymbolTable): StaticAnalysisResult & { parseOk: boolean } {
  const parsed = parse(expr);
  if (!parsed.ok || !parsed.ast) {
    return {
      parseOk: false,
      errors: [{ code: "parse", messageFa: parsed.error?.messageFa ?? "عبارت قابل تجزیه نیست." }],
      warnings: [],
      refs: { parameters: [], formulaResults: [], unknown: [] },
      inferredType: "any",
    };
  }
  const analysis = analyzeAst(parsed.ast, symbols);
  return { parseOk: true, ...analysis };
}

export function analyzeAstDirect(ast: ExprNode, symbols: SymbolTable): StaticAnalysisResult {
  return analyzeAst(ast, symbols);
}

// ── ارزیابی ──────────────────────────────────────────────────

export function evaluate(ast: ExprNode, inputs: InputMap): EngineEvalResult {
  const outcome: EvalOutcome = evaluateAst(ast, inputs);
  const plain = runtimeToPlain(outcome.value);
  return {
    value: plain.value,
    ...(plain.unit !== undefined ? { unit: plain.unit } : {}),
    status: outcome.status,
    errors: outcome.errors,
    trace: outcome.trace,
    inputRefs: outcome.inputRefs,
  };
}

/** راحتی: parse + evaluate یک‌جا (بدون تحلیل ایستا — برای آزمون سریع) */
export function parseAndEvaluate(expr: string, inputs: InputMap): EngineEvalResult | { parseError: string } {
  const parsed = parse(expr);
  if (!parsed.ok || !parsed.ast) {
    return { parseError: parsed.error?.messageFa ?? "عبارت قابل تجزیه نیست." };
  }
  return evaluate(parsed.ast, inputs);
}

// ── گراف وابستگی ─────────────────────────────────────────────

export function dependencyReport(formulas: FormulaNode[]) {
  return buildDependencyGraph(formulas);
}

// ── کاتالوگ توابع برای UI ────────────────────────────────────

export function getFunctionCatalog() {
  return functionCatalogFa();
}

export type { EvalInput, InputMap, FormulaError, TraceStep, SymbolTable, StaticAnalysisResult, FormulaNode };
export { FUNCTION_SIGNATURES } from "./functions";
export { UNITS, isKnownUnit } from "./units";
