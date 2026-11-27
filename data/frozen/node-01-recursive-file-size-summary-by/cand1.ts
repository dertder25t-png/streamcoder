import { promises as fs, Dirent } from 'node:fs';
import { extname } from 'node:path';

interface Summary {
  [extension: string]: { count: number; bytes: number };
}

export async function summarizeByExtension(dirPath: string): Promise<Summary> {
  const summary: Summary = {};

  async function scanDirectory(path: string) {
    const entries = await fs.readdir(path, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = `${path}/${entry.name}`;
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        await scanDirectory(fullPath);
      } else if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase();
        const bytes = (await fs.stat(fullPath)).size;
        summary[ext] = summary[ext] || { count: 0, bytes: 0 };
        summary[ext].count++;
        summary[ext].bytes += bytes;
      }
    }
  }

  await scanDirectory(dirPath);
  return summary;
}
