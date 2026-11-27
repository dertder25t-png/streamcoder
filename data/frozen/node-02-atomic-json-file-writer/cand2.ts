import { promises as fs } from 'node:fs';
import { join } from 'node:path';

async function writeJsonAtomic(filePath: string, data: unknown): Promise<void> {
  const dir = join(filePath, '..');
  const fileName = join(dir, '.temp', Date.now().toString(36) + Math.random().toString(36).substr(2, 5));
  const tempFilePath = join(dir, fileName);

  try {
    await fs.mkdir(join(dir, '.temp'), { recursive: true });
    const json = JSON.stringify(data, null, 2) + '\n';
    await fs.writeFile(tempFilePath, json, 'utf8');
    await fs.rename(tempFilePath, filePath);
  } catch (error) {
    // If an error occurs, remove the temp file and rethrow the error
    if (fs.unlink) {
      await fs.unlink(tempFilePath).catch(() => { /* ignore error */ });
    }
    throw error;
  }
}

export { writeJsonAtomic };
