type StatusRun<T extends string> = {
  status: T;
  start: number;
  end: number;
  count: number;
};

export function collapseStatusLog<T extends string>(
  logs: { timestamp: number; status: T }[]
): StatusRun<T>[] {
  if (logs.length === 0) return [];

  const result: StatusRun<T>[] = [];
  let currentRun: StatusRun<T> | undefined = undefined;

  for (const log of logs) {
    if (currentRun === undefined || currentRun.status !== log.status) {
      currentRun = {
        status: log.status,
        start: log.timestamp,
        end: log.timestamp,
        count: 1,
      };
      result.push(currentRun);
    } else {
      currentRun.end = log.timestamp;
      currentRun.count++;
    }
  }

  return result;
}
