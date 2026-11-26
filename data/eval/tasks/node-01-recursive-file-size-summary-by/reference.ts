import { promises as fs } from "node:fs";
import { join, extname } from "node:path";

export type ExtStats = { count: number; bytes: number };

export async function summarizeByExtension(dirPath: string): Promise<Record<string, ExtStats>> {
  const out: Record<string, ExtStats> = {};
  async function walk(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) {
        await walk(p);
      } else if (e.isFile()) {
        const ext = extname(e.name).toLowerCase() || "(no-ext)";
        const st = await fs.stat(p);
        const cur = (out[ext] ??= { count: 0, bytes: 0 });
        cur.count++;
        cur.bytes += st.size;
      }
    }
  }
  await walk(dirPath);
  return out;
}
