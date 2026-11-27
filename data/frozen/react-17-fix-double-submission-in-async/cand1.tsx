import { useState, useRef, useEffect } from "react";

export function SubmitOnceButton({ onAction, label }: { onAction: () => Promise<void>; label: string }) {
  const [pending, setPending] = useState(false);
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const handleClick = async () => {
    if (pending) return;
    setPending(true);
    try {
      await onAction();
    } catch (error) {
      // Handle error if needed
    } finally {
      if (isMounted.current) {
        setPending(false);
      }
    }
  };

  return (
    <button type="button" disabled={pending} onClick={handleClick}>
      {pending ? "Working..." : label}
    </button>
  );
}
