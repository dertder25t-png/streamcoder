export type Weekday = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

const DAYS: readonly Weekday[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function dayIndex(token: string): number {
  const i = DAYS.findIndex((d) => d.toLowerCase() === token.trim().toLowerCase());
  if (i < 0) throw new Error(`Unknown weekday: "${token}"`);
  return i;
}

export function expandWeekdaySpec(spec: string): Weekday[] {
  if (spec.trim() === "") throw new Error("Empty weekday spec");
  const picked = new Set<number>();
  for (const token of spec.split(",")) {
    const parts = token.split("-");
    if (parts.length > 2) throw new Error(`Malformed range: "${token}"`);
    if (parts.length === 1) {
      picked.add(dayIndex(parts[0]));
      continue;
    }
    const start = dayIndex(parts[0]);
    const end = dayIndex(parts[1]);
    for (let i = start; ; i = (i + 1) % 7) {
      picked.add(i);
      if (i === end) break;
    }
  }
  return [...picked].sort((a, b) => a - b).map((i) => DAYS[i]);
}
