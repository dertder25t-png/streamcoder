export function collapseStatusLog<T extends string>(logs: { timestamp: number; status: T }[]): { status: T; start: number; end: number; count: number }[] {
    if (logs.length === 0) return [];

    const result: { status: T; start: number; end: number; count: number }[] = [];
    let currentRun: { status: T; start: number; end: number; count: number } | null = null;

    for (const log of logs) {
        if (currentRun === null || currentRun.status !== log.status) {
            if (currentRun !== null) {
                result.push(currentRun);
            }
            currentRun = { status: log.status, start: log.timestamp, end: log.timestamp, count: 1 };
        } else {
            currentRun.end = log.timestamp;
            currentRun.count++;
        }
    }

    if (currentRun !== null) {
        result.push(currentRun);
    }

    return result;
}
