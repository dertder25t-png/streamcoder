export function buildCategoryPath(
  nodes: readonly { id: string; parentId: string | null; name: string }[],
  targetId: string,
): string[] {
  const byId = new Map<string, { id: string; parentId: string | null; name: string }>();
  for (const n of nodes) byId.set(n.id, n);
  let current = byId.get(targetId);
  if (!current) return [];
  const seen = new Set<string>();
  const path: string[] = [];
  while (current) {
    if (seen.has(current.id)) throw new Error(`Circular parent chain at "${current.id}"`);
    seen.add(current.id);
    path.push(current.name);
    current = current.parentId === null ? undefined : byId.get(current.parentId);
  }
  return path.reverse();
}
