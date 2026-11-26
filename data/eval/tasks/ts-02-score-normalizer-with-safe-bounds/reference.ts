export function normalizeScores(values: readonly number[], targetMin = 0, targetMax = 1): number[] {
  if (!Number.isFinite(targetMin) || !Number.isFinite(targetMax) || targetMin > targetMax) {
    throw new RangeError("invalid target range");
  }
  for (const v of values) {
    if (!Number.isFinite(v)) throw new RangeError(`non-finite value: ${v}`);
  }
  if (values.length === 0) return [];
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of values) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  if (lo === hi) return values.map(() => targetMin);
  return values.map((v) => targetMin + ((v - lo) / (hi - lo)) * (targetMax - targetMin));
}
