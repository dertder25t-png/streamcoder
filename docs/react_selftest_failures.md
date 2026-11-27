# React self-test failures (frozen 7B run)

Model-written self-tests that failed on all 4 candidate solutions in the frozen 7B run. Sample of 20 zero-pass records (17 React, 3 other).
Failure messages are verbatim (ANSI colour codes stripped, trimmed to 25 lines). Test code is the test block as the model wrote it.

## 1. jest-dom matcher not loaded

- Task id: `react-15-self-updating-relative-timestamp`
- Test name: displays '1h ago' for timestamps within 3600s
- Cause: jest-dom matcher not loaded. The runner has no jest-dom matchers, so toHaveTextContent is treated as a Chai property.

```text
Error: Invalid Chai property: toHaveTextContent
    at Object.proxyGetter [as get] (file:///home/caleb/Documents/claude-code-projects/streamcoder/evalkit/node_modules/chai/index.js:1639:17)
    at /home/caleb/Documents/claude-code-projects/streamcoder/evalkit/.runs/tdd--react-15-self-updating-relative-timestamp--audit0/selftest_a.test.tsx:29:34
    at file:///home/caleb/Documents/claude-code-projects/streamcoder/evalkit/node_modules/@vitest/runner/dist/index.js:146:14
    at file:///home/caleb/Documents/claude-code-projects/streamcoder/evalkit/node_modules/@vitest/runner/dist/index.js:533:11
    at runWithTimeout (file:///home/caleb/Documents/claude-code-projects/streamcoder/evalkit/node_modules/@vitest/runner/dist/index.js:39:7)
    at runTest (file:///home/caleb/Documents/claude-code-projects/streamcoder/evalkit/node_modules/@vitest/runner/dist/index.js:1056:17)
    at processTicksAndRejections (node:internal/process/task_queues:103:5)
    at runSuite (file:///home/caleb/Documents/claude-code-projects/streamcoder/evalkit/node_modules/@vitest/runner/dist/index.js:1205:15)
    at runFiles (file:///home/caleb/Documents/claude-code-projects/streamcoder/evalkit/node_modules/@vitest/runner/dist/index.js:1262:5)
    at startTests (file:///home/caleb/Documents/claude-code-projects/streamcoder/evalkit/node_modules/@vitest/runner/dist/index.js:1271:3)
```

```tsx
test("displays '1h ago' for timestamps within 3600s", async () => {
  const timestampMs = Date.now() - 3600000;
  render(<TimeAgoLabel timestampMs={timestampMs} />);
  expect(screen.getByRole('time')).toHaveTextContent('1h ago');
})
```

## 2. hook called outside a component

- Task id: `react-33-infinite-scroll-sentinel-hook`
- Test name: the returned function is a React.RefCallback
- Cause: hook called outside a component. Test calls useInfiniteScroll() directly instead of through renderHook, so React has no dispatcher (model error).

```text
TypeError: Cannot read properties of null (reading 'useRef')
    at Proxy.process.env.NODE_ENV.exports.useRef (/home/caleb/Documents/claude-code-projects/streamcoder/evalkit/node_modules/react/cjs/react.development.js:1306:33)
    at Module.useInfiniteScroll (/home/caleb/Documents/claude-code-projects/streamcoder/evalkit/.runs/tdd--react-33-infinite-scroll-sentinel-hook--audit0/solution.tsx:7:23)
    at /home/caleb/Documents/claude-code-projects/streamcoder/evalkit/.runs/tdd--react-33-infinite-scroll-sentinel-hook--audit0/selftest_b.test.tsx:20:20
    at file:///home/caleb/Documents/claude-code-projects/streamcoder/evalkit/node_modules/@vitest/runner/dist/index.js:146:14
    at file:///home/caleb/Documents/claude-code-projects/streamcoder/evalkit/node_modules/@vitest/runner/dist/index.js:533:11
    at runWithTimeout (file:///home/caleb/Documents/claude-code-projects/streamcoder/evalkit/node_modules/@vitest/runner/dist/index.js:39:7)
    at runTest (file:///home/caleb/Documents/claude-code-projects/streamcoder/evalkit/node_modules/@vitest/runner/dist/index.js:1056:17)
    at processTicksAndRejections (node:internal/process/task_queues:103:5)
    at runSuite (file:///home/caleb/Documents/claude-code-projects/streamcoder/evalkit/node_modules/@vitest/runner/dist/index.js:1205:15)
    at runFiles (file:///home/caleb/Documents/claude-code-projects/streamcoder/evalkit/node_modules/@vitest/runner/dist/index.js:1262:5)
```

```tsx
test('the returned function is a React.RefCallback', () => {
  const callback = useInfiniteScroll(() => {});
  expect(typeof callback).toBe('function');
})
```

## 3. invented label (exact text with line-number prefix)

- Task id: `react-16-code-snippet-viewer-with-line-range`
- Test name: handles invalid input
- Cause: invented label (exact text with line-number prefix). Test queries "1. console.log(...)" text; the task only says numbered lines, so the exact markup is not specified.

```text
Error: Unable to find an element with the text: 1. console.log('Hello');. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.

Ignored nodes: comments, script, style
[36m<body>[39m
  [36m<div>[39m
    [36m<div[39m
      [33mstyle[39m=[32m"font-family: monospace; white-space: pre-wrap;"[39m
    [36m>[39m
      [36m<div[39m
        [33mdata-highlighted[39m=[32m"false"[39m
        [33mstyle[39m=[32m"background-color: transparent; padding: 2px 4px; white-space: pre-wrap;"[39m
      [36m>[39m
        [0mconsole.log('Hello');\nconsole.log('World');[0m
      [36m</div>[39m
    [36m</div>[39m
  [36m</div>[39m
[36m</body>[39m
    at Proxy.waitForWrapper (/home/caleb/Documents/claude-code-projects/streamcoder/evalkit/node_modules/@testing-library/dom/dist/wait-for.js:163:27)
    at /home/caleb/Documents/claude-code-projects/streamcoder/evalkit/.runs/tdd--react-16-code-snippet-viewer-with-line-range--audit0/selftest_b.test.tsx:47:9
    at file:///home/caleb/Documents/claude-code-projects/streamcoder/evalkit/node_modules/@vitest/runner/dist/index.js:146:14
    at file:///home/caleb/Documents/claude-code-projects/streamcoder/evalkit/node_modules/@vitest/runner/dist/index.js:533:11
    at runWithTimeout (file:///home/caleb/Documents/claude-code-projects/streamcoder/evalkit/node_modules/@vitest/runner/dist/index.js:39:7)
    at runTest (file:///h
```

```tsx
test("handles invalid input", async () => {
  render(<HighlightedSnippet code="console.log('Hello');\nconsole.log('World');" highlightLines="invalid" />);
  await waitFor(() => {
    expect(screen.getByText('1. console.log(\'Hello\');')).not.toHaveAttribute('data-highlighted', 'true');
    expect(screen.getByText('2. console.log(\'World\');')).not.toHaveAttribute('data-highlighted', 'true');
  });
})
```

## 4. import-shape (symbol never imported)

- Task id: `react-23-fix-context-re-render-cascade-in`
- Test name: useUserName throws an error when invoked outside SplitStoreProvider
- Cause: import-shape (symbol never imported). Test uses useUserName without importing it from ./solution, so it is a ReferenceError at run time.

```text
AssertionError: expected [Function] to throw error including 'Store hooks must be used inside <Spli…' but got 'useUserName is not defined'
    at Proxy.<anonymous> (file:///home/caleb/Documents/claude-code-projects/streamcoder/evalkit/node_modules/@vitest/expect/dist/index.js:1509:21)
    at Proxy.<anonymous> (file:///home/caleb/Documents/claude-code-projects/streamcoder/evalkit/node_modules/@vitest/expect/dist/index.js:972:17)
    at Proxy.methodWrapper (file:///home/caleb/Documents/claude-code-projects/streamcoder/evalkit/node_modules/chai/index.js:1686:25)
    at /home/caleb/Documents/claude-code-projects/streamcoder/evalkit/.runs/tdd--react-23-fix-context-re-render-cascade-in--audit0/selftest_a.test.tsx:68:31
    at file:///home/caleb/Documents/claude-code-projects/streamcoder/evalkit/node_modules/@vitest/runner/dist/index.js:146:14
    at file:///home/caleb/Documents/claude-code-projects/streamcoder/evalkit/node_modules/@vitest/runner/dist/index.js:533:11
    at runWithTimeout (file:///home/caleb/Documents/claude-code-projects/streamcoder/evalkit/node_modules/@vitest/runner/dist/index.js:39:7)
    at runTest (file:///home/caleb/Documents/claude-code-projects/streamcoder/evalkit/node_modules/@vitest/runner/dist/index.js:1056:17)
    at processTicksAndRejections (node:internal/process/task_queues:103:5)
    at runSuite (file:///home/caleb/Documents/claude-code-projects/streamcoder/evalkit/node_modules/@vitest/runner/dist/index.js:1205:15)
```

```tsx
test("useUserName throws an error when invoked outside SplitStoreProvider", () => {
  expect(() => useUserName()).toThrowError("Store hooks must be used inside <SplitStoreProvider>");
})
```
