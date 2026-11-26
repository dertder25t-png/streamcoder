export interface StatusRun<T extends string> {
  status: T;
  start: number;
  end: number;
  count: number;
}

export function collapseStatusLog<T extends string>(
  entries: readonly { timestamp: number; status: T }[],
): StatusRun<T>[] {
  const runs: StatusRun<T>[] = [];
  for (const e of entries) {
    const last = runs[runs.length - 1];
    if (last && last.status === e.status) {
      last.end = e.timestamp;
      last.count += 1;
    } else {
      runs.push({ status: e.status, start: e.timestamp, end: e.timestamp, count: 1 });
    }
  }
  return runs;
}
