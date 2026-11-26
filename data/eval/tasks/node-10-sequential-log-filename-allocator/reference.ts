import { promises as fs } from "node:fs";
import { join } from "node:path";

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function nextLogFilePath(dirPath: string, dateStr: string): Promise<string> {
  const names = await fs.readdir(dirPath);
  const re = new RegExp(`^app-${escapeRe(dateStr)}\\.(\\d+)\\.log$`);
  let max = 0;
  for (const name of names) {
    const m = re.exec(name);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return join(dirPath, `app-${dateStr}.${max + 1}.log`);
}
