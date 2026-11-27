import { useState, useEffect } from "react";

export function SubmitOnceButton({ onAction, label }: { onAction: () => Promise<void>; label: string }) {
  const [pending, setPending] = useState(false);
  const [isMounted, setIsMounted] = useState(true);

  useEffect(() => {
    return () => {
      setIsMounted(false);
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
      if (isMounted) {
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
