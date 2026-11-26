export function movingWindowMean(values: readonly number[], windowSize: number): number[] {
  if (!Number.isInteger(windowSize) || windowSize < 1) {
    throw new RangeError("windowSize must be a positive integer");
  }
  const n = values.length;
  if (n < windowSize) return [];
  // Neumaier-compensated running sum: O(n), no drift.
  let sum = 0;
  let comp = 0;
  const add = (x: number): void => {
    const t = sum + x;
    if (Math.abs(sum) >= Math.abs(x)) comp += sum - t + x;
    else comp += x - t + sum;
    sum = t;
  };
  const out: number[] = [];
  for (let i = 0; i < windowSize; i++) add(values[i]);
  out.push((sum + comp) / windowSize);
  for (let i = windowSize; i < n; i++) {
    add(values[i]);
    add(-values[i - windowSize]);
    out.push((sum + comp) / windowSize);
  }
  return out;
}
