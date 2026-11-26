import { useCallback, useState } from "react";

export function useWizard(totalSteps: number) {
  const [raw, setRaw] = useState(0);
  const max = Math.max(0, totalSteps - 1);
  const clamp = (s: number) => Math.min(max, Math.max(0, s));
  const step = clamp(raw);
  const next = useCallback(() => setRaw((s) => Math.min(max, s + 1)), [max]);
  const prev = useCallback(() => setRaw((s) => Math.max(0, s - 1)), []);
  const goTo = useCallback((s: number) => setRaw(Math.min(max, Math.max(0, s))), [max]);
  return { step, next, prev, goTo };
}
