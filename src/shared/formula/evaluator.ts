/**
 * مفسر درخت AST زبان عبارتی امن — ADR-003 (بدون eval/Function؛ فقط پیمایش درخت).
 *
 * ویژگی‌های الزامی (ENGINE_CONTRACTS §۱):
 *  - قطعیت: ورودی یکسان → نتیجه یکسان (هیچ زمان سیستم/تصادفی مصرف نمی‌شود).
 *  - مهار خطا: تقسیم‌برصفر/نوع/واحد/ارجاع → خطای ساختاریافته، بدون استثنای فرار.
 *  - وضعیت نتیجه: valid | invalid | incomplete (ورودی گمشده).
 *  - trace: گام‌های ارزیابی با شناسه گره، عمل و مقدار میانی (سقف ثبت دارد).
 */

import type { ExprNode } from "./ast";
import { walkAll } from "./ast";
import { FUNCTION_SIGNATURES } from "./functions";
import { convertValue, divideDimensions, getUnit, UnitError } from "./units";

// ── مقادیر زمان اجرا ────────────────────────────────────────

export type RuntimeValue =
  | NumberValue
  | { kind: "string"; value: string }
  | { kind: "bool"; value: boolean }
  | { kind: "null"; missing?: string }
  | { kind: "array"; items: RuntimeValue[] };

export interface NumberValue {
  kind: "number";
  value: number;
  unit?: string;
}

/** آیا مقدار null است؟ (literal یا ورودی گمشده) */
export function isNullValue(rv: RuntimeValue | null | undefined): rv is { kind: "null"; missing?: string } | null {
  return rv === null || (rv !== undefined && rv.kind === "null");
}

/** آیا null ناشی از ورودی گمشده است (خطای missing قبلاً ثبت شده)؟ */
export function isMissingNull(rv: RuntimeValue | null | undefined): boolean {
  return rv !== null && rv !== undefined && rv.kind === "null" && rv.missing !== undefined;
}

export function numberValue(value: number, unit?: string): NumberValue {
  return { kind: "number", value, ...(unit !== undefined ? { unit } : {}) };
}

// ── خطاها و ورودی‌ها ────────────────────────────────────────

export type FormulaErrorCode =
  | "parse"
  | "type"
  | "unit"
  | "ref"
  | "div0"
  | "cycle"
  | "missing"
  | "limit";

export interface FormulaError {
  code: FormulaErrorCode;
  messageFa: string;
  /** شناسه گره AST مرتبط اگر موجود باشد */
  astNodeId?: number;
}

export interface TraceStep {
  nodeId: number;
  /** عمل انجام‌شده مثل «binary:+» یا «call:mean» یا «ident:allowance.rate» */
  op: string;
  /** خلاصه مقدار میانی */
  detail?: string;
  value?: string | number | boolean | null;
  unit?: string | null;
}

export interface EvalInput {
  /** مقدار ورودی (عدد/رشته/بولی/null/آرایه) با واحد اختیاری */
  value: number | string | boolean | null | Array<number | string | boolean | null>;
  unit?: string;
}

export type InputMap = Record<string, EvalInput>;

export interface EvalOutcome {
  value: RuntimeValue | null;
  status: "valid" | "invalid" | "incomplete";
  errors: FormulaError[];
  trace: TraceStep[];
  /** شناسه ورودی‌های مصرف‌شده (مقادیر واقعاً خوانده‌شده) */
  inputRefs: string[];
}

const MAX_TRACE_STEPS = 256;

// ── مفسر ────────────────────────────────────────────────────

export class Evaluator {
  private readonly trace: TraceStep[] = [];
  private readonly errors: FormulaError[] = [];
  private readonly usedInputs = new Set<string>();
  private traceOverflow = false;

  constructor(private readonly inputs: InputMap) {}

  private pushTrace(step: TraceStep): void {
    if (this.trace.length < MAX_TRACE_STEPS) {
      this.trace.push(step);
    } else {
      this.traceOverflow = true;
    }
  }

  private error(code: FormulaErrorCode, messageFa: string, astNodeId?: number): void {
    this.errors.push({ code, messageFa, ...(astNodeId !== undefined ? { astNodeId } : {}) });
  }

  private fmt(rv: RuntimeValue | null): string {
    if (rv === null) return "null";
    switch (rv.kind) {
      case "number": {
        const u = rv.unit ? ` ${rv.unit}` : "";
        return `${rv.value}${u}`;
      }
      case "string":
        return JSON.stringify(rv.value);
      case "bool":
        return String(rv.value);
      case "null":
        return "null";
      case "array":
        return `[${rv.items.length} مورد]`;
    }
  }

  evaluate(root: ExprNode): EvalOutcome {
    // ارجاع‌های ناموجود → invalid (hasOwnProperty برای مقاومت به __proto__)
    walkAll(root, (node) => {
      if (node.kind === "ident" && !Object.prototype.hasOwnProperty.call(this.inputs, node.name)) {
        this.error("ref", `ورودی «${node.name}» در قرارداد ورودی فرمول تعریف نشده است.`, node.id);
      }
    });
    if (this.errors.length > 0) {
      return {
        value: null,
        status: "invalid",
        errors: this.errors,
        trace: this.trace,
        inputRefs: [],
      };
    }

    const value = this.evalNode(root);
    if (this.traceOverflow) {
      this.error("limit", `زنجیره ارزیابی طولانی است؛ فقط ${MAX_TRACE_STEPS} گام اول ثبت شد.`);
    }
    const hasMissing = this.errors.some((e) => e.code === "missing");
    const hasHard = this.errors.some((e) => e.code !== "missing");
    // اگر مقدار null ولی هیچ خطای missing ثبت نشده (literal null) → incomplete در سطح نتیجه
    const status: EvalOutcome["status"] = hasHard ? "invalid" : hasMissing || value === null ? "incomplete" : "valid";
    return {
      value: status === "invalid" ? null : value,
      status,
      errors: this.errors,
      trace: this.trace,
      inputRefs: [...this.usedInputs],
    };
  }

  private evalNode(node: ExprNode): RuntimeValue | null {
    switch (node.kind) {
      case "num":
        return numberValue(node.value);
      case "str":
        return { kind: "string", value: node.value };
      case "bool":
        return { kind: "bool", value: node.value };
      case "null":
        return { kind: "null" };
      case "ident":
        return this.evalIdent(node);
      case "unary":
        return this.evalUnary(node);
      case "binary":
        return this.evalBinary(node);
      case "call":
        return this.evalCall(node);
      case "if":
        return this.evalIf(node);
    }
  }

  private evalIdent(node: Extract<ExprNode, { kind: "ident" }>): RuntimeValue | null {
    if (!Object.prototype.hasOwnProperty.call(this.inputs, node.name)) {
      this.error("ref", `ورودی «${node.name}» یافت نشد.`, node.id);
      return null;
    }
    const input = this.inputs[node.name];
    this.usedInputs.add(node.name);
    const rv = this.coerceInput(input, node.name);
    this.pushTrace({ nodeId: node.id, op: `ident:${node.name}`, value: this.traceValue(rv), unit: this.traceUnit(rv) });
    return rv;
  }

  private coerceInput(input: EvalInput, name: string): RuntimeValue | null {
    if (input.value === null || input.value === undefined) {
      this.error("missing", `مقدار ورودی «${name}» ثبت نشده است (null).`, undefined);
      return { kind: "null", missing: name };
    }
    if (Array.isArray(input.value)) {
      const items = input.value.map((v) => this.plainToRuntime(v, input.unit));
      return { kind: "array", items };
    }
    return this.plainToRuntime(input.value, input.unit);
  }

  private plainToRuntime(v: number | string | boolean | null, unit?: string): RuntimeValue {
    if (v === null) return { kind: "null" };
    if (typeof v === "number") return numberValue(v, unit);
    if (typeof v === "string") return { kind: "string", value: v };
    return { kind: "bool", value: v };
  }

  private traceValue(rv: RuntimeValue | null): string | number | boolean | null {
    if (rv === null || rv.kind === "null") return null;
    if (rv.kind === "number") return rv.value;
    if (rv.kind === "string") return rv.value;
    if (rv.kind === "bool") return rv.value;
    return rv.items.length;
  }

  private traceUnit(rv: RuntimeValue | null): string | null {
    if (rv && rv.kind === "number" && rv.unit) return rv.unit;
    return null;
  }

  private evalUnary(node: Extract<ExprNode, { kind: "unary" }>): RuntimeValue | null {
    const operand = this.evalNode(node.operand);
    if (operand === null) return null;
    // ورودی گمشده → انتشار null بدون خطای type اضافی (وضعیت incomplete)
    if (operand.kind === "null" && operand.missing !== undefined) return null;
    if (node.op === "-") {
      if (operand.kind !== "number") {
        this.error("type", "عملگر یک‌منفی فقط روی عدد اعمال می‌شود.", node.id);
        return null;
      }
      const out = numberValue(-operand.value, operand.unit);
      this.pushTrace({ nodeId: node.id, op: "unary:-", value: out.value, unit: out.unit ?? null });
      return out;
    }
    // not
    const b = this.truthy(operand, node.id);
    if (b === null) return null;
    const out: RuntimeValue = { kind: "bool", value: !b };
    this.pushTrace({ nodeId: node.id, op: "unary:!", value: out.value });
    return out;
  }

  private truthy(rv: RuntimeValue, nodeId: number): boolean | null {
    if (rv.kind === "bool") return rv.value;
    if (rv.kind === "null") return null; // missing → incomplete
    this.error("type", "شرط منطقی باید بولی باشد (true/false).", nodeId);
    return null;
  }

  private evalBinary(node: Extract<ExprNode, { kind: "binary" }>): RuntimeValue | null {
    const { op } = node;
    // اتصال کوتاه (short-circuit)
    if (op === "&&" || op === "||") {
      const left = this.evalNode(node.left);
      if (left === null) return null;
      const lb = this.truthy(left, node.left.id);
      if (lb === null) return null;
      if (op === "&&" && !lb) {
        const out: RuntimeValue = { kind: "bool", value: false };
        this.pushTrace({ nodeId: node.id, op: "binary:&&", detail: "اتصال کوتاه — سمت چپ نادرست", value: false });
        return out;
      }
      if (op === "||" && lb) {
        const out: RuntimeValue = { kind: "bool", value: true };
        this.pushTrace({ nodeId: node.id, op: "binary:||", detail: "اتصال کوتاه — سمت چپ درست", value: true });
        return out;
      }
      const right = this.evalNode(node.right);
      if (right === null) return null;
      const rb = this.truthy(right, node.right.id);
      if (rb === null) return null;
      const out: RuntimeValue = { kind: "bool", value: op === "&&" ? rb : rb };
      this.pushTrace({ nodeId: node.id, op: `binary:${op}`, value: out.value });
      return out;
    }

    const left = this.evalNode(node.left);
    const right = this.evalNode(node.right);
    if (left === null || right === null) return null;
    // ورودی گمشده در هر سمت → انتشار null بدون خطای type/unit اضافی (incomplete)
    if ((left.kind === "null" && left.missing !== undefined) || (right.kind === "null" && right.missing !== undefined)) {
      return null;
    }

    // مقایسه‌ها
    if (["==", "!=", "<", "<=", ">", ">="].includes(op)) {
      return this.evalComparison(node, left, right);
    }

    // حساب
    if (["+", "-", "*", "/", "%"].includes(op)) {
      return this.evalArithmetic(node, left, right);
    }

    this.error("type", `عملگر «${op}» پشتیبانی نمی‌شود.`, node.id);
    return null;
  }

  private evalComparison(
    node: Extract<ExprNode, { kind: "binary" }>,
    left: RuntimeValue,
    right: RuntimeValue,
  ): RuntimeValue | null {
    const { op } = node;
    // برابری/نابرابری روی هر جفت نوع هم‌نوع
    if (op === "==" || op === "!=") {
      if (left.kind !== right.kind) {
        this.error("type", `مقایسه «${op}» بین انواع متفاوت (${left.kind} و ${right.kind}) مجاز نیست.`, node.id);
        return null;
      }
      let eq: boolean;
      if (left.kind === "null") eq = true;
      else if (left.kind === "number" && right.kind === "number") {
        // مقایسه اعداد: واحدها باید سازگار باشند (تبدیل به پایه)
        eq = this.toBase(left).value === this.toBase(right).value;
      } else if (left.kind === "array" && right.kind === "array") {
        eq = left.items.length === right.items.length;
      } else {
        eq = (left as { value: unknown }).value === (right as { value: unknown }).value;
      }
      const out: RuntimeValue = { kind: "bool", value: op === "==" ? eq : !eq };
      this.pushTrace({ nodeId: node.id, op: `binary:${op}`, value: out.value });
      return out;
    }

    // مقایسه ترتیبی: عدد (هم‌بُعد) یا رشته
    if (left.kind === "number" && right.kind === "number") {
      const l = this.toBase(left).value;
      const r = this.toBase(right).value;
      const out: RuntimeValue = {
        kind: "bool",
        value: op === "<" ? l < r : op === "<=" ? l <= r : op === ">" ? l > r : l >= r,
      };
      this.pushTrace({ nodeId: node.id, op: `binary:${op}`, value: out.value });
      return out;
    }
    if (left.kind === "string" && right.kind === "string") {
      const l = left.value;
      const r = right.value;
      const out: RuntimeValue = {
        kind: "bool",
        value: op === "<" ? l < r : op === "<=" ? l <= r : op === ">" ? l > r : l >= r,
      };
      this.pushTrace({ nodeId: node.id, op: `binary:${op}`, value: out.value });
      return out;
    }
    this.error("type", `مقایسه ترتیبی «${op}» فقط بین دو عدد هم‌بُعد یا دو رشته مجاز است.`, node.id);
    return null;
  }

  /** تبدیل عدد به واحد پایه بُعدش (برای مقایسه/جمع بین واحدهای هم‌بُعد) */
  private toBase(rv: Extract<RuntimeValue, { kind: "number" }>): { value: number; unit?: string } {
    const u = getUnit(rv.unit);
    if (!u || u.factor === 1) return { value: rv.value, unit: rv.unit };
    // پایه هر بُعد: time→s · length→m · count→pcs · percent→ratio · dimensionless→بدون واحد
    if (u.dimension === "time") return { value: rv.value * u.factor, unit: "s" };
    if (u.dimension === "length") return { value: rv.value * u.factor, unit: "m" };
    if (u.dimension === "percent") return { value: rv.value * u.factor, unit: "ratio" };
    return { value: rv.value * u.factor, unit: rv.unit };
  }

  private evalArithmetic(
    node: Extract<ExprNode, { kind: "binary" }>,
    left: RuntimeValue,
    right: RuntimeValue,
  ): RuntimeValue | null {
    const { op } = node;

    // + رشته: الحاق
    if (op === "+" && left.kind === "string" && right.kind === "string") {
      const out: RuntimeValue = { kind: "string", value: left.value + right.value };
      this.pushTrace({ nodeId: node.id, op: "binary:+", value: out.value });
      return out;
    }

    if (left.kind !== "number" || right.kind !== "number") {
      this.error("type", `عملگر «${op}» فقط بین دو عدد (یا دو رشته برای +) مجاز است.`, node.id);
      return null;
    }

    const lu = getUnit(left.unit);
    const ru = getUnit(right.unit);
    const lDim = lu?.dimension ?? (left.unit ? left.unit : undefined);
    const rDim = ru?.dimension ?? (right.unit ? right.unit : undefined);

    if (op === "+" || op === "-" || op === "%") {
      // هم‌بُعد لازم (بدون واحد = بی‌توجهی به بُعد، ولی ترکیب با واحد مشخص خطای unit دارد)
      if (lDim !== undefined && rDim !== undefined && lDim !== rDim) {
        this.error(
          "unit",
          `واحد ناسازگار در «${op}»: ${this.fmt(left)} با ${this.fmt(right)} — ابتدا با toUnit هم‌بُعد کنید.`,
          node.id,
        );
        return null;
      }
      const outUnit = left.unit ?? right.unit;
      let value: number;
      if (op === "%") {
        // باقیمانده: روی مقدار خام
        value = left.value % right.value;
      } else {
        // جمع/تفریق در واحد خروجی (اگر واحد مشخص است، هر دو سمت به آن تبدیل می‌شوند؛
        // سمت بدون واحد فقط وقتی مجاز است که واحد خروجی بی‌بُعد باشد)
        try {
          const l = convertValue(left.value, left.unit, outUnit ?? "");
          const r = convertValue(right.value, right.unit, outUnit ?? "");
          value = op === "+" ? l + r : l - r;
        } catch (err) {
          if (err instanceof UnitError) {
            this.error("unit", err.message, node.id);
            return null;
          }
          throw err;
        }
      }
      const out = numberValue(value, outUnit);
      this.pushTrace({ nodeId: node.id, op: `binary:${op}`, value: out.value, unit: out.unit ?? null });
      return out;
    }

    // * و /
    if (op === "*") {
      // ضرب: بی‌بُعد خنثی است؛ «تعداد» در ضرب مضرب تکرار است و خنثی می‌شود
      // (زمان × تعداد = زمان کل — قرارداد صنعتی؛ در تقسیم، تعداد بُعد می‌ماند: تاکت s/pcs)
      let outUnit: string | undefined;
      const lBase = lu?.dimension ?? "dimensionless";
      const rBase = ru?.dimension ?? "dimensionless";
      if (lDim === undefined || rDim === undefined) {
        outUnit = left.unit ?? right.unit;
      } else if (lBase === "dimensionless" || rBase === "dimensionless") {
        outUnit = lBase === "dimensionless" ? right.unit : left.unit;
      } else if (lBase === "count" || rBase === "count") {
        outUnit = lBase === "count" ? right.unit : left.unit;
      } else {
        outUnit = `${left.unit ?? "?"}*${right.unit ?? "?"}`.replace(/^\*+|\*+$/g, "") || undefined;
      }
      const out = numberValue(left.value * right.value, outUnit);
      this.pushTrace({ nodeId: node.id, op: "binary:*", value: out.value, unit: out.unit ?? null });
      return out;
    }

    // تقسیم
    if (right.value === 0) {
      this.error("div0", "تقسیم بر صفر.", node.id);
      return null;
    }
    let outUnit: string | undefined;
    const lBaseD = lu?.dimension ?? "dimensionless";
    const rBaseD = ru?.dimension ?? "dimensionless";
    if (lDim === undefined && rDim === undefined) {
      outUnit = undefined; // بی‌واحد / بی‌واحد
    } else if (lDim === undefined) {
      outUnit = `1/${right.unit ?? "?"}`; // بی‌واحد بر واحد‌دار
    } else if (rDim === undefined || rBaseD === "dimensionless") {
      outUnit = left.unit; // تقسیم بر بی‌بُعد → واحد حفظ
    } else if (lBaseD === "dimensionless") {
      outUnit = `1/${right.unit ?? "?"}`; // بی‌بُعد بر بُعددار → معکوس
    } else {
      const outDim = divideDimensions(lBaseD, rBaseD);
      outUnit =
        outDim === "time" ? (left.unit ?? "s")
        : outDim === "length" ? (left.unit ?? "m")
        : outDim === "count" ? (left.unit ?? "pcs")
        : outDim === "percent" ? (left.unit ?? "percent")
        : `${left.unit ?? "?"}/${right.unit ?? "?"}`;
    }
    const out = numberValue(left.value / right.value, outUnit);
    this.pushTrace({ nodeId: node.id, op: "binary:/", value: out.value, unit: out.unit ?? null });
    return out;
  }

  private evalIf(node: Extract<ExprNode, { kind: "if" }>): RuntimeValue | null {
    const cond = this.evalNode(node.condition);
    if (cond === null) return null;
    const b = this.truthy(cond, node.condition.id);
    if (b === null) return null;
    const out = this.evalNode(b ? node.thenExpr : node.elseExpr);
    this.pushTrace({ nodeId: node.id, op: "if", detail: b ? "شاخه «آنگاه»" : "شاخه «وگرنه»", value: this.traceValue(out) });
    return out;
  }

  private evalCall(node: Extract<ExprNode, { kind: "call" }>): RuntimeValue | null {
    const sig = FUNCTION_SIGNATURES[node.callee];
    if (!sig) {
      this.error("ref", `تابع «${node.callee}» در فهرست مجاز نیست.`, node.id);
      return null;
    }
    if (node.args.length < sig.minArgs || node.args.length > sig.maxArgs) {
      this.error(
        "type",
        `تابع «${node.callee}» بین ${sig.minArgs} تا ${sig.maxArgs} آرگومان می‌گیرد (${node.args.length} داده شده).`,
        node.id,
      );
      return null;
    }

    const evaluated = node.args.map((a) => this.evalNode(a));
    if (evaluated.some((a) => a === null)) return null;
    const args = evaluated as RuntimeValue[];

    const out = this.applyFunction(node, node.callee, args);
    if (out === null) return null;
    this.pushTrace({ nodeId: node.id, op: `call:${node.callee}`, value: this.traceValue(out), unit: this.traceUnit(out) });
    return out;
  }

  private numbersOf(rv: RuntimeValue, callee: string, nodeId: number): number[] | null {
    if (rv.kind === "array") {
      const out: number[] = [];
      for (const item of rv.items) {
        if (item.kind === "null") {
          this.error("missing", `آرایه ورودی «${callee}» شامل مقدار ناموجود (null) است.`);
          return null;
        }
        if (item.kind !== "number") {
          this.error("type", `آرایه ورودی «${callee}» باید عددی باشد؛ عنصری غیرعددی یافت شد.`, nodeId);
          return null;
        }
        out.push(item.value);
      }
      return out;
    }
    this.error("type", `«${callee}» آرایه عددی می‌گیرد.`, nodeId);
    return null;
  }

  /** واحد نخستین عنصر عددی آرایه (برای انتشار واحد در تجمیع‌ها) */
  private arrayUnit(rv: RuntimeValue): string | undefined {
    if (rv.kind === "array") {
      const first = rv.items.find((it) => it.kind === "number");
      return first && first.kind === "number" ? first.unit : undefined;
    }
    return undefined;
  }

  private applyFunction(node: Extract<ExprNode, { kind: "call" }>, callee: string, args: RuntimeValue[]): RuntimeValue | null {
    const nodeId = node.id;
    switch (callee) {
      case "abs": {
        const x = args[0];
        if (x.kind !== "number") return this.typeErr(callee, "number", nodeId);
        return numberValue(Math.abs(x.value), x.unit);
      }
      case "min": {
        const nums = this.allNumbers(callee, args, nodeId);
        if (nums === null) return null;
        return numberValue(Math.min(...nums));
      }
      case "max": {
        const nums = this.allNumbers(callee, args, nodeId);
        if (nums === null) return null;
        return numberValue(Math.max(...nums));
      }
      case "round": {
        const x = args[0];
        if (x.kind !== "number") return this.typeErr(callee, "number", nodeId);
        const d = args.length > 1 ? args[1] : null;
        if (d !== null && d.kind !== "number") return this.typeErr(callee, "number", nodeId);
        const digits = d && d.kind === "number" ? Math.max(0, Math.min(10, Math.trunc(d.value))) : 0;
        const factor = Math.pow(10, digits);
        return numberValue(Math.round(x.value * factor) / factor, x.unit);
      }
      case "floor": {
        const x = args[0];
        if (x.kind !== "number") return this.typeErr(callee, "number", nodeId);
        return numberValue(Math.floor(x.value), x.unit);
      }
      case "ceil": {
        const x = args[0];
        if (x.kind !== "number") return this.typeErr(callee, "number", nodeId);
        return numberValue(Math.ceil(x.value), x.unit);
      }
      case "sqrt": {
        const x = args[0];
        if (x.kind !== "number") return this.typeErr(callee, "number", nodeId);
        if (x.value < 0) {
          this.error("type", "sqrt عدد منفی نمی‌گیرد.", nodeId);
          return null;
        }
        return numberValue(Math.sqrt(x.value));
      }
      case "pow": {
        const [a, b] = args;
        if (a.kind !== "number" || b.kind !== "number") return this.typeErr(callee, "number", nodeId);
        const out = Math.pow(a.value, b.value);
        if (!Number.isFinite(out)) {
          this.error("limit", "نتیجه pow خارج از محدوده اعداد مجاز است.", nodeId);
          return null;
        }
        return numberValue(out);
      }
      case "sum": {
        const arr = this.numbersOf(args[0], callee, nodeId);
        if (arr === null) return null;
        return numberValue(arr.reduce((a, b) => a + b, 0), this.arrayUnit(args[0]));
      }
      case "mean": {
        const arr = this.numbersOf(args[0], callee, nodeId);
        if (arr === null) return null;
        if (arr.length === 0) {
          this.error("type", "mean روی آرایه خالی تعریف نشده است.", nodeId);
          return null;
        }
        return numberValue(arr.reduce((a, b) => a + b, 0) / arr.length, this.arrayUnit(args[0]));
      }
      case "median": {
        const arr = this.numbersOf(args[0], callee, nodeId);
        if (arr === null) return null;
        if (arr.length === 0) {
          this.error("type", "median روی آرایه خالی تعریف نشده است (n≥۱ لازم است).", nodeId);
          return null;
        }
        const sorted = [...arr].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return numberValue(
          sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2,
          this.arrayUnit(args[0]),
        );
      }
      case "stddev": {
        const arr = this.numbersOf(args[0], callee, nodeId);
        if (arr === null) return null;
        if (arr.length < 2) {
          this.error("type", "stddev نمونه حداقل دو مشاهده می‌خواهد (مخرج n−1).", nodeId);
          return null;
        }
        const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
        const ss = arr.reduce((acc, v) => acc + (v - mean) * (v - mean), 0);
        return numberValue(Math.sqrt(ss / (arr.length - 1)), this.arrayUnit(args[0]));
      }
      case "count": {
        const a = args[0];
        if (a.kind !== "array") return this.typeErr(callee, "array", nodeId);
        return numberValue(a.items.length);
      }
      case "quantile": {
        const arr = this.numbersOf(args[0], callee, nodeId);
        if (arr === null) return null;
        const p = args[1];
        if (p.kind !== "number") return this.typeErr(callee, "number", nodeId);
        if (arr.length === 0) {
          this.error("type", "quantile روی آرایه خالی تعریف نشده است.", nodeId);
          return null;
        }
        if (p.value < 0 || p.value > 1) {
          this.error("type", "چندک p باید بین ۰ و ۱ باشد.", nodeId);
          return null;
        }
        const sorted = [...arr].sort((a, b) => a - b);
        const pos = (sorted.length - 1) * p.value;
        const lo = Math.floor(pos);
        const hi = Math.ceil(pos);
        return numberValue(lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo), this.arrayUnit(args[0]));
      }
      case "if": {
        // if(cond, a, b) — سه آرگومان؛ cond باید بولی باشد
        const cond = this.truthy(args[0], nodeId);
        if (cond === null) return null;
        return cond ? args[1] : args[2];
      }
      case "coalesce": {
        for (const a of args) {
          if (a.kind !== "null") return a;
        }
        return { kind: "null" };
      }
      case "and": {
        for (const a of args) {
          const b = this.truthy(a, nodeId);
          if (b === null) return null;
          if (!b) return { kind: "bool", value: false };
        }
        return { kind: "bool", value: true };
      }
      case "or": {
        for (const a of args) {
          const b = this.truthy(a, nodeId);
          if (b === null) return null;
          if (b) return { kind: "bool", value: true };
        }
        return { kind: "bool", value: false };
      }
      case "not": {
        const b = this.truthy(args[0], nodeId);
        if (b === null) return null;
        return { kind: "bool", value: !b };
      }
      case "isMissing": {
        return { kind: "bool", value: args[0].kind === "null" };
      }
      case "toUnit": {
        const x = args[0];
        const target = args[1];
        if (x.kind !== "number") return this.typeErr(callee, "number", nodeId);
        if (target.kind !== "string") return this.typeErr(callee, "string", nodeId);
        try {
          const converted = convertValue(x.value, x.unit, target.value);
          return numberValue(converted, target.value);
        } catch (err) {
          if (err instanceof UnitError) {
            this.error("unit", err.message, nodeId);
            return null;
          }
          throw err;
        }
      }
      case "duration": {
        const x = args[0];
        const unitArg = args[1];
        if (x.kind !== "number") return this.typeErr(callee, "number", nodeId);
        if (unitArg.kind !== "string") return this.typeErr(callee, "string", nodeId);
        const u = getUnit(unitArg.value);
        if (!u || u.dimension !== "time") {
          this.error("unit", `«${unitArg.value}» واحد زمانی معتبر نیست (ms/s/min/h).`, nodeId);
          return null;
        }
        return numberValue(x.value, unitArg.value);
      }
      default:
        this.error("ref", `تابع «${callee}» پیاده‌سازی نشده است.`, nodeId);
        return null;
    }
  }

  private allNumbers(callee: string, args: RuntimeValue[], nodeId: number): number[] | null {
    const out: number[] = [];
    for (const a of args) {
      if (a.kind === "null") {
        this.error("missing", `آرگومان «${callee}» مقدار ندارد.`);
        return null;
      }
      if (a.kind !== "number") {
        this.error("type", `«${callee}» فقط آرگومان عددی می‌گیرد.`, nodeId);
        return null;
      }
      out.push(a.value);
    }
    return out;
  }

  private typeErr(callee: string, expected: string, nodeId: number): null {
    this.error("type", `تابع «${callee}» آرگومان از نوع ${expected} می‌خواهد.`, nodeId);
    return null;
  }
}

/** ارزیابی مستقل (بدون نمونه Evaluator) — تابع خالص قطعی */
export function evaluateAst(root: ExprNode, inputs: InputMap): EvalOutcome {
  return new Evaluator(inputs).evaluate(root);
}

/** مقدار ساده JSON-serializable (آرایه تخت؛ آرایه تودرتو پهن نمی‌شود) */
export type PlainValue = number | string | boolean | null | Array<number | string | boolean | null>;

/** تبدیل RuntimeValue به مقدار JSON-serializable */
export function runtimeToPlain(rv: RuntimeValue | null): { value: PlainValue; unit?: string } {
  if (rv === null) return { value: null };
  switch (rv.kind) {
    case "number":
      return { value: rv.value, ...(rv.unit !== undefined ? { unit: rv.unit } : {}) };
    case "string":
      return { value: rv.value };
    case "bool":
      return { value: rv.value };
    case "null":
      return { value: null };
    case "array":
      // آرایه‌های ورودی تخت‌اند؛ فرزند آرایه عملاً رخ نمی‌دهد — cast امن
      return { value: rv.items.map((it) => runtimeToPlain(it).value) as PlainValue };
  }
}
