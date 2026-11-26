import { promises as fsp } from "node:fs";
import { mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { createFileCache } from "./solution";

let dir = "";
let reads: string[] = [];
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "fc-"));
  reads = [];
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const countingRead = async (p: string): Promise<Buffer> => {
  reads.push(p);
  await new Promise((r) => setTimeout(r, 20));
  return fsp.readFile(p);
};
const mk = (maxBytes: number) => createFileCache({ maxBytes, readFile: countingRead });
const write = async (name: string, content: string): Promise<string> => {
  const p = join(dir, name);
  await writeFile(p, content);
  return p;
};
const readsOf = (p: string) => reads.filter((x) => x === p).length;

it("returns file contents and serves repeats from cache", async () => {
  const p = await write("a.txt", "hello");
  const c = mk(1000);
  expect((await c.read(p)).toString()).toBe("hello");
  expect((await c.read(p)).toString()).toBe("hello");
  expect(readsOf(p)).toBe(1);
});

it("coalesces concurrent cold reads into one disk read", async () => {
  const p = await write("a.txt", "hello");
  const c = mk(1000);
  const results = await Promise.all([c.read(p), c.read(p), c.read(p), c.read(p)]);
  expect(results.map((b) => b.toString())).toEqual(["hello", "hello", "hello", "hello"]);
  expect(readsOf(p)).toBe(1);
});

it("mutating a returned buffer does not corrupt later reads", async () => {
  const p = await write("a.txt", "hello");
  const c = mk(1000);
  const [x] = await Promise.all([c.read(p), c.read(p)]);
  x.fill(0x7a);
  expect((await c.read(p)).toString()).toBe("hello");
});

it("reloads when mtimeMs changes even if size is the same", async () => {
  const p = await write("a.txt", "aaaa");
  const c = mk(1000);
  await utimes(p, new Date(1_600_000_000_000), new Date(1_600_000_000_000));
  expect((await c.read(p)).toString()).toBe("aaaa");
  await writeFile(p, "bbbb");
  await utimes(p, new Date(1_700_000_000_000), new Date(1_700_000_000_000));
  expect((await c.read(p)).toString()).toBe("bbbb");
  expect(readsOf(p)).toBe(2);
});

it("reloads when size changes even if mtimeMs is the same", async () => {
  const p = await write("a.txt", "aaaa");
  const c = mk(1000);
  const t = new Date(1_600_000_000_000);
  await utimes(p, t, t);
  expect((await c.read(p)).toString()).toBe("aaaa");
  await writeFile(p, "aaaaaa");
  await utimes(p, t, t);
  expect((await c.read(p)).toString()).toBe("aaaaaa");
  expect(readsOf(p)).toBe(2);
});

it("evicts least-recently-used entries to stay within maxBytes", async () => {
  const a = await write("a", "1111");
  const b = await write("b", "2222");
  const cc = await write("c", "3333");
  const c = mk(10);
  await c.read(a);
  await c.read(b);
  await c.read(a); // a is now most recently used
  await c.read(cc); // 12 bytes > 10 -> evict b (LRU)
  expect(reads).toEqual([a, b, cc]);
  await c.read(a);
  await c.read(cc);
  expect(reads).toEqual([a, b, cc]); // both still cached
  await c.read(b);
  expect(readsOf(b)).toBe(2); // b was evicted
});

it("files larger than maxBytes bypass the cache without evicting others", async () => {
  const a = await write("a", "1111");
  const big = await write("big", "x".repeat(50));
  const c = mk(10);
  await c.read(a);
  expect((await c.read(big)).length).toBe(50);
  await c.read(big);
  expect(readsOf(big)).toBe(2); // never cached
  await c.read(a);
  expect(readsOf(a)).toBe(1); // a survived
});
