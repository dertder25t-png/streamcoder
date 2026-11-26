import { useEffect, useRef, useState } from "react";

export type Item = { id: string; label: string };

export function DeferredActionList({
  items,
  onCommitDelete,
  graceMs = 3000,
}: {
  items: Item[];
  onCommitDelete: (id: string) => void;
  graceMs?: number;
}) {
  const [pending, setPending] = useState<string[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const commit = useRef(onCommitDelete);
  useEffect(() => {
    commit.current = onCommitDelete;
  }, [onCommitDelete]);

  const cancel = (id: string) => {
    const t = timers.current.get(id);
    if (t !== undefined) clearTimeout(t);
    timers.current.delete(id);
    setPending((p) => p.filter((x) => x !== id));
  };

  const start = (id: string) => {
    if (timers.current.has(id)) return;
    setPending((p) => [...p, id]);
    timers.current.set(
      id,
      setTimeout(() => {
        timers.current.delete(id);
        setPending((p) => p.filter((x) => x !== id));
        commit.current(id);
      }, graceMs),
    );
  };

  useEffect(() => {
    const present = new Set(items.map((i) => i.id));
    for (const id of Array.from(timers.current.keys())) {
      if (!present.has(id)) cancel(id);
    }
  }, [items]);

  useEffect(
    () => () => {
      for (const t of timers.current.values()) clearTimeout(t);
      timers.current.clear();
    },
    [],
  );

  return (
    <ul>
      {items.map((item) => (
        <li key={item.id}>
          <span>{item.label}</span>
          {pending.includes(item.id) ? (
            <>
              <span>Deleting...</span>
              <button type="button" onClick={() => cancel(item.id)}>
                Undo
              </button>
            </>
          ) : (
            <button type="button" onClick={() => start(item.id)}>
              Delete
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
