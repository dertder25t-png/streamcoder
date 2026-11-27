import { useState } from "react";

type Item = { id: string; label: string; draft: string };

function Row({
  item,
  isFirst,
  isLast,
  onUp,
  onDown,
  onDelete,
}: {
  item: Item;
  isFirst: boolean;
  isLast: boolean;
  onUp: () => void;
  onDown: () => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState(item.draft);
  return (
    <li>
      <span>{item.label}</span>
      <input
        aria-label="Draft comment"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      <button type="button" disabled={isFirst} onClick={onUp}>
        Move Up
      </button>
      <button type="button" disabled={isLast} onClick={onDown}>
        Move Down
      </button>
      <button type="button" onClick={onDelete}>
        Delete
      </button>
    </li>
  );
}

export function PriorityQueueList({ items }: { items: Item[] }) {
  const [list, setList] = useState(items);

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    const next = [...list];
    [next[index], next[target]] = [next[target], next[index]];
    setList(next);
  };

  return (
    <ul>
      {list.map((item, index) => (
        <Row
          key={item.id}
          item={item}
          isFirst={index === 0}
          isLast={index === list.length - 1}
          onUp={() => move(index, -1)}
          onDown={() => move(index, 1)}
          onDelete={() => setList(list.filter((x) => x.id !== item.id))}
        />
      ))}
    </ul>
  );
}
