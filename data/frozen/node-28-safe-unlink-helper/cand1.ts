import { promises as fsPromises } from 'node:fs';

export async function removeFileSafe(filePath: string): Promise<boolean> {
  try {
    await fsPromises.unlink(filePath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}
