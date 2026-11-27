import { useEffect, useState, useSyncExternalStore } from "react";

export type Store<T> = {
  subscribe: (callback: () => void) => () => void;
  getSnapshot: () => T;
};

export function useExternalSnapshot<T>(store: Store<T>): T {
  const [snapshot, setSnapshot] = useState<T>(() => store.getSnapshot());

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setSnapshot(store.getSnapshot());
    });
    return () => unsubscribe();
  }, [store]);

  return useSyncExternalStore(store.subscribe, store.getSnapshot, () => snapshot);
}
