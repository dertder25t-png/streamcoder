import { useState } from "react";

type Column = { key: string; label: string; numeric?: boolean };
type Row = Record<string, string | number>;

export function SortableTable({ rows, columns }: { rows: Row[]; columns: Column[] }) {
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);

  const click = (key: string) =>
    setSort((s) => {
      if (!s || s.key !== key) return { key, dir: "asc" };
      return s.dir === "asc" ? { key, dir: "desc" } : null;
    });

  let shown = rows;
  if (sort) {
    const col = columns.find((c) => c.key === sort.key);
    const sign = sort.dir === "asc" ? 1 : -1;
    shown = [...rows].sort((a, b) => {
      const x = a[sort.key];
      const y = b[sort.key];
      const r = col?.numeric ? Number(x) - Number(y) : String(x).localeCompare(String(y));
      return r * sign;
    });
  }

  return (
    <table>
      <thead>
        <tr>
          {columns.map((c) => (
            <th
              key={c.key}
              onClick={() => click(c.key)}
              aria-sort={sort?.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
            >
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {shown.map((r, i) => (
          <tr key={i}>
            {columns.map((c) => (
              <td key={c.key}>{r[c.key]}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
