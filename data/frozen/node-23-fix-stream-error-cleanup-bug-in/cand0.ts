import { createGzip } from "node:zlib";
import { createReadStream, createWriteStream, promises as fs } from "node:fs";

export async function compressFileSafe(
  srcPath: string,
  destPath: string,
  options: { signal?: AbortSignal } = {},
): Promise<void> {
  let out: fs.WriteStream | null = null;
  try {
    out = createWriteStream(destPath);
    const src = createReadStream(srcPath);
    const gzip = createGzip();
    src.on("error", (err) => {
      reject(err);
    });
    out.on("error", (err) => {
      reject(err);
    });
    out.on("finish", () => {
      resolve();
    });
    options.signal?.addEventListener("abort", () => {
      if (out) {
        out.destroy();
      }
      reject(new Error("aborted"));
    });
    src.pipe(gzip).pipe(out);
  } catch (err) {
    if (out) {
      await fs.unlink(destPath);
    }
    throw err;
  }
}
