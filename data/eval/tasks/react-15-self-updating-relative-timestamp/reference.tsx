import { useEffect, useState } from "react";

function format(timestampMs: number, nowMs: number): string {
  const seconds = Math.max(0, Math.floor((nowMs - timestampMs) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

export function TimeAgoLabel({ timestampMs, now = Date.now }: { timestampMs: number; now?: () => number }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  return <time dateTime={new Date(timestampMs).toISOString()}>{format(timestampMs, now())}</time>;
}
