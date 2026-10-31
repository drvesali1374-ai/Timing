/**
 * انواع AST زبان عبارتی امن (DSL v1) — ADR-003.
 *
 * گرامر (FORMULA_CATALOG.md §5٫۲):
 *   expr := or_expr ; or_expr := and_expr ("||" and_expr)* ;
 *   and_expr := cmp_expr ("&&" cmp_expr)* ;
 *   cmp_expr := add_expr (("=="|"!="|"<"|"<="|">"|">=") add_expr)* ;
 *   add_expr := mul_expr (("+"|"-") mul_expr)* ;
 *   mul_expr := unary (("*"|"/"|"%") unary)* ;
 *   unary := ("-"|"!")? primary ;
 *   primary := number | string | true | false | null | ident call? | "(" expr ")" | if_expr ;
 *   if_expr := "if" "(" expr "," expr "," expr ")" ;
 *
 * سقف‌ها (قفل‌شده): عمق ≤ ۶۴ · گره ≤ ۵۱۲ · طول عبارت ≤ ۲۰۴۸ نویسه.
 * شناسه‌ها نقطه‌دار مجازند (پارامترها مثل «study.shift» و نتایج فرمول‌های دیگر).
 */

export type BinaryOp =
  | "||"
  | "&&"
  | "=="
  | "!="
  | "<"
  | "<="
  | ">"
  | ">="
  | "+"
  | "-"
  | "*"
  | "/"
  | "%";

export type UnaryOp = "-" | "!";

export interface BaseNode {
  /** شناسه عددی پایدار درون یک AST (برای ارجاع در trace و خطاها) */
  id: number;
  /** عمق گره در درخت (برای قید سقف عمق) */
  depth: number;
}

export interface NumNode extends BaseNode {
  kind: "num";
  value: number;
}

export interface StrNode extends BaseNode {
  kind: "str";
  value: string;
}

export interface BoolNode extends BaseNode {
  kind: "bool";
  value: boolean;
}

export interface NullNode extends BaseNode {
  kind: "null";
}

export interface IdentNode extends BaseNode {
  kind: "ident";
  /** نام کامل با نقطه‌ها — مثل «allowance.rate» */
  name: string;
}

export interface UnaryNode extends BaseNode {
  kind: "unary";
  op: UnaryOp;
  operand: ExprNode;
}

export interface BinaryNode extends BaseNode {
  kind: "binary";
  op: BinaryOp;
  left: ExprNode;
  right: ExprNode;
}

export interface CallNode extends BaseNode {
  kind: "call";
  /** نام تابع — فقط از فهرست بسته توابع مجاز */
  callee: string;
  args: ExprNode[];
}

export interface IfNode extends BaseNode {
  kind: "if";
  condition: ExprNode;
  thenExpr: ExprNode;
  elseExpr: ExprNode;
}

export type ExprNode =
  | NumNode
  | StrNode
  | BoolNode
  | NullNode
  | IdentNode
  | UnaryNode
  | BinaryNode
  | CallNode
  | IfNode;

/** AST سریال‌شدنی برای ذخیره در snapshot پیکربندی */
export interface SerializedFormulaAst {
  dslVersion: "1";
  nodeCount: number;
  maxDepth: number;
  /** نگاشت id گره → گره (بازتولید ExprNode با parent/child با ارجاع id) */
  nodes: Array<Record<string, unknown>>;
}

/** سریال‌سازی AST به JSON بازتولیدپذیر (قطعی — ترتیب پیمایش ثابت) */
export function serializeAst(root: ExprNode): SerializedFormulaAst {
  const nodes: Array<Record<string, unknown>> = [];
  function walk(node: ExprNode): number {
    const base = { id: node.id, depth: node.depth };
    let record: Record<string, unknown>;
    switch (node.kind) {
      case "num":
        record = { ...base, kind: "num", value: node.value };
        break;
      case "str":
        record = { ...base, kind: "str", value: node.value };
        break;
      case "bool":
        record = { ...base, kind: "bool", value: node.value };
        break;
      case "null":
        record = { ...base, kind: "null" };
        break;
      case "ident":
        record = { ...base, kind: "ident", name: node.name };
        break;
      case "unary":
        record = { ...base, kind: "unary", op: node.op, operand: walk(node.operand) };
        break;
      case "binary":
        record = { ...base, kind: "binary", op: node.op, left: walk(node.left), right: walk(node.right) };
        break;
      case "call":
        record = { ...base, kind: "call", callee: node.callee, args: node.args.map(walk) };
        break;
      case "if":
        record = {
          ...base,
          kind: "if",
          condition: walk(node.condition),
          thenExpr: walk(node.thenExpr),
          elseExpr: walk(node.elseExpr),
        };
        break;
    }
    const index = nodes.length;
    nodes.push(record);
    return index;
  }
  walk(root);
  return {
    dslVersion: "1",
    nodeCount: countNodes(root),
    maxDepth: maxDepthOf(root),
    nodes,
  };
}

/** بازساخت AST از فرم سریال‌شده (اندیس ۰ = ریشه؛ فرزندان با اندیس آرایه) */
export function deserializeAst(serialized: SerializedFormulaAst): ExprNode {
  function rebuild(index: number): ExprNode {
    const r = serialized.nodes[index];
    if (!r || typeof r !== "object") throw new Error("AST خراب است.");
    const id = Number(r.id);
    const depth = Number(r.depth);
    switch (r.kind) {
      case "num":
        return { kind: "num", id, depth, value: Number(r.value) };
      case "str":
        return { kind: "str", id, depth, value: String(r.value) };
      case "bool":
        return { kind: "bool", id, depth, value: Boolean(r.value) };
      case "null":
        return { kind: "null", id, depth };
      case "ident":
        return { kind: "ident", id, depth, name: String(r.name) };
      case "unary":
        return { kind: "unary", id, depth, op: r.op as UnaryOp, operand: rebuild(Number(r.operand)) };
      case "binary":
        return {
          kind: "binary",
          id,
          depth,
          op: r.op as BinaryOp,
          left: rebuild(Number(r.left)),
          right: rebuild(Number(r.right)),
        };
      case "call":
        return {
          kind: "call",
          id,
          depth,
          callee: String(r.callee),
          args: (r.args as number[]).map(rebuild),
        };
      case "if":
        return {
          kind: "if",
          id,
          depth,
          condition: rebuild(Number(r.condition)),
          thenExpr: rebuild(Number(r.thenExpr)),
          elseExpr: rebuild(Number(r.elseExpr)),
        };
      default:
        throw new Error("نوع گره AST ناشناخته است.");
    }
  }
  return rebuild(0);
}

export function countNodes(node: ExprNode): number {
  switch (node.kind) {
    case "num":
    case "str":
    case "bool":
    case "null":
    case "ident":
      return 1;
    case "unary":
      return 1 + countNodes(node.operand);
    case "binary":
      return 1 + countNodes(node.left) + countNodes(node.right);
    case "call":
      return 1 + node.args.reduce((acc, a) => acc + countNodes(a), 0);
    case "if":
      return 1 + countNodes(node.condition) + countNodes(node.thenExpr) + countNodes(node.elseExpr);
  }
}

export function maxDepthOf(node: ExprNode): number {
  switch (node.kind) {
    case "num":
    case "str":
    case "bool":
    case "null":
    case "ident":
      return node.depth;
    case "unary":
      return maxDepthOf(node.operand);
    case "binary":
      return Math.max(maxDepthOf(node.left), maxDepthOf(node.right));
    case "call":
      return Math.max(node.depth, ...node.args.map(maxDepthOf));
    case "if":
      return Math.max(maxDepthOf(node.condition), maxDepthOf(node.thenExpr), maxDepthOf(node.elseExpr));
  }
}

/** پیمایش عمق-اول همه گره‌ها (برای تحلیل ایستا) */
export function walkAll(node: ExprNode, visit: (n: ExprNode) => void): void {
  visit(node);
  switch (node.kind) {
    case "unary":
      walkAll(node.operand, visit);
      break;
    case "binary":
      walkAll(node.left, visit);
      walkAll(node.right, visit);
      break;
    case "call":
      node.args.forEach((a) => walkAll(a, visit));
      break;
    case "if":
      walkAll(node.condition, visit);
      walkAll(node.thenExpr, visit);
      walkAll(node.elseExpr, visit);
      break;
    default:
      break;
  }
}
