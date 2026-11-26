import type { EventEmitter } from "node:events";

export function waitForEventWithTimeout(emitter: EventEmitter, eventName: string, timeoutMs: number): Promise<unknown> {
  return new Promise<unknown>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      emitter.removeListener(eventName, onEvent);
      emitter.removeListener("error", onError);
    };
    const onEvent = (payload: unknown) => {
      cleanup();
      resolve(payload);
    };
    const onError = (err: unknown) => {
      cleanup();
      reject(err);
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out after ${timeoutMs}ms waiting for "${eventName}"`));
    }, timeoutMs);
    emitter.on(eventName, onEvent);
    if (eventName !== "error") emitter.on("error", onError);
  });
}
