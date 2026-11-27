import { Readable } from 'stream';

export async function measureStream(readable: Readable): Promise<{ bytes: number; lines: number }> {
  let bytes = 0;
  let lines = 0;
  let buffer = '';

  for await (const chunk of readable) {
    bytes += chunk.length;
    buffer += chunk.toString('utf-8');

    const lineBreaks = buffer.split('\n');
    lines += lineBreaks.length - 1;
    buffer = lineBreaks[lineBreaks.length - 1];
  }

  if (buffer.length > 0) {
    lines += 1;
  }

  return { bytes, lines };
}
