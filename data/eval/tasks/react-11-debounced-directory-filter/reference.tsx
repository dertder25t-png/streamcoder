import { useEffect, useRef, useState } from "react";

export function FilterableDirectory({
  entries,
  delayMs = 250,
}: {
  entries: { id: string; name: string; department: string }[];
  delayMs?: number;
}) {
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => cancel, []);

  const onType = (v: string) => {
    setText(v);
    cancel();
    timer.current = setTimeout(() => {
      timer.current = null;
      setQuery(v);
    }, delayMs);
  };

  const q = query.trim().toLowerCase();
  const shown = entries.filter(
    (e) => e.name.toLowerCase().includes(q) || e.department.toLowerCase().includes(q),
  );

  return (
    <div>
      <input type="text" aria-label="Search" value={text} onChange={(e) => onType(e.target.value)} />
      <button
        type="button"
        onClick={() => {
          cancel();
          setText("");
          setQuery("");
        }}
      >
        Clear
      </button>
      {shown.length === 0 ? (
        <p>No matching people</p>
      ) : (
        <ul>
          {shown.map((e) => (
            <li key={e.id}>
              <span>{e.name}</span> <span>{e.department}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
