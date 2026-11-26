export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

export type DiffOp =
  | { op: "add"; path: string[]; value: Json }
  | { op: "replace"; path: string[]; value: Json }
  | { op: "remove"; path: string[] };

const isObj = (v: Json | undefined): v is { [key: string]: Json } =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const has = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);

const same = (a: Json, b: Json): boolean => JSON.stringify(a) === JSON.stringify(b);

const clone = <V extends Json>(v: V): V => JSON.parse(JSON.stringify(v)) as V;

export function computeObjectDiff(before: Json, after: Json, path: string[] = []): DiffOp[] {
  if (isObj(before) && isObj(after)) {
    const ops: DiffOp[] = [];
    for (const k of Object.keys(before)) {
      if (!has(after, k)) ops.push({ op: "remove", path: [...path, k] });
    }
    for (const k of Object.keys(after)) {
      if (!has(before, k)) ops.push({ op: "add", path: [...path, k], value: clone(after[k]) });
      else ops.push(...computeObjectDiff(before[k], after[k], [...path, k]));
    }
    return ops;
  }
  return same(before, after) ? [] : [{ op: "replace", path, value: clone(after) }];
}

export function applyObjectDiff(target: Json, ops: readonly DiffOp[]): Json {
  let root: Json = clone(target);
  for (const op of ops) {
    if (op.path.length === 0) {
      if (op.op === "remove") throw new Error("Cannot remove the root");
      root = clone(op.value);
      continue;
    }
    let node: Json = root;
    for (const seg of op.path.slice(0, -1)) {
      if (!isObj(node) || !has(node, seg)) throw new Error("Invalid path");
      node = node[seg];
    }
    const last = op.path[op.path.length - 1];
    if (!isObj(node)) throw new Error("Invalid path");
    if (op.op === "remove") delete node[last];
    else Object.defineProperty(node, last, { value: clone(op.value), enumerable: true, writable: true, configurable: true });
  }
  return root;
}
