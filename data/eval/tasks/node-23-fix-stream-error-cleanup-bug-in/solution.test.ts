import { randomBytes } from "node:crypto";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { afterEach, beforeEach, expect, it } from "vitest";
import { compressFileSafe } from "./solution";

let dir = "";
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "gz-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const files = async () => (await readdir(dir)).sort();

it("compresses to valid gzip that round-trips byte-for-byte", async () => {
  const data = Buffer.concat([randomBytes(50_000), Buffer.from("hello world ".repeat(5000))]);
  const src = join(dir, "in.bin");
  const dest = join(dir, "out.gz");
  await writeFile(src, data);
  await compressFileSafe(src, dest);
  expect(gunzipSync(await readFile(dest)).equals(data)).toBe(true);
  expect(await files()).toEqual(["in.bin", "out.gz"]);
});

it("rejects when the source is missing and leaves no file at destPath", async () => {
  const dest = join(dir, "out.gz");
  const err = await compressFileSafe(join(dir, "missing.bin"), dest).then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeTruthy();
  expect((err as NodeJS.ErrnoException).code).toBe("ENOENT");
  expect(await files()).toEqual([]);
});

it("does not clobber an existing destPath when the source is missing", async () => {
  const dest = join(dir, "out.gz");
  await writeFile(dest, "ORIGINAL");
  await expect(compressFileSafe(join(dir, "missing.bin"), dest)).rejects.toBeTruthy();
  expect(await readFile(dest, "utf8")).toBe("ORIGINAL");
});

it("rejects when the destination cannot be written and leaves nothing behind", async () => {
  const src = join(dir, "in.bin");
  await writeFile(src, "data");
  await expect(compressFileSafe(src, join(dir, "no-such-dir", "out.gz"))).rejects.toBeTruthy();
  expect(await files()).toEqual(["in.bin"]);
});

it("rejects on an already-aborted signal and leaves no destination file", async () => {
  const src = join(dir, "in.bin");
  await writeFile(src, "data".repeat(1000));
  const ac = new AbortController();
  ac.abort();
  await expect(compressFileSafe(src, join(dir, "out.gz"), { signal: ac.signal })).rejects.toBeTruthy();
  expect(await files()).toEqual(["in.bin"]);
});

it("aborting mid-flight rejects and removes the partial file", async () => {
  const src = join(dir, "big.bin");
  await writeFile(src, randomBytes(48 * 1024 * 1024));
  const ac = new AbortController();
  const p = compressFileSafe(src, join(dir, "out.gz"), { signal: ac.signal });
  setTimeout(() => ac.abort(), 5);
  await expect(p).rejects.toBeTruthy();
  await new Promise((r) => setTimeout(r, 50));
  expect(await files()).toEqual(["big.bin"]);
}, 15000);

it("aborting mid-flight never overwrites a pre-existing destination", async () => {
  const src = join(dir, "big.bin");
  const dest = join(dir, "out.gz");
  await writeFile(src, randomBytes(48 * 1024 * 1024));
  await writeFile(dest, "ORIGINAL");
  const ac = new AbortController();
  const p = compressFileSafe(src, dest, { signal: ac.signal });
  setTimeout(() => ac.abort(), 5);
  await expect(p).rejects.toBeTruthy();
  await new Promise((r) => setTimeout(r, 50));
  expect(await readFile(dest, "utf8")).toBe("ORIGINAL");
}, 15000);
