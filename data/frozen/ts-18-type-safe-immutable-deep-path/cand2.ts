type DotPath<T> = T extends object ? {
  [K in keyof T]: K extends string ? `${K}${T[K] extends object ? '.' | '.' | DotPath<T[K]> : ''}` : never;
}[keyof T] : never;

type PathValue<T, P extends DotPath<T>> = P extends `${infer K}.${infer Rest}` ? K extends keyof T ? PathValue<T[K], Rest> : never : P extends keyof T ? T[P] : never;

function setByPath<T, P extends DotPath<T>>(obj: T, path: P, value: PathValue<T, P>): T {
  if (path.includes("__proto__") || path.includes("constructor") || path.includes("prototype")) {
    throw new Error("Invalid path");
  }

  const parts = path.split('.');
  const lastKey = parts.pop() as keyof PathValue<T, P>;
  const parent = parts.reduce((acc, key) => acc[key], obj);

  if (typeof parent[lastKey] !== typeof value) {
    throw new Error("Type mismatch");
  }

  return {
    ...obj,
    [parts.join('.')]: {
      ...parent,
      [lastKey]: value
    }
  };
}

// Helper function to check for type mismatches
function checkTypeMismatch() {
  const obj = { a: { b: 1 } };
  // @ts-expect-error
  setByPath(obj, 'a.b', '2'); // Should fail because 1 (number) !== '2' (string)
}

// Helper function to check for invalid paths
function checkInvalidPath() {
  const obj = { a: { b: 1 } };
  // @ts-expect-error
  setByPath(obj, 'a.c', 2); // Should fail because 'c' is not a key in 'a'
}

// Helper function to check for __proto__ path
function checkProtoPath() {
  const obj = { a: { b: 1 } };
  // @ts-expect-error
  setByPath(obj, '__proto__', 2); // Should fail because '__proto__' is not allowed
}

// Helper function to check for constructor path
function checkConstructorPath() {
  const obj = { a: { b: 1 } };
  // @ts-expect-error
  setByPath(obj, 'constructor', 2); // Should fail because 'constructor' is not allowed
}

// Helper function to check for prototype path
function checkPrototypePath() {
  const obj = { a: { b: 1 } };
  // @ts-expect-error
  setByPath(obj, 'prototype', 2); // Should fail because 'prototype' is not allowed
}
