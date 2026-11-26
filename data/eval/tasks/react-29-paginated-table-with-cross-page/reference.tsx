import { useEffect, useState } from "react";

type Row = { id: string; name: string };

export function PaginatedSelectorTable({
  rows,
  pageSize,
  onSelectionChange,
}: {
  rows: Row[];
  pageSize: number;
  onSelectionChange: (ids: string[]) => void;
}) {
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pages - 1);
  const visible = rows.slice(current * pageSize, current * pageSize + pageSize);
  const allVisible = visible.length > 0 && visible.every((r) => selected.includes(r.id));
  const someVisible = visible.some((r) => selected.includes(r.id));

  useEffect(() => {
    onSelectionChange(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const togglePage = () =>
    setSelected((s) =>
      allVisible
        ? s.filter((id) => !visible.some((r) => r.id === id))
        : [...s, ...visible.filter((r) => !s.includes(r.id)).map((r) => r.id)],
    );

  return (
    <div>
      <table>
        <thead>
          <tr>
            <th>
              <input
                type="checkbox"
                aria-label="Select page"
                checked={allVisible}
                ref={(el) => {
                  if (el) el.indeterminate = someVisible && !allVisible;
                }}
                onChange={togglePage}
              />
            </th>
            <th>Name</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((r) => (
            <tr key={r.id}>
              <td>
                <input type="checkbox" aria-label={`Select ${r.name}`} checked={selected.includes(r.id)} onChange={() => toggle(r.id)} />
              </td>
              <td>{r.name}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" onClick={() => setPage(Math.max(0, current - 1))} disabled={current === 0}>
        Previous
      </button>
      <span>
        Page {current + 1} of {pages}
      </span>
      <button type="button" onClick={() => setPage(Math.min(pages - 1, current + 1))} disabled={current >= pages - 1}>
        Next
      </button>
      <button type="button" onClick={() => setSelected([])}>
        Clear all ({selected.length})
      </button>
    </div>
  );
}
