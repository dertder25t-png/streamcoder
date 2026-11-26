# Writing eval questions (for teachers, students, friends)

Write the **question**, not the answer. The AI answers it; your "correct if" lines become the
automatic tests that grade it.

```
Task: what to build or fix, phrased the way you'd really ask it
Topic: TypeScript | React | Node
Difficulty: easy | hard
Must export: the exact name and signature, e.g. useDebouncedCallback(callback, delayMs)
Example (optional, required for type-only questions): input and the exact expected result
Broken code (Fix questions only): the buggy code to repair
It's correct if:
- 2 to 4 lines, each one clearly pass or fail
Solution (optional): a working answer, so we can prove the tests are fair
```

Checklist:
- Every "correct if" line must be checkable by a test: no "works correctly", "handles cleanly", "if configured".
- Easy should mean easy: something a beginner could do in 15 minutes.
- Original beats famous: avoid puzzles from popular collections or tutorials (the AI has seen them).
- One idea per question. If it needs a database, a browser plugin or the internet, skip it.
