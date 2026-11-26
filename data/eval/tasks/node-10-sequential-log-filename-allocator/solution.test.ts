import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { nextLogFilePath } from "./solution";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "logs-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));
const touch = (...names: string[]) => names.forEach((n) => writeFileSync(join(dir, n), ""));

it("returns .1.log when no logs exist for the date", async () => {
  const p = await nextLogFilePath(dir, "2026-05-01");
  expect(basename(p)).toBe("app-2026-05-01.1.log");
});

it("increments past the highest existing sequence", async () => {
  touch("app-2026-05-01.1.log", "app-2026-05-01.2.log");
  expect(basename(await nextLogFilePath(dir, "2026-05-01"))).toBe("app-2026-05-01.3.log");
});

it("uses the numeric maximum, not the lexicographic one", async () => {
  touch("app-2026-05-01.9.log", "app-2026-05-01.10.log", "app-2026-05-01.2.log");
  expect(basename(await nextLogFilePath(dir, "2026-05-01"))).toBe("app-2026-05-01.11.log");
});

it("uses the highest number even when there are gaps", async () => {
  touch("app-2026-05-01.1.log", "app-2026-05-01.5.log");
  expect(basename(await nextLogFilePath(dir, "2026-05-01"))).toBe("app-2026-05-01.6.log");
});

it("ignores unrelated files and other dates", async () => {
  touch(
    "app-2026-05-02.7.log",
    "app-2026-04-30.40.log",
    "app-2026-05-01.log",
    "app-2026-05-01.99.txt",
    "app-2026-05-01.3.log.gz",
    "other-2026-05-01.50.log",
    "notes.md",
    "app-2026-05-01.1.log",
  );
  expect(basename(await nextLogFilePath(dir, "2026-05-01"))).toBe("app-2026-05-01.2.log");
  expect(basename(await nextLogFilePath(dir, "2026-06-01"))).toBe("app-2026-06-01.1.log");
});
