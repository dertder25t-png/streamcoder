# Stream a file through a transform safely
```ts
import { createReadStream, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";
await pipeline(createReadStream(src), createGzip(), createWriteStream(dest));
```
`pipeline` propagates errors from every stage and destroys all streams (closing file descriptors) on failure. Plain `.pipe()` does neither. On failure, delete partial output: `await rm(dest, { force: true })`.

# Hash a file without loading it into memory
```ts
import { createHash } from "node:crypto";
const hash = createHash("sha256");
await pipeline(createReadStream(path), hash);
hash.digest("hex");
```

# Read lines from a large file
```ts
import { createInterface } from "node:readline";
for await (const line of createInterface({ input: createReadStream(p), crlfDelay: Infinity })) { … }
```
When splitting chunks yourself, keep the trailing partial line in a buffer, and use `StringDecoder` (or `setEncoding("utf8")`) so multi-byte characters split across chunks are not corrupted.

# Write a file atomically
Write to a temp file in the same directory, then `rename` over the target (rename is atomic on the same filesystem). Clean up the temp file in `finally` if the rename didn't happen.

# fs/promises error handling
```ts
import { readFile, rm } from "node:fs/promises";
try { return JSON.parse(await readFile(p, "utf8")); }
catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return fallback; throw e; }
```
`rm(p, { force: true })` ignores missing files. Check `err.code` (`ENOENT`, `EEXIST`, `EACCES`), not the message.
