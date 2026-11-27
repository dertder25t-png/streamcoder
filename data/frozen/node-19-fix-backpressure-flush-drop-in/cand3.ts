import { Transform } from "node:stream";

export function createLinePrefixStream(prefix: string): Transform {
  let tail = "";
  let hasPushed = false;

  return new Transform({
    transform(chunk: Buffer, _enc, cb) {
      const data = (tail + chunk.toString("utf8")).split("\n");
      tail = prefix + (data.pop() ?? "");

      for (const part of data) {
        this.push(prefix + part + "\n");
        hasPushed = true;
      }

      cb();
    },
    final(cb) {
      if (tail !== "") {
        this.push(prefix + tail + "\n");
        hasPushed = true;
      }
      cb();
    },
    flush(cb) {
      if (hasPushed) {
        this.push(null); // Signal end of stream
      }
      cb();
    }
  });
}
