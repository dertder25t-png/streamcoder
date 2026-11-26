type DeepPartial<T> = T extends (...args: any[]) => any
  ? T
  : T extends readonly unknown[]
    ? T
    : T extends object
      ? { [P in keyof T]?: DeepPartial<T[P]> }
      : T;

export type DeepPartialExcept<T, K extends keyof T> = Pick<T, K> & DeepPartial<Omit<T, K>>;
