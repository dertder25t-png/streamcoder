import type { Readable } from "node:stream";

export function measureStream(readable: Readable): Promise<{ bytes: number; lines: number }> {
  return new Promise((resolve, reject) => {
    let bytes = 0;
    let newlines = 0;
    let lastByte = -1;
    readable.on("data", (chunk: Buffer | string) => {
      const buf = typeof chunk === "string" ? Buffer.from(chunk, "utf8") : chunk;
      bytes += buf.length;
      for (let i = 0; i < buf.length; i++) if (buf[i] === 0x0a) newlines++;
      if (buf.length > 0) lastByte = buf[buf.length - 1];
    });
    readable.on("end", () => resolve({ bytes, lines: newlines + (bytes > 0 && lastByte !== 0x0a ? 1 : 0) }));
    readable.on("error", reject);
  });
}
