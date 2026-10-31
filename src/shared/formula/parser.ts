/**
 * پارسر بازگشتی-نزولی زبان عبارتی امن (DSL v1) — ADR-003.
 * فقط AST می‌سازد؛ هیچ ارزیابی/اجرایی در این لایه وجود ندارد.
 *
 * سقف‌های ساختاری هنگام parse اعمال می‌شوند:
 *   - عمق ≤ ۶۴، تعداد گره ≤ ۵۱۲ (پیش از اعتبارسنجی معنایی).
 */

import type { BinaryOp, ExprNode, UnaryOp } from "./ast";
import { countNodes } from "./ast";
import { tokenize, type Token } from "./lexer";

export class ParserError extends Error {
  constructor(
    message: string,
    readonly position: number,
  ) {
    super(message);
    this.name = "ParserError";
  }
}

export const MAX_NODE_COUNT = 512;
export const MAX_AST_DEPTH = 64;

export interface ParseSuccess {
  ok: true;
  ast: ExprNode;
  nodeCount: number;
}

export interface ParseFailure {
  ok: false;
  error: { messageFa: string; position: number };
}

export type ParseResult = ParseSuccess | ParseFailure;

/** کلیدواژه‌های محفوظ (literalها و شرط) */
const KEYWORDS = new Set(["true", "false", "null", "if"]);

export function parseFormula(source: string): ParseResult {
  try {
    const tokens = tokenize(source);
    const parser = new Parser(tokens);
    const ast = parser.parseExpression();
    const nodeCount = countNodes(ast);
    if (nodeCount > MAX_NODE_COUNT) {
      return {
        ok: false,
        error: { messageFa: `تعداد گره عبارت ${nodeCount} است؛ سقف مجاز ${MAX_NODE_COUNT} است.`, position: 0 },
      };
    }
    // توکن اضافی پس از پایان عبارت؟
    const trailing = parser.peek();
    if (trailing) {
      return {
        ok: false,
        error: {
          messageFa: `عبارت پس از پایان مجاز، توکن اضافه «${trailing.value}» دارد.`,
          position: trailing.start,
        },
      };
    }
    return { ok: true, ast, nodeCount };
  } catch (err) {
    if (err instanceof ParserError) {
      return { ok: false, error: { messageFa: err.message, position: err.position } };
    }
    // LexerError و موارد غیرمنتظره — پیام فارسی امن (بدون افشای داخلی)
    const message = err instanceof Error && err.name === "LexerError" ? err.message : "عبارت قابل تجزیه نیست.";
    const position = err instanceof Error && typeof (err as { position?: number }).position === "number"
      ? (err as unknown as { position: number }).position
      : 0;
    return { ok: false, error: { messageFa: message, position } };
  }
}

class Parser {
  private pos = 0;
  private nextNodeId = 0;

  constructor(private readonly tokens: Token[]) {}

  peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private advance(): Token {
    const token = this.tokens[this.pos];
    if (!token) throw new ParserError("عبارت ناقص است — انتظار ادامه عبارت.", 0);
    this.pos += 1;
    return token;
  }

  private expectOp(op: string): Token {
    const t = this.peek();
    if (!t || t.kind !== "op" || t.value !== op) {
      throw new ParserError(`انتظار عملگر «${op}» بود.`, t?.start ?? 0);
    }
    return this.advance();
  }

  parseExpression(depth = 0): ExprNode {
    this.checkDepth(depth);
    return this.parseOr(depth);
  }

  private checkDepth(depth: number): void {
    if (depth > MAX_AST_DEPTH) {
      throw new ParserError(`عمق تودرتویی عبارت از سقف ${MAX_AST_DEPTH} گذشته است.`, 0);
    }
  }

  private parseOr(depth: number): ExprNode {
    let left = this.parseAnd(depth + 1);
    while (this.matchOp("||")) {
      const right = this.parseAnd(depth + 1);
      left = { kind: "binary", id: this.nextNodeId++, depth, op: "||" as BinaryOp, left, right };
    }
    return left;
  }

  private parseAnd(depth: number): ExprNode {
    let left = this.parseCmp(depth + 1);
    while (this.matchOp("&&")) {
      const right = this.parseCmp(depth + 1);
      left = { kind: "binary", id: this.nextNodeId++, depth, op: "&&" as BinaryOp, left, right };
    }
    return left;
  }

  private parseCmp(depth: number): ExprNode {
    let left = this.parseAdd(depth + 1);
    const cmpOps = ["==", "!=", "<", "<=", ">", ">="];
    for (;;) {
      const t = this.peek();
      if (t && t.kind === "op" && cmpOps.includes(t.value)) {
        this.advance();
        const right = this.parseAdd(depth + 1);
        left = { kind: "binary", id: this.nextNodeId++, depth, op: t.value as BinaryOp, left, right };
      } else {
        break;
      }
    }
    return left;
  }

  private parseAdd(depth: number): ExprNode {
    let left = this.parseMul(depth + 1);
    for (;;) {
      const t = this.peek();
      if (t && t.kind === "op" && (t.value === "+" || t.value === "-")) {
        this.advance();
        const right = this.parseMul(depth + 1);
        left = { kind: "binary", id: this.nextNodeId++, depth, op: t.value as BinaryOp, left, right };
      } else {
        break;
      }
    }
    return left;
  }

  private parseMul(depth: number): ExprNode {
    let left = this.parseUnary(depth + 1);
    for (;;) {
      const t = this.peek();
      if (t && t.kind === "op" && (t.value === "*" || t.value === "/" || t.value === "%")) {
        this.advance();
        const right = this.parseUnary(depth + 1);
        left = { kind: "binary", id: this.nextNodeId++, depth, op: t.value as BinaryOp, left, right };
      } else {
        break;
      }
    }
    return left;
  }

  private parseUnary(depth: number): ExprNode {
    this.checkDepth(depth);
    const t = this.peek();
    if (t && t.kind === "op" && (t.value === "-" || t.value === "!")) {
      this.advance();
      const operand = this.parseUnary(depth + 1);
      return { kind: "unary", id: this.nextNodeId++, depth, op: t.value as UnaryOp, operand };
    }
    return this.parsePrimary(depth);
  }

  private parsePrimary(depth: number): ExprNode {
    this.checkDepth(depth);
    const t = this.peek();
    if (!t) throw new ParserError("عبارت ناقص است — انتظار مقدار یا شناسه.", 0);

    if (t.kind === "number") {
      this.advance();
      return { kind: "num", id: this.nextNodeId++, depth, value: Number(t.value) };
    }

    if (t.kind === "string") {
      this.advance();
      return { kind: "str", id: this.nextNodeId++, depth, value: t.value };
    }

    if (t.kind === "lparen") {
      this.advance();
      const inner = this.parseExpression(depth + 1);
      const close = this.peek();
      if (!close || close.kind !== "rparen") {
        throw new ParserError("پرانتز بسته نشده است.", close?.start ?? 0);
      }
      this.advance();
      return inner;
    }

    if (t.kind === "ident") {
      this.advance();
      // کلیدواژه‌های literal
      if (t.value === "true") return { kind: "bool", id: this.nextNodeId++, depth, value: true };
      if (t.value === "false") return { kind: "bool", id: this.nextNodeId++, depth, value: false };
      if (t.value === "null") return { kind: "null", id: this.nextNodeId++, depth };

      // if(cond, a, b) — به‌صورت call با نام «if»
      if (t.value === "if") {
        const next = this.peek();
        if (next && next.kind === "lparen") {
          return this.parseCallLike(t.value, depth);
        }
        throw new ParserError("«if» باید با پرانتز و سه آرگومان بیاید: if(شرط, مقدار درستی, مقدار نادرستی).", t.start);
      }

      // فراخوانی تابع؟
      const next = this.peek();
      if (next && next.kind === "lparen") {
        return this.parseCallLike(t.value, depth);
      }

      // شناسه ساده (پارامتر یا نتیجه فرمول دیگر)
      if (KEYWORDS.has(t.value)) {
        throw new ParserError(`«${t.value}» کلیدواژه محفوظ است.`, t.start);
      }
      return { kind: "ident", id: this.nextNodeId++, depth, name: t.value };
    }

    throw new ParserError(`توکن غیرمنتظره «${t.value}».`, t.start);
  }

  private parseCallLike(callee: string, depth: number): ExprNode {
    const open = this.peek();
    if (!open || open.kind !== "lparen") {
      throw new ParserError("انتظار پرانتز باز پس از نام تابع بود.", open?.start ?? 0);
    }
    this.advance();
    const args: ExprNode[] = [];
    const first = this.peek();
    if (first && first.kind !== "rparen") {
      args.push(this.parseExpression(depth + 1));
      for (;;) {
        const t = this.peek();
        if (t && t.kind === "comma") {
          this.advance();
          args.push(this.parseExpression(depth + 1));
        } else {
          break;
        }
      }
    }
    const close = this.peek();
    if (!close || close.kind !== "rparen") {
      throw new ParserError("پرانتز فراخوانی بسته نشده است.", close?.start ?? 0);
    }
    this.advance();
    return { kind: "call", id: this.nextNodeId++, depth, callee, args };
  }

  private matchOp(op: string): boolean {
    const t = this.peek();
    if (t && t.kind === "op" && t.value === op) {
      this.pos += 1;
      return true;
    }
    return false;
  }
}
