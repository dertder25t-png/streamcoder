type DeepPartialExcept<T, K extends keyof T> = {
  [P in keyof T]: P extends K ? T[P] : T[P] extends object ? DeepPartial<T[P]> : T[P] | undefined;
};

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
