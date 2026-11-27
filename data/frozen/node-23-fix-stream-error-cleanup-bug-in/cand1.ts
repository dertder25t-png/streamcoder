import { createGzip, createGunzip } from "node:zlib";
import { createReadStream, createWriteStream, existsSync, unlinkSync } from "node:fs";
import { pipeline } from "node:stream/promises";

export async function compressFileSafe(
  srcPath: string,
  destPath: string,
  options: { signal?: AbortSignal } = {},
): Promise<void> {
  if (existsSync(destPath)) {
    throw new Error("Destination file already exists");
  }

  try {
    await pipeline(
      createReadStream(srcPath, { signal: options.signal }),
      createGzip(),
      createWriteStream(destPath)
    );
  } catch (error) {
    if (error.code === "ABORT_ERR") {
      throw new Error("aborted");
    }
    if (existsSync(destPath)) {
      unlinkSync(destPath);
    }
    throw error;
  }
}

export async function decompressFileSafe(
  srcPath: string,
  destPath: string,
  options: { signal?: AbortSignal } = {},
): Promise<void> {
  if (existsSync(destPath)) {
    throw new Error("Destination file already exists");
  }

  try {
    await pipeline(
      createReadStream(srcPath, { signal: options.signal }),
      createGunzip(),
      createWriteStream(destPath)
    );
  } catch (error) {
    if (error.code === "ABORT_ERR") {
      throw new Error("aborted");
    }
    if (existsSync(destPath)) {
      unlinkSync(destPath);
    }
    throw error;
  }
}
