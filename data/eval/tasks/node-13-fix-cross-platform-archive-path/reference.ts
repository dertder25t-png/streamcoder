export function normalizeArchivePaths(rawPaths: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of rawPaths) {
    let p = raw.replace(/\\/g, "/");
    if (/^[A-Za-z]:/.test(p)) throw new Error(`drive prefix not allowed: ${raw}`);
    p = p.replace(/\/+/g, "/");
    while (p.startsWith("./") || p.startsWith("/")) p = p.replace(/^\.?\//, "");
    if (p.split("/").includes("..")) throw new Error(`path traversal not allowed: ${raw}`);
    if (!seen.has(p)) {
      seen.add(p);
      out.push(p);
    }
  }
  return out;
}
