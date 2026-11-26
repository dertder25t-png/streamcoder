type Listener<P> = (payload: P) => void;
type EmitArgs<P> = [P] extends [void] ? [] : [payload: P];
type Entry = { orig: unknown; run: (payload: unknown) => void };

export function createTypedBus<Events extends Record<string, unknown>>() {
  const registry = new Map<keyof Events, Set<Entry>>();

  function add<K extends keyof Events>(event: K, listener: Listener<Events[K]>, once: boolean): () => void {
    let set = registry.get(event);
    if (!set) {
      set = new Set();
      registry.set(event, set);
    }
    const bucket = set;
    let fired = false;
    const entry: Entry = {
      orig: listener,
      run: (payload) => {
        if (once) {
          if (fired) return;
          fired = true;
          bucket.delete(entry);
        }
        listener(payload as Events[K]);
      },
    };
    bucket.add(entry);
    return () => {
      bucket.delete(entry);
    };
  }

  return {
    on<K extends keyof Events>(event: K, listener: Listener<Events[K]>): () => void {
      return add(event, listener, false);
    },
    once<K extends keyof Events>(event: K, listener: Listener<Events[K]>): () => void {
      return add(event, listener, true);
    },
    off<K extends keyof Events>(event: K, listener: Listener<Events[K]>): void {
      const set = registry.get(event);
      if (!set) return;
      for (const entry of set) {
        if (entry.orig === listener) {
          set.delete(entry);
          return;
        }
      }
    },
    emit<K extends keyof Events>(event: K, ...args: EmitArgs<Events[K]>): void {
      const set = registry.get(event);
      if (!set) return;
      for (const entry of [...set]) entry.run(args[0]);
    },
  };
}
