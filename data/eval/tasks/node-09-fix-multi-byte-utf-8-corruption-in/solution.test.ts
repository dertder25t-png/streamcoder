import { Readable } from "node:stream";
import { expect, it } from "vitest";
import { readUtf8Stream } from "./solution";

function byteStream(buf: Buffer, size: number): Readable {
  const chunks: Buffer[] = [];
  for (let i = 0; i < buf.length; i += size) chunks.push(buf.subarray(i, i + size));
  return Readable.from(chunks, { objectMode: false });
}

it("reconstructs 4-byte emoji and CJK split across 1-byte chunks", async () => {
  const text = "héllo 😀 世界 𝒳 end 🚀";
  const out = await readUtf8Stream(byteStream(Buffer.from(text, "utf8"), 1));
  expect(out).toBe(text);
  expect(out).not.toContain("�");
});

it("handles other chunk sizes and a larger payload", async () => {
  const text = "😀世界é".repeat(2000);
  for (const size of [2, 3, 5, 7]) {
    expect(await readUtf8Stream(byteStream(Buffer.from(text, "utf8"), size))).toBe(text);
  }
});

it("resolves to an empty string for an empty stream", async () => {
  expect(await readUtf8Stream(Readable.from([], { objectMode: false }))).toBe("");
  expect(await readUtf8Stream(Readable.from([Buffer.alloc(0)], { objectMode: false }))).toBe("");
});

it("rejects when the stream emits an error", async () => {
  const boom = new Error("boom");
  const stream = new Readable({
    read() {
      this.push(Buffer.from("partial"));
      this.destroy(boom);
    },
  });
  await expect(readUtf8Stream(stream)).rejects.toBe(boom);
});

it("rejects immediately on error without waiting for more data", async () => {
  const boom = new Error("early");
  const stream = new Readable({ read() {} });
  const p = readUtf8Stream(stream);
  stream.push(Buffer.from("abc"));
  setImmediate(() => stream.destroy(boom));
  await expect(p).rejects.toBe(boom);
});
