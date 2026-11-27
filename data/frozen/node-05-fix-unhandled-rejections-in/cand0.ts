import { promises as fs } from "node:fs";

export async function readExistingFiles(paths: readonly string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  await Promise.all(
    paths.map(async (p) => {
      try {
        out.set(p, await fs.readFile(p, "utf8"));
      } catch (err) {
        if (err.code === "ENOENT") {
          // ignore ENOENT errors
        } else {
          throw err;
        }
      }
    }),
  );
  return out;
}
