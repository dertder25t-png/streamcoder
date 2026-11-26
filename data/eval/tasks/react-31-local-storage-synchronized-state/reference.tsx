import { useCallback, useEffect, useRef, useState } from "react";

function read<T>(key: string, initial: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? initial : (JSON.parse(raw) as T);
  } catch {
    return initial;
  }
}

export function useLocalStorageState<T>(key: string, initialValue: T): [T, (val: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => read(key, initialValue));
  const latest = useRef(value);
  latest.current = value;

  const set = useCallback(
    (val: T | ((prev: T) => T)) => {
      const next = typeof val === "function" ? (val as (p: T) => T)(latest.current) : val;
      latest.current = next;
      setValue(next);
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {}
    },
    [key],
  );

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key) return;
      setValue(read(key, initialValue));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return [value, set];
}
