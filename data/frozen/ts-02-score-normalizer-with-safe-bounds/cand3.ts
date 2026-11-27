function normalizeScores(
  values: readonly number[],
  targetMin: number = 0,
  targetMax: number = 1
): number[] {
  if (values.length === 0) return [];

  const finiteValues = values.filter(value => !isNaN(value) && value !== Infinity && value !== -Infinity);
  if (finiteValues.length === 0 || new Set(finiteValues).size === 1) {
    return new Array(values.length).fill(targetMin);
  }

  const minValue = Math.min(...finiteValues);
  const maxValue = Math.max(...finiteValues);

  if (targetMin > targetMax) throw new RangeError('targetMin must be less than or equal to targetMax');

  return values.map(value => {
    if (isNaN(value) || value === Infinity || value === -Infinity) return NaN;
    return ((value - minValue) / (maxValue - minValue)) * (targetMax - targetMin) + targetMin;
  });
}

export { normalizeScores };
