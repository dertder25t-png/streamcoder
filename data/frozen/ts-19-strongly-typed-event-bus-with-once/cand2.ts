import { useEffect, useRef } from 'react';

type BusEvents = Record<string, unknown>;

export function createTypedBus<Events extends BusEvents>() {
  const eventListeners = new Map<string, Array<(payload: unknown) => void>>();

  const on = <EventName extends keyof Events>(
    eventName: EventName,
    listener: (payload: Events[EventName]) => void
  ) => {
    const listeners = eventListeners.get(eventName) || [];
    listeners.push(listener);
    eventListeners.set(eventName, listeners);

    const unsubscribe = () => {
      const updatedListeners = eventListeners.get(eventName)?.filter(l => l !== listener) || [];
      eventListeners.set(eventName, updatedListeners);
    };

    return unsubscribe;
  };

  const once = <EventName extends keyof Events>(
    eventName: EventName,
    listener: (payload: Events[EventName]) => void
  ) => {
    const unsubscribe = on(eventName, (payload) => {
      listener(payload);
      unsubscribe();
    });
  };

  const emit = <EventName extends keyof Events>(
    eventName: EventName,
    payload?: Events[EventName]
  ) => {
    const listeners = eventListeners.get(eventName) || [];
    listeners.forEach(listener => listener(payload as Events[EventName]));
  };

  return {
    on,
    once,
    off: <EventName extends keyof Events>(eventName: EventName, listener: (payload: Events[EventName]) => void) => {
      const listeners = eventListeners.get(eventName) || [];
      const updatedListeners = listeners.filter(l => l !== listener);
      eventListeners.set(eventName, updatedListeners);
    },
    emit,
  };
}
