import { Readable } from "node:stream";
import { expect, it } from "vitest";
import { streamToBuffer } from "./solution";

it("concatenates all chunks into one Buffer", async () => {
  const s = Readable.from([Buffer.from("hello "), Buffer.from("wor"), Buffer.from("ld")], { objectMode: false });
  const out = await streamToBuffer(s);
  expect(Buffer.isBuffer(out)).toBe(true);
  expect(out.toString("utf8")).toBe("hello world");
});

it("preserves arbitrary binary bytes", async () => {
  const bytes = Buffer.from(Array.from({ length: 1024 }, (_, i) => (i * 7) % 256));
  const chunks: Buffer[] = [];
  for (let i = 0; i < bytes.length; i += 100) chunks.push(bytes.subarray(i, i + 100));
  const out = await streamToBuffer(Readable.from(chunks, { objectMode: false }));
  expect(out.equals(bytes)).toBe(true);
});

it("resolves to an empty Buffer for an empty stream", async () => {
  const out = await streamToBuffer(Readable.from([], { objectMode: false }));
  expect(Buffer.isBuffer(out)).toBe(true);
  expect(out.length).toBe(0);
});

it("collects a large multi-chunk stream completely", async () => {
  const chunk = Buffer.alloc(65536, 7);
  const out = await streamToBuffer(Readable.from(Array.from({ length: 50 }, () => chunk), { objectMode: false }));
  expect(out.length).toBe(65536 * 50);
});
