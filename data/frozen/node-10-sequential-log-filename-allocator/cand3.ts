import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';

export async function nextLogFilePath(dirPath: string, dateStr: string): Promise<string> {
  const prefix = `app-${dateStr}.`;
  const regex = new RegExp(`^${prefix}(\\d+)\\.log$`);
  let maxSequence = -1;

  try {
    const files = await fs.readdir(dirPath);
    for (const file of files) {
      const match = file.match(regex);
      if (match) {
        const sequence = parseInt(match[1], 10);
        if (sequence > maxSequence) {
          maxSequence = sequence;
        }
      }
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw err;
    }
  }

  const nextSequence = maxSequence + 1;
  return resolve(dirPath, `${prefix}${nextSequence}.log`);
}
