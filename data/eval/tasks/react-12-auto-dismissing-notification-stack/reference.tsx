import { useEffect, useRef, useState } from "react";

export type Toast = { id: string; message: string; durationMs?: number };

function ToastItem({
  toast,
  defaultDurationMs,
  onDismiss,
}: {
  toast: Toast;
  defaultDurationMs: number;
  onDismiss: (id: string) => void;
}) {
  const [paused, setPaused] = useState(false);
  const duration = toast.durationMs ?? defaultDurationMs;
  const dismiss = useRef(onDismiss);
  useEffect(() => {
    dismiss.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (paused || duration <= 0) return;
    const timer = setTimeout(() => dismiss.current(toast.id), duration);
    return () => clearTimeout(timer);
  }, [paused, duration, toast.id]);

  return (
    <li onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <span>{toast.message}</span>
      <button type="button" aria-label="Close" onClick={() => onDismiss(toast.id)}>
        x
      </button>
    </li>
  );
}

export function ToastList({
  toasts,
  onDismiss,
  defaultDurationMs = 4000,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
  defaultDurationMs?: number;
}) {
  return (
    <ul>
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} defaultDurationMs={defaultDurationMs} onDismiss={onDismiss} />
      ))}
    </ul>
  );
}
