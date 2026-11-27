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
      currentHour += 3600000;
    }
    result.push(point);
    currentHour = point.hourMs + 3600000;
  }

  return result;
}
