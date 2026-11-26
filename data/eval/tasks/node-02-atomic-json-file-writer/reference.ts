import { promises as fs } from "node:fs";
import { dirname, basename, join } from "node:path";
import { randomBytes } from "node:crypto";

export async function writeJsonAtomic(filePath: string, data: unknown): Promise<void> {
  const text = JSON.stringify(data, null, 2);
  if (text === undefined) throw new TypeError("data is not JSON-serializable");
  const tmp = join(dirname(filePath), `.${basename(filePath)}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`);
  try {
    await fs.writeFile(tmp, text + "\n", "utf8");
    await fs.rename(tmp, filePath);
  } catch (err) {
    await fs.rm(tmp, { force: true });
    throw err;
  }
}
