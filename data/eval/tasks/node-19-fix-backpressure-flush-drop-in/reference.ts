import { Transform } from "node:stream";
import type { TransformCallback } from "node:stream";

export function createLinePrefixStream(prefix: string): Transform {
  let tail = "";
  return new Transform({
    transform(chunk: Buffer | string, _enc: BufferEncoding, cb: TransformCallback) {
      const parts = (tail + chunk.toString()).split("\n");
      tail = parts.pop() ?? "";
      cb(null, parts.length > 0 ? parts.map((l) => prefix + l + "\n").join("") : undefined);
    },
    flush(cb: TransformCallback) {
      cb(null, tail.length > 0 ? prefix + tail : undefined);
    },
  });
}
