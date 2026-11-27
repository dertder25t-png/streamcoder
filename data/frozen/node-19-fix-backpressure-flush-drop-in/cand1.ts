import { Transform } from "node:stream";

export function createLinePrefixStream(prefix: string): Transform {
  let tail = "";
  let buffer = "";

  return new Transform({
    transform(chunk: Buffer, _enc, cb) {
      buffer += tail + chunk.toString("utf8");
      const lines = buffer.split("\n");
      tail = lines.pop() ?? "";
      for (const line of lines) this.push(prefix + line + "\n");
      cb();
    },
    flush(cb) {
      if (tail) this.push(prefix + tail);
      cb();
    },
  });
}
