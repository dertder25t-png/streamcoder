import { useSyncExternalStore } from "react";

export type Store<T> = {
  subscribe: (callback: () => void) => () => void;
  getSnapshot: () => T;
};

export function useExternalSnapshot<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}
