import { promises as fs } from 'node:fs';
import { basename, extname, isAbsolute, join } from 'node:path';

interface Summary {
  [ext: string]: { count: number; bytes: number };
}

async function summarizeByExtension(dirPath: string): Promise<Summary> {
  if (!isAbsolute(dirPath)) {
    throw new Error('Path must be absolute');
  }

  const summary: Summary = {};

  async function traverse(path: string) {
    try {
      const entries = await fs.readdir(path, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(path, entry.name);
        if (entry.isDirectory()) {
          await traverse(fullPath);
        } else if (entry.isFile()) {
          const fileExt = extname(fullPath).toLowerCase();
          const fileStat = await fs.stat(fullPath);
          if (fileExt === '') {
            fileExt = '(no-ext)';
          }
          if (!summary[fileExt]) {
            summary[fileExt] = { count: 0, bytes: 0 };
          }
          summary[fileExt].count++;
          summary[fileExt].bytes += fileStat.size;
        }
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
    }
  }

  await traverse(dirPath);
  return summary;
}

export { summarizeByExtension };
