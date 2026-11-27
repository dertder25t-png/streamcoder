export function subtractIntervals(
  base: readonly [number, number][],
  cutouts: readonly [number, number][]
): [number, number][] {
  // Helper function to check if an interval is valid
  function isValidInterval(interval: [number, number]): boolean {
    if (interval[0] === interval[1] || interval[0] > interval[1]) {
      throw new RangeError('Invalid interval');
    }
    return true;
  }

  // Helper function to merge overlapping intervals
  function mergeIntervals(intervals: [number, number][]): [number, number][] {
    const result: [number, number][] = [];
    let currentInterval = intervals[0];

    for (let i = 1; i < intervals.length; i++) {
      const nextInterval = intervals[i];
      if (currentInterval[1] >= nextInterval[0]) {
        currentInterval[1] = Math.max(currentInterval[1], nextInterval[1]);
      } else {
        result.push(currentInterval);
        currentInterval = nextInterval;
      }
    }
    result.push(currentInterval);
    return result;
  }

  // Validate and merge base intervals
  const validBaseIntervals = base.filter(isValidInterval);
  const mergedBaseIntervals = mergeIntervals(validBaseIntervals);

  // Subtract cutouts from the base intervals
  const result: [number, number][] = [];
  let currentBaseIntervalIndex = 0;

  for (const cutout of cutouts) {
    isValidInterval(cutout);

    while (currentBaseIntervalIndex < mergedBaseIntervals.length) {
      const baseInterval = mergedBaseIntervals[currentBaseIntervalIndex];
      if (cutout[1] <= baseInterval[0]) {
        // Cutout is before the current base interval
        break;
      } else if (cutout[0] >= baseInterval[1]) {
        // Cutout is after the current base interval
        result.push(baseInterval);
        currentBaseIntervalIndex++;
      } else {
        // Cutout overlaps with the current base interval
        if (cutout[0] > baseInterval[0]) {
          result.push([baseInterval[0], cutout[0]]);
        }
        if (cutout[1] < baseInterval[1]) {
          result.push([cutout[1], baseInterval[1]]);
        }
        currentBaseIntervalIndex++;
      }
    }
  }

  // Add remaining base intervals after processing all cutouts
  while (currentBaseIntervalIndex < mergedBaseIntervals.length) {
    result.push(mergedBaseIntervals[currentBaseIntervalIndex]);
    currentBaseIntervalIndex++;
  }

  return result;
}
