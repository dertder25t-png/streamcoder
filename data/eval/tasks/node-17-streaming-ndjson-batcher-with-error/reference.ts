import { Transform } from "node:stream";
import { StringDecoder } from "node:string_decoder";

export function createNdjsonBatchStream(options: {
  maxBatchSize: number;
  onInvalidLine?: (rawLine: string, lineNumber: number) => void;
}): Transform {
  const { maxBatchSize, onInvalidLine } = options;
  if (!Number.isInteger(maxBatchSize) || maxBatchSize < 1) {
    throw new RangeError("maxBatchSize must be a positive integer");
  }
  const decoder = new StringDecoder("utf8");
  let pending = "";
  let lineNumber = 0;
  let batch: unknown[] = [];

  const handleLine = (stream: Transform, raw: string) => {
    lineNumber++;
    const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
    if (line.trim() === "") return;
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      onInvalidLine?.(line, lineNumber);
      return;
    }
    batch.push(value);
    if (batch.length >= maxBatchSize) {
      const out = batch;
      batch = [];
      stream.push(out);
    }
  };

  return new Transform({
    readableObjectMode: true,
    transform(chunk: Buffer | string, _enc, cb) {
      pending += typeof chunk === "string" ? chunk : decoder.write(chunk);
      let idx: number;
      while ((idx = pending.indexOf("\n")) >= 0) {
        const raw = pending.slice(0, idx);
        pending = pending.slice(idx + 1);
        handleLine(this, raw);
      }
      cb();
    },
    flush(cb) {
      pending += decoder.end();
      if (pending.length > 0) handleLine(this, pending);
      pending = "";
      if (batch.length > 0) this.push(batch);
      batch = [];
      cb();
    },
  });
}
