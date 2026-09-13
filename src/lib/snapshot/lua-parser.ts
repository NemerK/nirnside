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
 * Tables whose entries are all positional become JS arrays; otherwise objects
 * (numeric keys are stringified). This is intentionally strict and dependency
 * free so it stays auditable — the data path from game to disk to app matters.
 */

export type LuaValue = string | number | boolean | null | LuaValue[] | { [k: string]: LuaValue };

class Parser {
  private i = 0;
  constructor(private readonly src: string) {}

  parseProgram(): Record<string, LuaValue> {
    const out: Record<string, LuaValue> = {};
    this.skip();
    while (this.i < this.src.length) {
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
    const c = this.src[this.i];
    if (c === "{") return this.parseTable();
    if (c === '"' || c === "'") return this.parseString(c);
    if (c === "[" && (this.src[this.i + 1] === "[" || this.src[this.i + 1] === "=")) {
      return this.parseLongString();
    }
    return this.parseScalar();
  }

  private parseTable(): LuaValue {
    this.expect("{");
    const entries: { key: string | null; value: LuaValue }[] = [];
    this.skip();
    while (this.src[this.i] !== "}") {
      if (this.i >= this.src.length) throw new Error("Unterminated table");
      let key: string | null = null;
      if (this.src[this.i] === "[") {
        // [key] = value
        this.i++; // [
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
        if (ident && this.src[this.i] === "=" && this.src[this.i + 1] !== "=") {
          this.i++; // =
          key = ident;
        } else {
          this.i = save; // rewind: it's a positional value
        }
      }
      this.skip();
      const value = this.parseValue();
      entries.push({ key, value });
      this.skip();
      if (this.src[this.i] === "," || this.src[this.i] === ";") {
        this.i++;
        this.skip();
      }
    }
    this.expect("}");

    const allPositional = entries.every((e) => e.key === null);
    if (allPositional) return entries.map((e) => e.value);
    const obj: Record<string, LuaValue> = {};
    let idx = 1;
    for (const e of entries) {
      if (e.key === null) obj[String(idx++)] = e.value;
      else obj[e.key] = e.value;
    }
    return obj;
  }

  private parseString(quote: string): string {
    this.i++; // opening quote
    let out = "";
    while (this.i < this.src.length) {
      const c = this.src[this.i++];
      if (c === "\\") {
        const n = this.src[this.i++];
        switch (n) {
          case "n": out += "\n"; break;
          case "t": out += "\t"; break;
          case "r": out += "\r"; break;
          case '"': out += '"'; break;
          case "'": out += "'"; break;
          case "\\": out += "\\"; break;
          default: out += n; break;
        }
      } else if (c === quote) {
        return out;
      } else {
        out += c;
      }
    }
    throw new Error("Unterminated string");
  }

  private parseLongString(): string {
    // [[ ... ]] or [=[ ... ]=]
    this.expect("[");
    let eq = "";
    while (this.src[this.i] === "=") { eq += "="; this.i++; }
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
    while (this.i < this.src.length && !/[\s,;}\]]/.test(this.src[this.i])) this.i++;
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
    while (this.i < this.src.length && /[A-Za-z0-9_]/.test(this.src[this.i])) this.i++;
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
      while (this.i < this.src.length && /\s/.test(this.src[this.i])) this.i++;
      if (this.src[this.i] === "-" && this.src[this.i + 1] === "-") {
        this.i += 2;
        if (this.src[this.i] === "[" && this.src[this.i + 1] === "[") {
          const end = this.src.indexOf("]]", this.i);
          this.i = end === -1 ? this.src.length : end + 2;
        } else {
          while (this.i < this.src.length && this.src[this.i] !== "\n") this.i++;
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
