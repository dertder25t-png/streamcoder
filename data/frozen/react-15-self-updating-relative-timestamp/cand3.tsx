import React, { useEffect, useState } from 'react';

export function TimeAgoLabel({ timestampMs, now = Date.now }: { timestampMs: number; now?: () => number }) {
  const [timeAgo, setTimeAgo] = useState(getTimeAgo(timestampMs, now()));

  useEffect(() => {
    const intervalId = setInterval(() => {
      setTimeAgo(getTimeAgo(timestampMs, now()));
    }, 30000);

    return () => clearInterval(intervalId);
  }, [timestampMs, now]);

  return <time dateTime={new Date(timestampMs).toISOString()}>{timeAgo}</time>;
}

function getTimeAgo(timestampMs: number, nowMs: number): string {
  const diffSeconds = Math.floor((nowMs - timestampMs) / 1000);
  if (diffSeconds < 60) return 'just now';
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
  return `${Math.floor(diffSeconds / 3600)}h ago`;
}
