import React, { useEffect, useState } from 'react';

const TimeAgoLabel: React.FC<{ timestampMs: number; now?: () => number }> = ({ timestampMs, now = Date.now }) => {
  const [timeAgo, setTimeAgo] = useState<string>(formatTimeAgo(timestampMs, now()));

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeAgo(formatTimeAgo(timestampMs, now()));
    }, 30000);

    return () => clearInterval(interval);
  }, [timestampMs, now]);

  return <time dateTime={new Date(timestampMs).toISOString()}>{timeAgo}</time>;
};

const formatTimeAgo = (timestampMs: number, nowMs: number): string => {
  const diffMs = nowMs - timestampMs;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffSecs / 3600);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  return `${diffHours}h ago`;
};

export { TimeAgoLabel };
