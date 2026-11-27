import { promises as fs } from 'node:fs';
import { join } from 'node:path';

async function nextLogFilePath(dirPath: string, dateStr: string): Promise<string> {
  const logPattern = new RegExp(`app-${dateStr}\\.(\\d+)\\.log$`);
  let maxSeq = 0;

  try {
    const files = await fs.readdir(dirPath);
    for (const file of files) {
      const match = file.match(logPattern);
      if (match) {
        const seq = parseInt(match[1], 10);
        if (!isNaN(seq) && seq > maxSeq) {
          maxSeq = seq;
        }
      }
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw err;
    }
  }

  return join(dirPath, `app-${dateStr}.${maxSeq + 1}.log`);
}

export { nextLogFilePath };
