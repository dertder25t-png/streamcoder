import { useEffect, useRef, useState } from "react";

export function SubmitOnceButton({ onAction, label }: { onAction: () => Promise<void>; label: string }) {
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const handleClick = async () => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    try {
      await onAction();
    } catch {
      // swallow: the button must recover
    } finally {
      busy.current = false;
      if (mounted.current) setPending(false);
    }
  };

  return (
    <button type="button" disabled={pending} onClick={handleClick}>
      {pending ? "Working..." : label}
    </button>
  );
}
