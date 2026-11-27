import { isEqual } from 'lodash-es';

type Path = (string | number)[];
type Op = { path: Path; op: 'add' | 'replace' | 'remove'; value?: unknown };

function computeObjectDiff(before: unknown, after: unknown): Op[] {
  const result: Op[] = [];

  function diff(path: Path, beforeValue: unknown, afterValue: unknown) {
    if (Array.isArray(beforeValue) && Array.isArray(afterValue)) {
      if (beforeValue.length !== afterValue.length) {
        result.push({ path, op: 'replace', value: afterValue });
      } else {
        for (let i = 0; i < beforeValue.length; i++) {
          diff([...path, i], beforeValue[i], afterValue[i]);
        }
      }
    } else if (typeof beforeValue === 'object' && typeof afterValue === 'object' && beforeValue !== null && afterValue !== null) {
      const beforeKeys = Object.keys(beforeValue);
      const afterKeys = Object.keys(afterValue);

      const removedKeys = beforeKeys.filter(key => !afterKeys.includes(key));
      removedKeys.forEach(key => result.push({ path: [...path, key], op: 'remove' }));

      const addedKeys = afterKeys.filter(key => !beforeKeys.includes(key));
      addedKeys.forEach(key => result.push({ path: [...path, key], op: 'add', value: (afterValue as Record<string, unknown>)[key] }));

      const commonKeys = beforeKeys.filter(key => afterKeys.includes(key));
      commonKeys.forEach(key => diff([...path, key], (beforeValue as Record<string, unknown>)[key], (afterValue as Record<string, unknown>)[key]));
    } else if (beforeValue !== afterValue) {
      result.push({ path, op: 'replace', value: afterValue });
    }
  }

  diff([], before, after);
  return result;
}

function applyObjectDiff(target: unknown, ops: Op[]): unknown {
  const result = { ...target };
  ops.forEach(op => {
    let current = result;
    const path = op.path.slice(0, -1);
    const key = op.path[op.path.length - 1];

    path.forEach(p => {
      if (current[p] === undefined) {
        current[p] = {};
      }
      current = current[p] as Record<string, unknown>;
    });

    if (op.op === 'add') {
      current[key] = op.value;
    } else if (op.op === 'replace') {
      current[key] = op.value;
    } else if (op.op === 'remove') {
      delete current[key];
    }
  });
  return result;
}
