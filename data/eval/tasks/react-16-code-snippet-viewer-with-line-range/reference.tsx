function parseRanges(spec: string, total: number): Set<number> {
  const out = new Set<number>();
  for (const part of spec.split(",")) {
    const m = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!m) continue;
    const start = Number(m[1]);
    const end = m[2] === undefined ? start : Number(m[2]);
    for (let n = Math.max(1, start); n <= Math.min(total, end); n++) out.add(n);
  }
  return out;
}

export function HighlightedSnippet({ code, highlightLines }: { code: string; highlightLines: string }) {
  const lines = code.split(/\r?\n/);
  const highlighted = parseRanges(highlightLines, lines.length);
  return (
    <pre>
      {lines.map((line, i) => (
        <div key={i} data-highlighted={highlighted.has(i + 1) ? "true" : "false"}>
          <span>{i + 1}</span>
          <code>{line}</code>
        </div>
      ))}
    </pre>
  );
}
