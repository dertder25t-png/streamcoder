type StateMachineConfig<S extends string, E extends string> = {
  initial: S;
  transitions: {
    [state in S]: {
      [event in E]: {
        target: S;
        guard?: () => boolean;
      };
    };
  };
};

type StateMachine<S extends string, E extends string> = {
  getState: () => S;
  can: (event: E) => boolean;
  send: (event: E) => boolean;
};

export function createStateMachine<S extends string, E extends string>(
  config: StateMachineConfig<S, E>
): StateMachine<S, E> {
  let currentState: S = config.initial;

  const can = (event: E): boolean => {
    const transition = config.transitions[currentState][event];
    return transition !== undefined && (transition.guard ? transition.guard() : true);
  };

  const send = (event: E): boolean => {
    if (can(event)) {
      currentState = config.transitions[currentState][event].target;
      return true;
    }
    return false;
  };

  const getState = (): S => currentState;

  return { getState, can, send };
}
