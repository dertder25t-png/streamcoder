import { promises as fs } from "node:fs";

export async function readExistingFiles(paths: readonly string[]): Promise<Map<string, string>> {
  const results = await Promise.allSettled(paths.map((p) => fs.readFile(p, "utf8")));
  const out = new Map<string, string>();
  let firstError: unknown;
  let failed = false;
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      out.set(paths[i], r.value);
    } else if ((r.reason as NodeJS.ErrnoException)?.code !== "ENOENT" && !failed) {
      failed = true;
      firstError = r.reason;
    }
  });
  if (failed) throw firstError;
  return out;
}
