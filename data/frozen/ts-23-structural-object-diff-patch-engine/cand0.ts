type PathSegment = string | number;
type Path = PathSegment[];

interface DiffOperation {
  op: 'add' | 'replace' | 'remove';
  path: Path;
  value?: unknown;
}

function computeObjectDiff(before: unknown, after: unknown): DiffOperation[] {
  const diff: DiffOperation[] = [];

  function compare(beforeValue: unknown, afterValue: unknown, path: Path) {
    if (beforeValue === afterValue) return;

    if (typeof beforeValue === 'object' && beforeValue !== null && typeof afterValue === 'object' && afterValue !== null) {
      if (Array.isArray(beforeValue) && Array.isArray(afterValue)) {
        if (beforeValue.length !== afterValue.length) {
          diff.push({ op: 'replace', path, value: afterValue });
        } else {
          for (let i = 0; i < beforeValue.length; i++) {
            compare(beforeValue[i], afterValue[i], [...path, i]);
          }
        }
      } else {
        const beforeKeys = Object.keys(beforeValue);
        const afterKeys = Object.keys(afterValue);
        const allKeys = new Set([...beforeKeys, ...afterKeys]);

        allKeys.forEach(key => {
          const beforePath = [...path, key];
          const afterPath = [...path, key];
          compare(beforeValue[key], afterValue[key], beforePath);
        });
      }
    } else {
      diff.push({ op: 'replace', path, value: afterValue });
    }
  }

  compare(before, after, []);
  return diff;
}

function applyObjectDiff(target: unknown, ops: DiffOperation[]): unknown {
  const result = JSON.parse(JSON.stringify(target));

  ops.forEach(op => {
    const { op: operation, path, value } = op;
    let current = result;

    for (let i = 0; i < path.length - 1; i++) {
      const segment = path[i];
      if (typeof segment === 'number') {
        if (!Array.isArray(current)) {
          throw new Error('Invalid path');
        }
        if (segment >= current.length) {
          throw new Error('Invalid path');
        }
      } else {
        if (typeof current !== 'object' || current === null) {
          throw new Error('Invalid path');
        }
      }
      current = current[segment];
    }

    const lastSegment = path[path.length - 1];
    if (operation === 'add' || operation === 'replace') {
      if (typeof lastSegment === 'number') {
        if (!Array.isArray(current)) {
          throw new Error('Invalid path');
        }
        if (lastSegment >= current.length) {
          current.push(value);
        } else {
          current[lastSegment] = value;
        }
      } else {
        if (typeof current !== 'object' || current === null) {
          throw new Error('Invalid path');
        }
        current[lastSegment] = value;
      }
    } else if (operation === 'remove') {
      if (typeof lastSegment === 'number') {
        if (!Array.isArray(current)) {
          throw new Error('Invalid path');
        }
        if (lastSegment >= current.length) {
          throw new Error('Invalid path');
        }
        current.splice(lastSegment, 1);
      } else {
        if (typeof current !== 'object' || current === null) {
          throw new Error('Invalid path');
        }
        delete current[lastSegment];
      }
    }
  });

  return result;
}

export { computeObjectDiff, applyObjectDiff };
