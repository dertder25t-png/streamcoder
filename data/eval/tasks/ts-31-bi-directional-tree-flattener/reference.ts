export type TreeNode<T> = { id: string; value: T; children: TreeNode<T>[] };
export type FlatNode<T> = { id: string; parentId: string | null; value: T };

export function flattenTree<T>(roots: readonly TreeNode<T>[]): FlatNode<T>[] {
  const out: FlatNode<T>[] = [];
  const walk = (nodes: readonly TreeNode<T>[], parentId: string | null): void => {
    for (const n of nodes) {
      out.push({ id: n.id, parentId, value: n.value });
      walk(n.children, n.id);
    }
  };
  walk(roots, null);
  return out;
}

export function rebuildTree<T>(flat: readonly FlatNode<T>[]): TreeNode<T>[] {
  const byId = new Map<string, TreeNode<T>>();
  for (const f of flat) {
    if (byId.has(f.id)) throw new Error(`duplicate id: ${f.id}`);
    byId.set(f.id, { id: f.id, value: f.value, children: [] });
  }
  const roots: TreeNode<T>[] = [];
  for (const f of flat) {
    const node = byId.get(f.id)!;
    if (f.parentId === null) roots.push(node);
    else {
      const parent = byId.get(f.parentId);
      if (!parent) throw new Error(`unknown parent: ${f.parentId}`);
      parent.children.push(node);
    }
  }
  return roots;
}
