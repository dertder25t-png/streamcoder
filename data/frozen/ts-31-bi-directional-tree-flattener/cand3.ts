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
  function traverse(node: TreeNode<T>, parentId: string | null) {
    result.push({ id: node.id, parentId, value: node.value });
    node.children.forEach(child => traverse(child, node.id));
  }
  roots.forEach(root => traverse(root, null));
  return result;
}

function rebuildTree<T>(flat: readonly FlatNode<T>[]): TreeNode<T>[] {
  if (flat.length === 0) return [];

  const map = new Map<string, TreeNode<T>>();
  const roots: TreeNode<T>[] = [];

  flat.forEach(node => {
    if (map.has(node.id)) throw new Error(`Duplicate node ID: ${node.id}`);
    map.set(node.id, { id: node.id, value: node.value, children: [] });
  });

  flat.forEach(node => {
    const newNode = map.get(node.id);
    if (!newNode) throw new Error(`Orphan node ID: ${node.id}`);

    if (node.parentId === null) {
      roots.push(newNode);
    } else {
      const parentNode = map.get(node.parentId);
      if (!parentNode) throw new Error(`Invalid parent ID for node: ${node.id}`);
      parentNode.children.push(newNode);
    }
  });

  return roots;
}
