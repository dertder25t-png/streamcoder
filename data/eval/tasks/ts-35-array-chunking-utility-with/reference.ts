export function chunkArray<T>(items: readonly T[], size: number): T[][] {
  if (!(size >= 1)) throw new RangeError("size must be at least 1");
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
