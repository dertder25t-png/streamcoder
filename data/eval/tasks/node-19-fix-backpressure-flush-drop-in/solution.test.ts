import { Readable, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { expect, it } from "vitest";
import { createLinePrefixStream } from "./solution";

async function viaWrites(chunks: string[], prefix = "> "): Promise<string> {
  const t = createLinePrefixStream(prefix);
  const parts: Buffer[] = [];
  const done = new Promise<void>((resolve, reject) => {
    t.on("data", (d: Buffer | string) => parts.push(Buffer.from(d)));
    t.on("end", () => resolve());
    t.on("error", reject);
  });
  for (const c of chunks) t.write(c);
  t.end();
  await done;
  return Buffer.concat(parts).toString("utf8");
}

function lines(out: string): string[] {
  const l = out.split("\n");
  if (l[l.length - 1] === "") l.pop();
  return l;
}

it("prefixes each line once when chunks align with lines", async () => {
  expect(lines(await viaWrites(["one\n", "two\n", "three\n"]))).toEqual(["> one", "> two", "> three"]);
});

it("prefixes once when lines span multiple small chunks", async () => {
  expect(lines(await viaWrites(["he", "llo wor", "ld\nsec", "ond\nthi", "rd\n"]))).toEqual(["> hello world", "> second", "> third"]);
  const text = "alpha\nbeta\ngamma\n";
  expect(lines(await viaWrites(text.split("")))).toEqual(["> alpha", "> beta", "> gamma"]);
});

it("handles many lines in one chunk, including empty lines", async () => {
  expect(lines(await viaWrites(["a\n\nb\nc\n"]))).toEqual(["> a", "> ", "> b", "> c"]);
});

it("flushes a final line without trailing newline", async () => {
  expect(lines(await viaWrites(["a\nb"]))).toEqual(["> a", "> b"]);
  expect(lines(await viaWrites(["only"]))).toEqual(["> only"]);
  expect(lines(await viaWrites(["x\ny", "z"]))).toEqual(["> x", "> yz"]);
});

it("emits nothing for empty input and no extra prefix after a trailing newline", async () => {
  expect(await viaWrites([])).toBe("");
  expect(await viaWrites([""])).toBe("");
  expect(lines(await viaWrites(["a\n"]))).toEqual(["> a"]);
});

it("works through stream.pipeline into a slow writable with a tiny highWaterMark", async () => {
  const input: string[] = [];
  const expected: string[] = [];
  for (let i = 0; i < 400; i++) {
    input.push(`line number ${i}`);
    expected.push(`# line number ${i}`);
  }
  const text = input.join("\n");
  const chunks: Buffer[] = [];
  for (let i = 0; i < text.length; i += 37) chunks.push(Buffer.from(text.slice(i, i + 37)));
  const received: Buffer[] = [];
  const slow = new Writable({
    highWaterMark: 1,
    write(chunk: Buffer, _enc, cb) {
      received.push(Buffer.from(chunk));
      setImmediate(cb);
    },
  });
  await pipeline(Readable.from(chunks, { objectMode: false }), createLinePrefixStream("# "), slow);
  expect(lines(Buffer.concat(received).toString("utf8"))).toEqual(expected);
});

it("handles one large chunk piped into a slow writable without losing data", async () => {
  const text = Array.from({ length: 3000 }, (_, i) => `row ${i}`).join("\n") + "\n";
  const received: Buffer[] = [];
  const slow = new Writable({
    highWaterMark: 16,
    write(chunk: Buffer, _enc, cb) {
      received.push(Buffer.from(chunk));
      setImmediate(cb);
    },
  });
  await pipeline(Readable.from([Buffer.from(text)], { objectMode: false }), createLinePrefixStream("- "), slow);
  const out = lines(Buffer.concat(received).toString("utf8"));
  expect(out).toHaveLength(3000);
  expect(out[0]).toBe("- row 0");
  expect(out[2999]).toBe("- row 2999");
});
