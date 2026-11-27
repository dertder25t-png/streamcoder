import { promises as fs } from 'node:fs';
import { join, extname } from 'node:path';

interface Summary {
  [extension: string]: { count: number; bytes: number };
}

async function summarizeByExtension(dirPath: string): Promise<Summary> {
  const summary: Summary = {};

  async function scanDirectory(path: string) {
    try {
      const entries = await fs.readdir(path, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(path, entry.name);
        if (entry.isDirectory()) {
          await scanDirectory(fullPath);
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
    } catch (error) {
      if (error.code !== 'ENOENT' && error.code !== 'EISDIR') {
        throw error;
      }
    }
  }

  await scanDirectory(dirPath);
  return summary;
}

export { summarizeByExtension };
