type Transition<S extends string> = { target: S; guard?: () => boolean };
type Table<S extends string> = { [K in S]: { [event: string]: Transition<S> } };
type EventOf<T> = { [K in keyof T]: keyof T[K] }[keyof T] & string;

export function createStateMachine<const T extends Table<Extract<keyof T, string>>>(config: {
  initial: Extract<keyof T, string>;
  transitions: T;
}): {
  getState(): Extract<keyof T, string>;
  can(event: EventOf<T>): boolean;
  send(event: EventOf<T>): boolean;
} {
  let state: string = config.initial;
  const find = (event: string) => {
    const row = (config.transitions as Record<string, Record<string, Transition<string>>>)[state];
    const t = row && Object.prototype.hasOwnProperty.call(row, event) ? row[event] : undefined;
    if (!t) return undefined;
    if (t.guard && !t.guard()) return undefined;
    return t;
  };
  return {
    getState: () => state as Extract<keyof T, string>,
    can: (event) => find(event) !== undefined,
    send: (event) => {
      const t = find(event);
      if (!t) return false;
      state = t.target;
      return true;
    },
  };
}
