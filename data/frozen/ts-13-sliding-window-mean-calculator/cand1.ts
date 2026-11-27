/**
 * Computes the arithmetic mean for each contiguous window of length windowSize.
 * @param values - The input array of numbers.
 * @param windowSize - The size of the window for which to compute the mean.
 * @returns An array containing the mean of each window.
 * @throws RangeError if windowSize is not a positive integer.
 */
export function movingWindowMean(values: readonly number[], windowSize: number): number[] {
  if (!Number.isInteger(windowSize) || windowSize <= 0) {
    throw new RangeError('windowSize must be a positive integer');
  }

  const result: number[] = [];
  let sum = 0;

  for (let i = 0; i < values.length; i++) {
    sum += values[i];

    if (i >= windowSize) {
      sum -= values[i - windowSize];
    }

    if (i + 1 >= windowSize) {
      result.push(sum / windowSize);
    }
  }

  return result;
}
