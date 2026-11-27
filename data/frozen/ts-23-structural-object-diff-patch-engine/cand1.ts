/**
 * Computes the difference between two JSON-compatible values.
 * @param before The original value.
 * @param after The new value.
 * @returns An array of operations to transform `before` into `after`.
 */
function computeObjectDiff(before: any, after: any): Array<{ path: string[], op: 'add' | 'replace' | 'remove', value?: any }> {
    const ops: Array<{ path: string[], op: 'add' | 'replace' | 'remove', value?: any }> = [];

    function diff(path: string[], before: any, after: any) {
        if (before === after) return;
        if (typeof before !== typeof after || (typeof before === 'object' && before !== null && after !== null)) {
            ops.push({ path, op: 'replace', value: after });
        } else if (Array.isArray(before)) {
            if (!Array.isArray(after)) {
                ops.push({ path, op: 'replace', value: after });
            } else {
                const maxLen = Math.max(before.length, after.length);
                for (let i = 0; i < maxLen; i++) {
                    diff([...path, i.toString()], before[i], after[i]);
                }
            }
        } else if (typeof before === 'object') {
            const beforeKeys = Object.keys(before);
            const afterKeys = Object.keys(after);
            const allKeys = new Set([...beforeKeys, ...afterKeys]);
            allKeys.forEach(key => {
                diff([...path, key], before[key], after[key]);
            });
        } else {
            ops.push({ path, op: 'replace', value: after });
        }
    }

    diff([], before, after);
    return ops;
}

/**
 * Applies a series of operations to transform a target value.
 * @param target The target value to be transformed.
 * @param ops An array of operations to apply.
 * @returns The transformed target value.
 */
function applyObjectDiff(target: any, ops: Array<{ path: string[], op: 'add' | 'replace' | 'remove', value?: any }>): any {
    const result = JSON.parse(JSON.stringify(target)); // Create a deep copy to avoid mutating the original

    function apply(path: string[], value: any, op: 'add' | 'replace' | 'remove') {
        let current = result;
        path.slice(0, -1).forEach(segment => {
            if (!current[segment]) current[segment] = {};
            current = current[segment];
        });
        const key = path[path.length - 1];
        if (op === 'add' || op === 'replace') {
            current[key] = value;
        } else if (op === 'remove') {
            delete current[key];
        }
    }

    ops.forEach(op => apply(op.path, op.value, op.op));
    return result;
}

export { computeObjectDiff, applyObjectDiff };
