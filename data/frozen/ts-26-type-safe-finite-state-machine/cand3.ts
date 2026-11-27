type StateMachineConfig<S extends string, E extends string> = {
    initial: S;
    transitions: { [state in S]: { [event in E]: { target: S; guard?: () => boolean } } };
};

type TransitionTable<S extends string, E extends string> = StateMachineConfig<S, E>['transitions'];

type Machine<S extends string, E extends string> = {
    getState: () => S;
    can: (event: E) => boolean;
    send: (event: E) => boolean;
};

function createStateMachine<S extends string, E extends string>(config: StateMachineConfig<S, E>): Machine<S, E> {
    let currentState: S = config.initial;

    const can = (event: E): boolean => {
        const transition = config.transitions[currentState][event];
        return !!transition && (transition.guard ? transition.guard() : true);
    };

    const send = (event: E): boolean => {
        const transition = config.transitions[currentState][event];
        if (transition && (transition.guard ? transition.guard() : true)) {
            currentState = transition.target;
            return true;
        }
        return false;
    };

    const getState = (): S => currentState;

    return { getState, can, send };
}

export { createStateMachine };
