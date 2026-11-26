const TRUE = new Set(["true", "1", "yes"]);
const FALSE = new Set(["false", "0", "no"]);

export function parseBooleanFlags(query: string): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  const q = query.replace(/^\?+/, "");
  for (const part of q.split("&")) {
    if (part === "") continue;
    const eq = part.indexOf("=");
    const key = eq === -1 ? part : part.slice(0, eq);
    if (key === "") continue;
    if (eq === -1) {
      out[key] = true;
      continue;
    }
    const v = part.slice(eq + 1).toLowerCase();
    if (TRUE.has(v)) out[key] = true;
    else if (FALSE.has(v)) out[key] = false;
  }
  return out;
}
