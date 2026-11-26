import { Readable } from "node:stream";
import { expect, it } from "vitest";
import { measureStream } from "./solution";

function chunked(buf: Buffer, size: number): Readable {
  const chunks: Buffer[] = [];
  for (let i = 0; i < buf.length; i += size) chunks.push(buf.subarray(i, i + size));
  return Readable.from(chunks, { objectMode: false });
}

it("empty stream gives zero bytes and zero lines", async () => {
  expect(await measureStream(Readable.from([], { objectMode: false }))).toEqual({ bytes: 0, lines: 0 });
  expect(await measureStream(Readable.from([Buffer.alloc(0)], { objectMode: false }))).toEqual({ bytes: 0, lines: 0 });
});

it("counts lines with and without a trailing newline", async () => {
  expect(await measureStream(chunked(Buffer.from("a\nb\n"), 100))).toEqual({ bytes: 4, lines: 2 });
  expect(await measureStream(chunked(Buffer.from("a\nb"), 100))).toEqual({ bytes: 3, lines: 2 });
  expect(await measureStream(chunked(Buffer.from("single"), 100))).toEqual({ bytes: 6, lines: 1 });
  expect(await measureStream(chunked(Buffer.from("x\n"), 100))).toEqual({ bytes: 2, lines: 1 });
});

it("is independent of how chunks are split", async () => {
  const text = "first line\nsecond\n\nfourth line here\nlast";
  const buf = Buffer.from(text, "utf8");
  for (const size of [1, 2, 3, 5, 7, 64]) {
    expect(await measureStream(chunked(buf, size))).toEqual({ bytes: buf.length, lines: 5 });
  }
  const withTrailing = Buffer.from(text + "\n", "utf8");
  for (const size of [1, 4, 9]) {
    expect(await measureStream(chunked(withTrailing, size))).toEqual({ bytes: withTrailing.length, lines: 5 });
  }
});

it("counts bytes, not characters, for multi-byte UTF-8", async () => {
  const text = "héllo 😀\n世界 𝒳\n";
  const buf = Buffer.from(text, "utf8");
  expect(buf.length).toBeGreaterThan(text.length);
  for (const size of [1, 2, 3, 100]) {
    expect(await measureStream(chunked(buf, size))).toEqual({ bytes: buf.length, lines: 2 });
  }
});

it("handles a large multi-chunk stream", async () => {
  const line = Buffer.from("0123456789abcdef é\n", "utf8");
  async function* gen(): AsyncGenerator<Buffer> {
    for (let i = 0; i < 20000; i++) yield line;
  }
  const out = await measureStream(Readable.from(gen(), { objectMode: false }));
  expect(out).toEqual({ bytes: line.length * 20000, lines: 20000 });
});
