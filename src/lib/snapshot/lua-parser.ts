/**
 * Minimal parser for the Lua table-literal subset that ESO writes into
 * SavedVariables files. This is NOT a general Lua interpreter — it only handles
 * the value grammar that appears in a saved-variables dump:
 *
 *   TopVar = { ... }        (one or more top-level assignments)
 *   tables: { [k]=v, name=v, positional, ... }  (',' or ';' separated)
 *   strings: "..."  '...'  [[ ... ]]
 *   numbers: 123  -1.5  0xFF
 *   booleans: true / false, and nil
 *   comments: -- line   and   --[[ block ]]
 *
 * Tables whose keys are exactly 1..N (ESO's explicit [1]=,[2]= list dumps as
 * well as positional literals) — and empty tables — become JS arrays; tables
 * with string keys become objects. This is intentionally strict and dependency
 * free so it stays auditable — the data path from game to disk to app matters.
 */

export type LuaValue = string | number | boolean | null | LuaValue[] | { [k: string]: LuaValue };

// Character codes, so the hot loops compare numbers instead of running a
// regular expression per character. A 36 MB SavedVariables file parses about
// 6x faster this way; the output is identical.
const C_TAB = 9;
const C_LF = 10;
const C_CR = 13;
const C_SPACE = 32;
const C_DQUOTE = 34;
const C_QUOTE = 39;
const C_COMMA = 44;
const C_DASH = 45;
const C_SEMI = 59;
const C_EQ = 61;
const C_LBRACKET = 91;
const C_BACKSLASH = 92;
const C_RBRACKET = 93;
const C_LBRACE = 123;
const C_RBRACE = 125;

/** The same set JavaScript's /\s/ matches. */
function isSpace(c: number): boolean {
  if (c === C_SPACE || (c >= C_TAB && c <= C_CR)) return true;
  if (c < 0xa0) return false;
  return (
    c === 0xa0 ||
    c === 0x1680 ||
    (c >= 0x2000 && c <= 0x200a) ||
    c === 0x2028 ||
    c === 0x2029 ||
    c === 0x202f ||
    c === 0x205f ||
    c === 0x3000 ||
    c === 0xfeff
  );
}

function isIdent(c: number): boolean {
  return (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95;
}

/** Ends a bare scalar token: whitespace , ; } ] */
function endsScalar(c: number): boolean {
  return isSpace(c) || c === C_COMMA || c === C_SEMI || c === C_RBRACE || c === C_RBRACKET;
}

class Parser {
  private i = 0;
  private readonly n: number;
  constructor(private readonly src: string) {
    this.n = src.length;
  }

  parseProgram(): Record<string, LuaValue> {
    const out: Record<string, LuaValue> = {};
    this.skip();
    while (this.i < this.n) {
      const name = this.readIdentifier();
      if (!name) break;
      this.skip();
      this.expect("=");
      this.skip();
      out[name] = this.parseValue();
      this.skip();
    }
    return out;
  }

  private parseValue(): LuaValue {
    this.skip();
    const c = this.src.charCodeAt(this.i);
    if (c === C_LBRACE) return this.parseTable();
    if (c === C_DQUOTE || c === C_QUOTE) return this.parseString(c);
    if (c === C_LBRACKET) {
      const next = this.src.charCodeAt(this.i + 1);
      if (next === C_LBRACKET || next === C_EQ) return this.parseLongString();
    }
    return this.parseScalar();
  }

  private parseTable(): LuaValue {
    this.expect("{");
    const keys: (string | null)[] = [];
    const values: LuaValue[] = [];
    // Fast path: every key so far is exactly the next index (ESO's [1]=,[2]=
    // lists) or every entry is positional. Those become arrays directly.
    let sequential = true;
    let explicit = 0;
    let positional = 0;
    this.skip();
    while (this.src.charCodeAt(this.i) !== C_RBRACE) {
      if (this.i >= this.n) throw new Error("Unterminated table");
      let key: string | null = null;
      if (this.src.charCodeAt(this.i) === C_LBRACKET) {
        // [key] = value
        this.i++;
        this.skip();
        const k = this.parseValue();
        this.skip();
        this.expect("]");
        this.skip();
        this.expect("=");
        key = String(k);
      } else {
        // Could be `name = value` or a bare positional value.
        const save = this.i;
        const ident = this.readIdentifier();
        this.skip();
        if (ident && this.src.charCodeAt(this.i) === C_EQ && this.src.charCodeAt(this.i + 1) !== C_EQ) {
          this.i++;
          key = ident;
        } else {
          this.i = save;
        }
      }
      this.skip();
      const value = this.parseValue();
      if (sequential) {
        if (key === null) {
          positional++;
          if (explicit > 0) sequential = false;
        } else {
          explicit++;
          if (positional > 0 || key !== String(explicit)) sequential = false;
        }
      }
      keys.push(key);
      values.push(value);
      this.skip();
      const sep = this.src.charCodeAt(this.i);
      if (sep === C_COMMA || sep === C_SEMI) {
        this.i++;
        this.skip();
      }
    }
    this.expect("}");

    // Empty Lua table. In ESO SavedVariables + our schema, empty tables are
    // always empty *lists* (guilds, items, characters, skillLines, ...). The
    // object-typed fields (currencies, attributes) are never emitted empty by
    // the addon, so representing {} as [] lets array schemas validate.
    if (values.length === 0) return [];
    if (sequential) return values;

    // Assign implicit 1-based indices to positional entries; keep explicit keys.
    const obj: Record<string, LuaValue> = {};
    let idx = 1;
    for (let k = 0; k < keys.length; k++) {
      const key = keys[k];
      if (key === null) obj[String(idx++)] = values[k];
      else obj[key] = values[k];
    }

    // Keys that end up exactly 1..N (in any order) are a list; anything with
    // string keys stays an object.
    const objKeys = Object.keys(obj);
    const isSequential = objKeys.every((k, n) => k === String(n + 1));
    if (isSequential) return objKeys.map((k) => obj[k]);
    return obj;
  }

  private parseString(quote: number): string {
    this.i++; // opening quote
    let out = "";
    let start = this.i;
    while (this.i < this.n) {
      const c = this.src.charCodeAt(this.i);
      if (c === quote) {
        out += this.src.slice(start, this.i);
        this.i++;
        return out;
      }
      if (c === C_BACKSLASH) {
        out += this.src.slice(start, this.i);
        const e = this.src[this.i + 1];
        this.i += 2;
        switch (e) {
          case "n": out += "\n"; break;
          case "t": out += "\t"; break;
          case "r": out += "\r"; break;
          case '"': out += '"'; break;
          case "'": out += "'"; break;
          case "\\": out += "\\"; break;
          default: out += e ?? ""; break;
        }
        start = this.i;
        continue;
      }
      this.i++;
    }
    throw new Error("Unterminated string");
  }

  private parseLongString(): string {
    // [[ ... ]] or [=[ ... ]=]
    this.expect("[");
    let eq = "";
    while (this.src.charCodeAt(this.i) === C_EQ) { eq += "="; this.i++; }
    this.expect("[");
    const close = "]" + eq + "]";
    const end = this.src.indexOf(close, this.i);
    if (end === -1) throw new Error("Unterminated long string");
    const content = this.src.slice(this.i, end);
    this.i = end + close.length;
    return content.replace(/^\n/, "");
  }

  private parseScalar(): LuaValue {
    const start = this.i;
    while (this.i < this.n && !endsScalar(this.src.charCodeAt(this.i))) this.i++;
    const tok = this.src.slice(start, this.i);
    if (tok === "true") return true;
    if (tok === "false") return false;
    if (tok === "nil") return null;
    if (/^0[xX][0-9a-fA-F]+$/.test(tok)) return parseInt(tok, 16);
    const num = Number(tok);
    if (!Number.isNaN(num) && tok !== "") return num;
    return tok; // bare identifier value (rare)
  }

  private readIdentifier(): string {
    const start = this.i;
    while (this.i < this.n && isIdent(this.src.charCodeAt(this.i))) this.i++;
    return this.src.slice(start, this.i);
  }

  private expect(ch: string) {
    if (this.src[this.i] !== ch) {
      throw new Error(`Expected '${ch}' at ${this.i}, got '${this.src[this.i] ?? "EOF"}'`);
    }
    this.i++;
  }

  /** Skip whitespace and Lua comments. */
  private skip() {
    for (;;) {
      while (this.i < this.n && isSpace(this.src.charCodeAt(this.i))) this.i++;
      if (this.src.charCodeAt(this.i) === C_DASH && this.src.charCodeAt(this.i + 1) === C_DASH) {
        this.i += 2;
        if (this.src.charCodeAt(this.i) === C_LBRACKET && this.src.charCodeAt(this.i + 1) === C_LBRACKET) {
          const end = this.src.indexOf("]]", this.i);
          this.i = end === -1 ? this.n : end + 2;
        } else {
          while (this.i < this.n && this.src.charCodeAt(this.i) !== C_LF) this.i++;
        }
        continue;
      }
      break;
    }
  }
}

export function parseLua(src: string): Record<string, LuaValue> {
  return new Parser(src).parseProgram();
}
