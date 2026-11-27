function movingWindowMean(values: readonly number[], windowSize: number): number[] {
    if (!Number.isInteger(windowSize) || windowSize <= 0) {
        throw new RangeError('windowSize must be a positive integer');
    }
    if (values.length < windowSize) {
        return [];
    }

    const result: number[] = [];
    let windowSum = 0;

    // Initialize the sum of the first window
    for (let i = 0; i < windowSize; i++) {
        windowSum += values[i];
    }
    result.push(windowSum / windowSize);

    // Slide the window across the array
    for (let i = windowSize; i < values.length; i++) {
        windowSum += values[i] - values[i - windowSize];
        result.push(windowSum / windowSize);
    }

    return result;
}

export { movingWindowMean };
