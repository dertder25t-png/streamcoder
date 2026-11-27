import { Readable } from 'node:stream';

export async function measureStream(readable: Readable): Promise<{ bytes: number; lines: number }> {
  let bytes = 0;
  let lines = 0;
  let trailingNewline = false;

  for await (const chunk of readable) {
    bytes += chunk.length;
    const chunkLines = chunk.toString().split('\n');
    lines += chunkLines.length - 1;
    trailingNewline = chunkLines.length > 0 && chunkLines[chunkLines.length - 1] === '';
  }

  if (trailingNewline) {
    lines += 1;
  }

  return { bytes, lines };
}
