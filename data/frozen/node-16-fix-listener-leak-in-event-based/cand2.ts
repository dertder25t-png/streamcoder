import type { EventEmitter } from "node:events";

export function waitForEventWithTimeout(emitter: EventEmitter, eventName: string, timeoutMs: number): Promise<unknown> {
  return new Promise<unknown>((resolve, reject) => {
    let timeoutId: NodeJS.Timeout | null = null;
    let errorHandled = false;

    const eventHandler = (payload: unknown) => {
      clearTimeout(timeoutId);
      resolve(payload);
      emitter.removeListener(eventName, eventHandler);
      emitter.removeListener("error", errorHandler);
    };

    const errorHandler = (err: Error) => {
      if (errorHandled) return;
      errorHandled = true;
      clearTimeout(timeoutId);
      reject(err);
      emitter.removeListener(eventName, eventHandler);
      emitter.removeListener("error", errorHandler);
    };

    emitter.once(eventName, eventHandler);
    emitter.once("error", errorHandler);

    timeoutId = setTimeout(() => {
      reject(new Error("timeout"));
      emitter.removeListener(eventName, eventHandler);
      emitter.removeListener("error", errorHandler);
    }, timeoutMs);
  });
}
