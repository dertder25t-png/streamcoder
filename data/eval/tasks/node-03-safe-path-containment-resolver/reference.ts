import { resolve, relative, isAbsolute, sep } from "node:path";

export function resolveInsideRoot(rootDir: string, userPath: string): string {
  if (userPath.includes("\0") || rootDir.includes("\0")) throw new Error("Invalid path: null byte");
  const root = resolve(rootDir);
  const full = resolve(root, userPath);
  const rel = relative(root, full);
  if (rel === "" ) throw new Error("Path must be strictly inside root");
  if (rel === ".." || rel.startsWith(".." + sep) || isAbsolute(rel)) {
    throw new Error("Path escapes root directory");
  }
  return full;
}
