export function planExecutionBatches(
  tasks: readonly { id: string; dependsOn: readonly string[] }[],
): string[][] {
  const ids = new Set<string>();
  for (const t of tasks) {
    if (ids.has(t.id)) throw new Error(`Duplicate task id: ${t.id}`);
    ids.add(t.id);
  }
  const remaining = new Map<string, Set<string>>();
  for (const t of tasks) {
    for (const d of t.dependsOn) {
      if (!ids.has(d)) throw new Error(`Task ${t.id} depends on missing task ${d}`);
    }
    remaining.set(t.id, new Set(t.dependsOn));
  }
  const waves: string[][] = [];
  const done = new Set<string>();
  while (done.size < ids.size) {
    const wave = [...remaining.entries()]
      .filter(([id, deps]) => !done.has(id) && [...deps].every((d) => done.has(d)))
      .map(([id]) => id)
      .sort();
    if (wave.length === 0) {
      const stuck = [...remaining.keys()].filter((id) => !done.has(id)).sort();
      throw new Error(`Cycle detected involving: ${stuck.join(", ")}`);
    }
    wave.forEach((id) => done.add(id));
    waves.push(wave);
  }
  return waves;
}
