export type EsoRun = { text: string; color: string | null };

/**
 * Turn an in-game tooltip into colored runs.
 * GetAbilityDescription keeps ZOS markup (`|cRRGGBB` … `|r`, `|t` icons, `|H` links).
 * Numbers already resolved by the addon stay as written — this never fills `<<1>>`.
 */
export function parseEsoMarkup(input: string): EsoRun[] {
  const src = input.replace(/\^[nNmMfFpPgG]/g, "");
  const out: EsoRun[] = [];
  const stack: (string | null)[] = [null];
  let buf = "";

  const flush = () => {
    if (!buf) return;
    out.push({ text: buf, color: stack[stack.length - 1] ?? null });
    buf = "";
  };

  for (let i = 0; i < src.length; i++) {
    if (src[i] !== "|") {
      buf += src[i];
      continue;
    }
    const next = src[i + 1] ?? "";
    if (next === "|") {
      buf += "|";
      i += 1;
      continue;
    }
    if (next === "c" || next === "C") {
      const hex = src.slice(i + 2, i + 8);
      if (/^[0-9A-Fa-f]{6}$/.test(hex)) {
        flush();
        stack.push(`#${hex}`);
        i += 7;
        continue;
      }
    }
    if (next === "r" || next === "R") {
      flush();
      if (stack.length > 1) stack.pop();
      i += 1;
      continue;
    }
    if (next === "t" || next === "T") {
      const end = src.indexOf("|t", i + 2);
      if (end !== -1) {
        flush();
        i = end + 1;
        continue;
      }
    }
    if (next === "u" || next === "U") {
      const end = src.indexOf("|u", i + 2);
      if (end !== -1) {
        flush();
        const inner = src.slice(i + 2, end);
        const visible = inner.split(":").pop() ?? "";
        buf += visible;
        i = end + 1;
        continue;
      }
    }
    if (next === "h" || next === "H") {
      const openEnd = src.indexOf("|h", i + 2);
      const close = openEnd === -1 ? -1 : src.indexOf("|h", openEnd + 2);
      if (openEnd !== -1 && close !== -1) {
        flush();
        buf += src.slice(openEnd + 2, close);
        i = close + 1;
        continue;
      }
    }
    buf += "|";
  }
  flush();
  return out;
}
