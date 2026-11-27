function movingWindowMean(values: readonly number[], windowSize: number): number[] {
  if (!Number.isInteger(windowSize) || windowSize <= 0) {
    throw new RangeError('windowSize must be a positive integer');
  }
  if (values.length < windowSize) {
    return [];
  }

  const result: number[] = [];
  let currentSum = 0;

  // Initialize the sum for the first window
  for (let i = 0; i < windowSize; i++) {
    currentSum += values[i];
  }
  result.push(currentSum / windowSize);

  // Slide the window over the array
  for (let i = windowSize; i < values.length; i++) {
    currentSum += values[i] - values[i - windowSize];
    result.push(currentSum / windowSize);
  }

  return result;
}

export { movingWindowMean };
