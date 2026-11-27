/**
 * Collapses consecutive identical statuses into runs.
 * @param logs - Chronologically ordered array of { timestamp: number; status: T } entries.
 * @returns An array of runs shaped { status: T; start: number; end: number; count: number }.
 */
export function collapseStatusLog<T extends string>(logs: Array<{ timestamp: number; status: T }>): Array<{ status: T; start: number; end: number; count: number }> {
    if (logs.length === 0) {
        return [];
    }

    const runs: Array<{ status: T; start: number; end: number; count: number }> = [];
    let currentRun = { status: logs[0].status, start: logs[0].timestamp, end: logs[0].timestamp, count: 1 };

    for (let i = 1; i < logs.length; i++) {
        const log = logs[i];
        if (log.status === currentRun.status) {
            currentRun.count++;
            currentRun.end = log.timestamp;
        } else {
            runs.push(currentRun);
            currentRun = { status: log.status, start: log.timestamp, end: log.timestamp, count: 1 };
        }
    }

    runs.push(currentRun);
    return runs;
}
