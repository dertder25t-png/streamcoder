import { useEffect, useRef } from 'react';

type Listener<T> = (payload: T) => void;
type VoidListener = () => void;

interface Bus<Events extends Record<string, unknown>> {
  on<T extends keyof Events>(event: T, listener: Listener<Events[T]>): () => void;
  once<T extends keyof Events>(event: T, listener: Listener<Events[T]>): () => void;
  off<T extends keyof Events>(event: T, listener: Listener<Events[T]>): void;
  emit<T extends keyof Events>(event: T, payload?: Events[T]): void;
}

export function createTypedBus<Events extends Record<string, unknown>>(): Bus<Events> {
  const listeners = useRef<{ [K in keyof Events]?: Listener<Events[K]>[] }>({});

  const on = <T extends keyof Events>(event: T, listener: Listener<Events[T]>): () => void => {
    if (!listeners.current[event]) {
      listeners.current[event] = [];
    }
    listeners.current[event]!.push(listener);

    return () => {
      off(event, listener);
    };
  };

  const once = <T extends keyof Events>(event: T, listener: Listener<Events[T]>): () => void => {
    const onceListener: Listener<Events[T]> = (payload) => {
      listener(payload);
      off(event, onceListener);
    };
    return on(event, onceListener);
  };

  const off = <T extends keyof Events>(event: T, listener: Listener<Events[T]>): void => {
    if (listeners.current[event]) {
      listeners.current[event] = listeners.current[event]!.filter(l => l !== listener);
    }
  };

  const emit = <T extends keyof Events>(event: T, payload?: Events[T]): void => {
    if (listeners.current[event]) {
      const currentListeners = [...listeners.current[event]!];
      currentListeners.forEach(listener => {
        if (payload !== undefined) {
          listener(payload);
        } else {
          (listener as VoidListener)();
        }
      });
    }
  };

  return { on, once, off, emit };
}
