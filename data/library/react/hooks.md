# Effects: always clean up what you start
```tsx
useEffect(() => {
  const onResize = () => setWidth(window.innerWidth);
  window.addEventListener("resize", onResize);
  return () => window.removeEventListener("resize", onResize); // same function reference
}, []);
```
Timers (`clearTimeout`/`clearInterval`), subscriptions, observers (`disconnect()`), and listeners all need cleanup. StrictMode in development runs effects twice to expose missing cleanup.

# Fix stale closures with a "latest ref"
```tsx
const latest = useRef(callback);
useLayoutEffect(() => { latest.current = callback; }); // or useEffect
// inside timers/listeners call latest.current() instead of callback
```
Use this when a long-lived timer or listener must call the newest prop/state without being recreated.

# Ignore stale async results (race conditions)
```tsx
useEffect(() => {
  const ctrl = new AbortController();
  fetch(`/api/search?q=${q}`, { signal: ctrl.signal })
    .then(r => r.json()).then(setResults)
    .catch(e => { if (e.name !== "AbortError") setError(e); });
  return () => ctrl.abort(); // a newer query cancels the old one
}, [q]);
```
Without abort (or an `ignore` flag), a slow old response can overwrite a newer one.

# Keys in lists
Use a stable id: `items.map(i => <Row key={i.id} … />)`. Index keys break local state (inputs, focus, animations) when items are reordered, inserted or removed.

# Controlled vs uncontrolled inputs
Controlled: `value={v} onChange={e => setV(e.target.value)}`. Uncontrolled: `defaultValue` + ref. Never switch between them: keep `value` defined (use `""`, not `undefined`).
To support both in a component: `const isControlled = props.checked !== undefined; const value = isControlled ? props.checked : internal;`

# Functional state updates
`setCount(c => c + 1)` when the new value depends on the old one (batched updates, inside timers).
Never mutate state: `setItems(items => items.map(i => i.id === id ? { ...i, done: !i.done } : i))`.

# Testing hooks and components (Vitest + Testing Library)
```tsx
// @vitest-environment jsdom
import { act, renderHook, render, screen, fireEvent } from "@testing-library/react";
vi.useFakeTimers();
const { result, unmount } = renderHook(() => useMyHook());
act(() => vi.advanceTimersByTime(500));
```
