const HOUR = 3_600_000;

export function fillMissingHours(
  points: readonly { hourMs: number; value: number }[],
  fillValue = 0,
): { hourMs: number; value: number }[] {
  if (points.length < 2) return points.map((p) => ({ ...p }));
  const out: { hourMs: number; value: number }[] = [];
  for (let i = 0; i < points.length; i++) {
    out.push({ ...points[i] });
    const next = points[i + 1];
    if (next) {
      for (let t = points[i].hourMs + HOUR; t < next.hourMs; t += HOUR) {
        out.push({ hourMs: t, value: fillValue });
      }
    }
  }
  return out;
}
