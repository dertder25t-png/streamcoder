import { useEffect, useState } from "react";

export type Store<T> = {
  subscribe: (callback: () => void) => () => void;
  getSnapshot: () => T;
};

const useSyncExternalStore = (subscribe: () => () => void, getSnapshot: () => unknown) => {
  const [state, setState] = useState(getSnapshot);

  useEffect(() => {
    const unsubscribe = subscribe(() => setState(getSnapshot));
    return () => unsubscribe();
  }, [subscribe, getSnapshot]);

  return state;
};

export function useExternalSnapshot<T>(store: Store<T>): T {
  return useSyncExternalStore(
    () => store.subscribe(() => undefined),
    () => store.getSnapshot()
  ) as T;
}
