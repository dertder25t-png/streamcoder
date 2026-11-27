import * as fs from 'node:fs/promises';

export async function readJsonSafe<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return fallback;
    } else if (error instanceof SyntaxError) {
      return fallback;
    } else {
      throw error;
    }
  }
}
