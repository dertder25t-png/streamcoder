type DeepFreezeSafeFunction = <T>(value: T) => Readonly<T>;

const _visited = new WeakSet();

export const deepFreezeSafe: DeepFreezeSafeFunction = <T>(value: T): Readonly<T> => {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (_visited.has(value)) {
    return value;
  }

  _visited.add(value);

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      value[index] = deepFreezeSafe(item);
    });
  } else {
    Object.getOwnPropertySymbols(value).forEach(symbol => {
      value[symbol] = deepFreezeSafe(value[symbol]);
    });

    Object.keys(value).forEach(key => {
      value[key] = deepFreezeSafe(value[key]);
    });
  }

  Object.freeze(value);

  return value;
};
