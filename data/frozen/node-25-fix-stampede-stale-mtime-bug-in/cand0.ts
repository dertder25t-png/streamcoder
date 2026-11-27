import { promises as fsp } from "node:fs";
import { performance } from "node:perf_hooks";

interface FileCacheEntry {
  data: Buffer;
  mtimeMs: number;
  bytesRead: number;
  lastAccessed: number;
}

export interface FileCacheOptions {
  maxBytes: number;
  readFile?: (path: string) => Promise<Buffer>;
}

export function createFileCache(options: FileCacheOptions) {
  const doRead = options.readFile ?? ((p: string) => fsp.readFile(p));
  const cache = new Map<string, FileCacheEntry>();
  let totalBytes = 0;

  const evictLRU = () => {
    let lruKey: string | null = null;
    let lruTime = performance.now();
    for (const [key, entry] of cache.entries()) {
      if (entry.lastAccessed < lruTime) {
        lruKey = key;
        lruTime = entry.lastAccessed;
      }
    }
    if (lruKey) {
      const entry = cache.get(lruKey)!;
      totalBytes -= entry.bytesRead;
      cache.delete(lruKey);
    }
  };

  const read = async (path: string): Promise<Buffer> => {
    const hit = cache.get(path);
    if (hit) {
      hit.lastAccessed = performance.now();
      return hit.data;
    }

    let data: Buffer;
    try {
      data = await doRead(path);
    } catch (err) {
      throw new Error(`Failed to read file: ${path}`);
    }

    const stats = await fsp.stat(path);
    const mtimeMs = stats.mtimeMs;
    const bytesRead = data.length;

    if (bytesRead > options.maxBytes) {
      return data;
    }

    while (totalBytes + bytesRead > options.maxBytes) {
      evictLRU();
    }

    cache.set(path, { data, mtimeMs, bytesRead, lastAccessed: performance.now() });
    totalBytes += bytesRead;

    return data;
  };

  const reload = async (path: string): Promise<void> => {
    const entry = cache.get(path);
    if (entry) {
      const stats = await fsp.stat(path);
      if (stats.mtimeMs !== entry.mtimeMs || stats.size !== entry.bytesRead) {
        cache.delete(path);
        await read(path);
      }
    }
  };

  return {
    async read(path: string): Promise<Buffer> {
      await reload(path);
      return read(path);
    },
  };
}
