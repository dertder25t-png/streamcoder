import { useEffect, useRef } from 'react';

type Listener<Event extends unknown> = Event extends void ? () => void : (payload: Event) => void;

type EventMap = Record<string, unknown>;

type TypedBus<Events extends EventMap> = {
  on<Event extends keyof Events>(event: Event, listener: Listener<Events[Event]>): () => void;
  once<Event extends keyof Events>(event: Event, listener: Listener<Events[Event]>): () => void;
  off<Event extends keyof Events>(event: Event, listener: Listener<Events[Event]>): void;
  emit<Event extends keyof Events>(event: Event, payload?: Events[Event]): void;
};

const createTypedBus = <Events extends EventMap>(): TypedBus<Events> => {
  const listenersRef = useRef<{ [Event in keyof Events]?: Listener<Events[Event]>[] }>({});

  const on = <Event extends keyof Events>(
    event: Event,
    listener: Listener<Events[Event]>
  ): () => void => {
    const eventListeners = listenersRef.current[event] || [];
    const index = eventListeners.indexOf(listener);
    if (index === -1) {
      eventListeners.push(listener);
    }
    listenersRef.current[event] = eventListeners;

    return () => {
      off(event, listener);
    };
  };

  const once = <Event extends keyof Events>(
    event: Event,
    listener: Listener<Events[Event]>
  ): () => void => {
    const wrapper: Listener<Events[Event]> = (payload) => {
      listener(payload);
      off(event, wrapper);
    };
    return on(event, wrapper);
  };

  const off = <Event extends keyof Events>(
    event: Event,
    listener: Listener<Events[Event]>
  ): void => {
    const eventListeners = listenersRef.current[event];
    if (eventListeners) {
      const index = eventListeners.indexOf(listener);
      if (index !== -1) {
        eventListeners.splice(index, 1);
      }
    }
  };

  const emit = <Event extends keyof Events>(
    event: Event,
    payload?: Events[Event]
  ): void => {
    const eventListeners = listenersRef.current[event];
    if (eventListeners) {
      const snapshot = [...eventListeners];
      snapshot.forEach((listener) => {
        if (payload === undefined) {
          (listener as () => void)();
        } else {
          (listener as (payload: Events[Event]) => void)(payload);
        }
      });
    }
  };

  return { on, once, off, emit };
};

export { createTypedBus };
