import { promises as fs } from "node:fs";
import { join } from "node:path";

async function listFiles(root: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  async function walk(dir: string, prefix: string): Promise<void> {
    for (const e of await fs.readdir(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      const full = join(dir, e.name);
      if (e.isDirectory()) await walk(full, rel);
      else if (e.isFile()) out.set(rel, full);
    }
  }
  await walk(root, "");
  return out;
}

export async function compareDirectories(
  dirA: string,
  dirB: string,
): Promise<{ added: string[]; removed: string[]; modified: string[] }> {
  const [a, b] = await Promise.all([listFiles(dirA), listFiles(dirB)]);
  const added: string[] = [];
  const removed: string[] = [];
  const modified: string[] = [];
  for (const [rel, pathB] of b) {
    const pathA = a.get(rel);
    if (pathA === undefined) added.push(rel);
    else {
      const [x, y] = await Promise.all([fs.readFile(pathA), fs.readFile(pathB)]);
      if (!x.equals(y)) modified.push(rel);
    }
  }
  for (const rel of a.keys()) if (!b.has(rel)) removed.push(rel);
  const sort = (xs: string[]) => xs.sort((p, q) => (p < q ? -1 : p > q ? 1 : 0));
  return { added: sort(added), removed: sort(removed), modified: sort(modified) };
}
