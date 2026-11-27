/**
 * Fills missing hours in a sorted UTC hour-aligned data points array.
 * @param points - Sorted UTC hour-aligned data points.
 * @param fillValue - Value to fill missing hours with (default 0).
 * @returns A new array with missing hours filled.
 */
export function fillMissingHours(
  points: readonly { hourMs: number; value: number }[],
  fillValue: number = 0
): { hourMs: number; value: number }[] {
  if (points.length <= 1) {
    return [...points];
  }

  const result: { hourMs: number; value: number }[] = [];
  let currentHour = points[0].hourMs;

  for (const point of points) {
    while (currentHour < point.hourMs) {
      result.push({ hourMs: currentHour, value: fillValue });
      currentHour += 3_600_000;
    }
    result.push(point);
    currentHour = point.hourMs + 3_600_000;
  }

  return result;
}
