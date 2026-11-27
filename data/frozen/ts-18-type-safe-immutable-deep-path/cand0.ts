type DotPath<T> = T extends object ? {
    [K in keyof T]: K extends string ? T[K] extends object ? `${K}.${DotPath<T[K]>}` : K : never;
}[keyof T] : never;

type PathValue<T, P extends DotPath<T>> = P extends `${infer K}.${infer R}` ? K extends keyof T ? R extends DotPath<T[K]> ? PathValue<T[K], R> : never : never : P extends keyof T ? T[P] : never;

function setByPath<T, P extends DotPath<T>>(obj: T, path: P, value: PathValue<T, P>): T {
    if (path.includes("__proto__") || path.includes("constructor") || path.includes("prototype")) {
        throw new Error("Invalid path");
    }

    const keys = path.split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (!(key in current) || typeof current[key] !== 'object') {
            throw new Error("Invalid path");
        }
        current = current[key] as any;
    }
    const lastKey = keys[keys.length - 1];
    if (lastKey in current) {
        if (typeof current[lastKey] !== typeof value) {
            throw new Error("Mismatched value type");
        }
    }
    return {
        ...obj,
        [lastKey]: value
    };
}

export { setByPath, DotPath, PathValue };
