type TreeNode<T> = {
  id: string;
  value: T;
  children: TreeNode<T>[];
};

type FlatNode<T> = {
  id: string;
  parentId: string | null;
  value: T;
};

function flattenTree<T>(roots: readonly TreeNode<T>[]): FlatNode<T>[] {
  const result: FlatNode<T>[] = [];

  function traverse(node: TreeNode<T>, parentId: string | null): void {
    result.push({ id: node.id, parentId, value: node.value });
    for (const child of node.children) {
      traverse(child, node.id);
    }
  }

  for (const root of roots) {
    traverse(root, null);
  }

  return result;
}

function rebuildTree<T>(flat: readonly FlatNode<T>[]): TreeNode<T>[] {
  const nodeMap = new Map<string, TreeNode<T>>();
  const rootIds = new Set<string>();

  for (const node of flat) {
    if (nodeMap.has(node.id)) {
      throw new Error(`Duplicate node ID: ${node.id}`);
    }
    nodeMap.set(node.id, { id: node.id, value: node.value, children: [] });
    if (node.parentId === null) {
      rootIds.add(node.id);
    }
  }

  for (const node of flat) {
    if (node.parentId !== null && !nodeMap.has(node.parentId)) {
      throw new Error(`Orphan reference to nonexistent parent ID: ${node.parentId}`);
    }
    if (node.parentId !== null) {
      const parent = nodeMap.get(node.parentId)!;
      parent.children.push(nodeMap.get(node.id)!);
    }
  }

  return Array.from(rootIds).map(id => nodeMap.get(id)!);
}

export { flattenTree, rebuildTree, TreeNode, FlatNode };
