import { promises as fsp } from "node:fs";

export interface FileCacheOptions {
  maxBytes: number;
  readFile?: (path: string) => Promise<Buffer>;
}

interface Entry {
  data: Buffer;
  size: number;
  mtimeMs: number;
}

export function createFileCache(options: FileCacheOptions) {
  const doRead = options.readFile ?? ((p: string) => fsp.readFile(p));
  const cache = new Map<string, Entry>(); // insertion order = LRU order
  const inflight = new Map<string, Promise<Buffer>>();
  let total = 0;

  function drop(path: string): void {
    const e = cache.get(path);
    if (e) {
      total -= e.data.length;
      cache.delete(path);
    }
  }

  async function load(path: string): Promise<Buffer> {
    const st = await fsp.stat(path);
    const hit = cache.get(path);
    if (hit && hit.size === st.size && hit.mtimeMs === st.mtimeMs) {
      cache.delete(path);
      cache.set(path, hit);
      return Buffer.from(hit.data);
    }
    drop(path);
    const data = await doRead(path);
    if (data.length <= options.maxBytes) {
      while (total + data.length > options.maxBytes && cache.size > 0) {
        drop(cache.keys().next().value as string);
      }
      cache.set(path, { data, size: st.size, mtimeMs: st.mtimeMs });
      total += data.length;
    }
    return Buffer.from(data);
  }

  return {
    read(path: string): Promise<Buffer> {
      const existing = inflight.get(path);
      if (existing) return existing.then((b) => Buffer.from(b));
      const p = load(path).finally(() => inflight.delete(path));
      inflight.set(path, p);
      return p;
    },
  };
}
