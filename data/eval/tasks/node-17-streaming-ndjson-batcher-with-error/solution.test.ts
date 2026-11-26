import type { Transform } from "node:stream";
import { expect, it } from "vitest";
import { createNdjsonBatchStream } from "./solution";

const noop = (_raw: string, _n: number): void => {};
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function collect(stream: Transform): { batches: unknown[][]; done: Promise<void> } {
  const batches: unknown[][] = [];
  const done = new Promise<void>((resolve, reject) => {
    stream.on("data", (b: unknown[]) => batches.push(b));
    stream.on("end", () => resolve());
    stream.on("error", reject);
  });
  return { batches, done };
}

function split(buf: Buffer, size: number): Buffer[] {
  const out: Buffer[] = [];
  for (let i = 0; i < buf.length; i += size) out.push(buf.subarray(i, i + size));
  return out;
}

async function run(chunks: Buffer[], maxBatchSize: number, onInvalidLine: (raw: string, n: number) => void = noop) {
  const stream = createNdjsonBatchStream({ maxBatchSize, onInvalidLine });
  const { batches, done } = collect(stream);
  for (const c of chunks) stream.write(c);
  stream.end();
  await done;
  return batches;
}

it("batches parsed values and flushes the partial batch at the end", async () => {
  const text = [1, 2, 3, 4, 5].map((n) => JSON.stringify({ n })).join("\n") + "\n";
  expect(await run([Buffer.from(text)], 2)).toEqual([[{ n: 1 }, { n: 2 }], [{ n: 3 }, { n: 4 }], [{ n: 5 }]]);
});

it("flushes a final line that lacks a trailing newline", async () => {
  expect(await run([Buffer.from('{"a":1}\n{"a":2}\n{"a":3}')], 10)).toEqual([[{ a: 1 }, { a: 2 }, { a: 3 }]]);
  expect(await run([Buffer.from('{"a":1}\n{"a":2}\n{"a":3}')], 2)).toEqual([[{ a: 1 }, { a: 2 }], [{ a: 3 }]]);
});

it("emits nothing for empty input", async () => {
  expect(await run([], 3)).toEqual([]);
  expect(await run([Buffer.from("\n\n")], 3)).toEqual([]);
});

it("emits full batches as soon as they fill, before the stream ends", async () => {
  const stream = createNdjsonBatchStream({ maxBatchSize: 2, onInvalidLine: noop });
  const { batches, done } = collect(stream);
  stream.write(Buffer.from('{"a":1}\n{"a":2}\n{"a":3}\n'));
  await sleep(30);
  expect(batches).toEqual([[{ a: 1 }, { a: 2 }]]);
  stream.end();
  await done;
  expect(batches).toEqual([[{ a: 1 }, { a: 2 }], [{ a: 3 }]]);
});

it("handles multi-byte UTF-8 split at every byte boundary, with \\n and \\r\\n endings", async () => {
  const values = [{ s: "héllo 😀" }, { s: "世界" }, { s: "𝒳 end" }];
  const text = JSON.stringify(values[0]) + "\r\n" + JSON.stringify(values[1]) + "\n" + JSON.stringify(values[2]) + "\r\n";
  const buf = Buffer.from(text, "utf8");
  for (const size of [1, 2, 3, 5]) {
    expect(await run(split(buf, size), 2)).toEqual([[values[0], values[1]], [values[2]]]);
  }
});

it("reports invalid lines with 1-based line numbers and keeps going; ignores blank lines", async () => {
  const text = '{"a":1}\n{bad\n{"a":3}\nnope\n\n{"a":6}\n';
  const invalid: Array<[string, number]> = [];
  const out = await run(split(Buffer.from(text), 4), 10, (raw: string, n: number) => {
    invalid.push([raw, n]);
  });
  expect(out).toEqual([[{ a: 1 }, { a: 3 }, { a: 6 }]]);
  expect(invalid).toEqual([["{bad", 2], ["nope", 4]]);
});

it("reports an invalid final line without trailing newline", async () => {
  const invalid: Array<[string, number]> = [];
  const out = await run([Buffer.from('{"a":1}\n{oops')], 5, (raw: string, n: number) => {
    invalid.push([raw, n]);
  });
  expect(out).toEqual([[{ a: 1 }]]);
  expect(invalid).toEqual([["{oops", 2]]);
});

it("throws RangeError for invalid maxBatchSize", () => {
  for (const bad of [0, -1, 1.5, NaN]) {
    expect(() => createNdjsonBatchStream({ maxBatchSize: bad, onInvalidLine: noop })).toThrow(RangeError);
  }
});
