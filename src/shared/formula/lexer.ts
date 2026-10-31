/**
 * Tokenizer زبان عبارتی امن (DSL v1) — ADR-003.
 * ساختار الهام‌گرفته از الگوی jsep v1.6 (MIT) — بدون وابستگی اجرایی.
 *
 * فقط نویسه‌های ASCII در عبارت مجازند؛ رشته‌ها با ' یا " و escape استاندارد.
 * هیچ مسیر اجرایی، eval/Function یا دسترسی به سیستم ندارد.
 */

export type TokenKind =
  | "number"
  | "string"
  | "ident"
  | "op" // || && == != < <= > >= + - * / % !
  | "lparen"
  | "rparen"
  | "comma";

export interface Token {
  kind: TokenKind;
  value: string;
  /** موقعیت شروع (برای پیام خطا) */
  start: number;
}

export class LexerError extends Error {
  constructor(
    message: string,
    readonly position: number,
  ) {
    super(message);
    this.name = "LexerError";
  }
}

const OPERATORS = ["||", "&&", "==", "!=", "<=", ">=", "<", ">", "+", "-", "*", "/", "%", "!"] as const;

/** حداکثر طول عبارت (قفل سند جامع بند B3/ADR-003) */
export const MAX_EXPR_LENGTH = 2048;

export function tokenize(source: string): Token[] {
  if (typeof source !== "string") throw new LexerError("عبارت باید متن باشد.", 0);
  if (source.length === 0) throw new LexerError("عبارت خالی است.", 0);
  if (source.length > MAX_EXPR_LENGTH) {
    throw new LexerError(`طول عبارت ${source.length} نویسه است؛ سقف مجاز ${MAX_EXPR_LENGTH} است.`, 0);
  }

  const tokens: Token[] = [];
  let i = 0;
  const n = source.length;

  while (i < n) {
    const ch = source[i];

    // فاصله/تب — رد می‌شود
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      i += 1;
      continue;
    }

    // عدد (اعشاری) — فقط ASCII
    if (ch >= "0" && ch <= "9") {
      const start = i;
      let sawDot = false;
      while (i < n) {
        const c = source[i];
        if (c >= "0" && c <= "9") {
          i += 1;
        } else if (c === "." && !sawDot && i + 1 < n && source[i + 1] >= "0" && source[i + 1] <= "9") {
          sawDot = true;
          i += 1;
        } else {
          break;
        }
      }
      tokens.push({ kind: "number", value: source.slice(start, i), start });
      continue;
    }

    // رشته
    if (ch === "'" || ch === '"') {
      const quote = ch;
      const start = i;
      i += 1;
      let value = "";
      let closed = false;
      while (i < n) {
        const c = source[i];
        if (c === "\\") {
          // escape: \\ \' \" \n \t \r
          if (i + 1 >= n) throw new LexerError("رشته بدون پایان است (escape رهاشده).", start);
          const esc = source[i + 1];
          if (esc === "\\") value += "\\";
          else if (esc === "'") value += "'";
          else if (esc === '"') value += '"';
          else if (esc === "n") value += "\n";
          else if (esc === "t") value += "\t";
          else if (esc === "r") value += "\r";
          else throw new LexerError(`escape ناشناخته «\\${esc}».`, i);
          i += 2;
          continue;
        }
        if (c === quote) {
          closed = true;
          i += 1;
          break;
        }
        value += c;
        i += 1;
      }
      if (!closed) throw new LexerError("رشته بدون علامت پایان است.", start);
      tokens.push({ kind: "string", value, start });
      continue;
    }

    // شناسه (حروف/زیرخط شروع؛ نقطه برای نام‌های پارامتری مجاز)
    if ((ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_") {
      const start = i;
      let name = "";
      while (i < n) {
        const c = source[i];
        if ((c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || (c >= "0" && c <= "9") || c === "_" || c === ".") {
          name += c;
          i += 1;
        } else {
          break;
        }
      }
      // نقطه انتهایی نامعتبر است
      if (name.endsWith(".") || name.includes("..")) {
        throw new LexerError(`شناسه «${name}» نامعتبر است.`, start);
      }
      tokens.push({ kind: "ident", value: name, start });
      continue;
    }

    // عملگرها
    if (ch === "(") {
      tokens.push({ kind: "lparen", value: "(", start: i });
      i += 1;
      continue;
    }
    if (ch === ")") {
      tokens.push({ kind: "rparen", value: ")", start: i });
      i += 1;
      continue;
    }
    if (ch === ",") {
      tokens.push({ kind: "comma", value: ",", start: i });
      i += 1;
      continue;
    }

    const twoChar = source.slice(i, i + 2);
    if ((OPERATORS as readonly string[]).includes(twoChar)) {
      tokens.push({ kind: "op", value: twoChar, start: i });
      i += 2;
      continue;
    }
    if ((OPERATORS as readonly string[]).includes(ch)) {
      tokens.push({ kind: "op", value: ch, start: i });
      i += 1;
      continue;
    }

    throw new LexerError(`نویسه ناشناخته «${ch}» در عبارت.`, i);
  }

  if (tokens.length === 0) throw new LexerError("عبارت خالی است.", 0);
  return tokens;
}
