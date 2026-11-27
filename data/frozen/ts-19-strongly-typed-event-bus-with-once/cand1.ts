type Listener<T> = (payload: T) => void;
type VoidEvent = void;

class TypedBus<Events extends Record<string, unknown>> {
  private listeners: Partial<Record<keyof Events, Listener<Events[keyof Events]>[]>> = {};

  on<Event extends keyof Events>(event: Event, listener: Listener<Events[Event]>): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event]!.push(listener);
    return () => this.off(event, listener);
  }

  once<Event extends keyof Events>(event: Event, listener: Listener<Events[Event]>): () => void {
    const onceListener = (payload: Events[Event]) => {
      listener(payload);
      this.off(event, onceListener);
    };
    return this.on(event, onceListener);
  }

  off<Event extends keyof Events>(event: Event, listener: Listener<Events[Event]>): void {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event]!.filter(l => l !== listener);
    }
  }

  emit<Event extends keyof Events>(event: Event, payload?: Events[Event]): void {
    const listeners = this.listeners[event];
    if (listeners) {
      listeners.forEach(listener => listener(payload as Events[Event]));
    }
  }
}

export function createTypedBus<Events extends Record<string, unknown>>(): TypedBus<Events> {
  return new TypedBus();
}
