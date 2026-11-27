import React, { useEffect, useState } from 'react';

const TimeAgoLabel: React.FC<{ timestampMs: number; now?: () => number }> = ({
  timestampMs,
  now = Date.now,
}) => {
  const [timeAgo, setTimeAgo] = useState(calculateTimeAgo(timestampMs, now()));

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeAgo(calculateTimeAgo(timestampMs, now()));
    }, 30000);

    return () => {
      clearInterval(interval);
    };
  }, [timestampMs, now]);

  return <time dateTime={new Date(timestampMs).toISOString()}>{timeAgo}</time>;
};

const calculateTimeAgo = (timestampMs: number, nowMs: number): string => {
  const diffMs = nowMs - timestampMs;
  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  return `${hours}h ago`;
};

export { TimeAgoLabel };
