import { cloneDeep } from 'lodash';

export function fillMissingHours(
  points: readonly { hourMs: number; value: number }[],
  fillValue: number = 0
): { hourMs: number; value: number }[] {
  if (points.length <= 1) {
    return cloneDeep(points);
  }

  const result: { hourMs: number; value: number }[] = [];
  let current = points[0];

  for (let i = 0; i < points.length; i++) {
    const next = points[i];
    const timeDiff = next.hourMs - current.hourMs;

    if (timeDiff > 3600000) {
      const fillPoints = Array.from({ length: Math.floor(timeDiff / 3600000) - 1 }, (_, j) => ({
        hourMs: current.hourMs + (j + 1) * 3600000,
        value: fillValue,
      }));
      result.push(...fillPoints);
    }

    result.push(current);
    current = next;
  }

  return result;
}
