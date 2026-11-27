import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';

export async function hashFileStream(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  return new Promise((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', (err) => reject(err));
  });
}
