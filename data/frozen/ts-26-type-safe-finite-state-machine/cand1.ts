export function createStateMachine<S extends string, E extends string>(
  config: {
    initial: S;
    transitions: {
      [state in S]: {
        [event in E]: {
          target: S;
          guard?: () => boolean;
        };
      };
    };
  }
) {
  let currentState: S = config.initial;

  const can = (event: E): boolean => {
    return (
      config.transitions[currentState][event] !== undefined &&
      (config.transitions[currentState][event].guard ? config.transitions[currentState][event].guard() : true)
    );
  };

  const send = (event: E): boolean => {
    if (can(event)) {
      currentState = config.transitions[currentState][event].target;
      return true;
    }
    return false;
  };

  const getState = (): S => {
    return currentState;
  };

  return {
    getState,
    can,
    send,
  };
}
