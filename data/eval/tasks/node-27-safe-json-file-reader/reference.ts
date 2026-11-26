import { readFile } from "node:fs/promises";

export async function readJsonSafe<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const text = await readFile(filePath, "utf8");
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}
