import { createHash, randomBytes } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, expect, it, vi } from "vitest";
import * as fs from "node:fs";
import { hashFileStream } from "./solution";

const dir = mkdtempSync(join(tmpdir(), "hash-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");

it("hashes an empty file", async () => {
  const p = join(dir, "empty");
  writeFileSync(p, "");
  expect(await hashFileStream(p)).toBe(sha(Buffer.alloc(0)));
});

it("hashes a multi-megabyte binary file", async () => {
  const data = randomBytes(5 * 1024 * 1024 + 123);
  const p = join(dir, "big.bin");
  writeFileSync(p, data);
  const digest = await hashFileStream(p);
  expect(digest).toMatch(/^[0-9a-f]{64}$/);
  expect(digest).toBe(sha(data));
});

it("rejects with the filesystem error for missing files", async () => {
  await expect(hashFileStream(join(dir, "nope"))).rejects.toMatchObject({ code: "ENOENT" });
});

it("does not read the whole file into memory at once", async () => {
  const p = join(dir, "mid.bin");
  writeFileSync(p, randomBytes(1024 * 1024));
  const readFile = vi.spyOn(fs.promises, "readFile");
  await hashFileStream(p);
  expect(readFile).not.toHaveBeenCalled();
  readFile.mockRestore();
});
