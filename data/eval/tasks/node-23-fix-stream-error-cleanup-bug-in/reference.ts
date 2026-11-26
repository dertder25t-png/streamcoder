import { createReadStream, createWriteStream } from "node:fs";
import { rename, rm } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";

export async function compressFileSafe(
  srcPath: string,
  destPath: string,
  options: { signal?: AbortSignal } = {},
): Promise<void> {
  const tmp = `${destPath}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  try {
    await pipeline(createReadStream(srcPath), createGzip(), createWriteStream(tmp), {
      signal: options.signal,
    });
    await rename(tmp, destPath);
  } catch (err) {
    await rm(tmp, { force: true });
    throw err;
  }
}
