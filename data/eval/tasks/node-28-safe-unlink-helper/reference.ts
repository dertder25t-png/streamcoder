import { unlink } from "node:fs/promises";

export async function removeFileSafe(filePath: string): Promise<boolean> {
  try {
    await unlink(filePath);
    return true;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw e;
  }
}
