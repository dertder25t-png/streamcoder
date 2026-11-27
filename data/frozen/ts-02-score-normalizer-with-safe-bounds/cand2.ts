function normalizeScores(values: readonly number[], targetMin: number = 0, targetMax: number = 1): number[] {
    if (values.length === 0) return [];

    // Filter out non-finite values and find min and max of the finite values
    const finiteValues = values.filter(value => isFinite(value));
    if (finiteValues.length === 0) return Array(values.length).fill(targetMin);

    const inputMin = Math.min(...finiteValues);
    const inputMax = Math.max(...finiteValues);

    if (targetMin > targetMax) {
        throw new RangeError('targetMin must be less than or equal to targetMax');
    }

    // Avoid division by zero if all values are equal
    if (inputMin === inputMax) {
        return Array(values.length).fill(targetMin);
    }

    return values.map(value => {
        if (!isFinite(value)) {
            throw new RangeError('Array contains non-finite values');
        }
        return ((value - inputMin) / (inputMax - inputMin)) * (targetMax - targetMin) + targetMin;
    });
}

export { normalizeScores };
