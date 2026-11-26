import { expect, it } from "vitest";
import { composeMiddleware } from "./solution";

type Ctx = { log: string[]; user?: string };

it("runs middlewares in onion order", async () => {
  const ctx: Ctx = { log: [] };
  const run = composeMiddleware<Ctx>([
    async (c, next) => {
      c.log.push("a-before");
      await next();
      c.log.push("a-after");
    },
    async (c, next) => {
      c.log.push("b-before");
      await next();
      c.log.push("b-after");
    },
    (c) => {
      c.log.push("c");
    },
  ]);
  await run(ctx);
  expect(ctx.log).toEqual(["a-before", "b-before", "c", "b-after", "a-after"]);
});

it("awaits async downstream work before the after-part runs", async () => {
  const ctx: Ctx = { log: [] };
  await composeMiddleware<Ctx>([
    async (c, next) => {
      await next();
      c.log.push("outer-after");
    },
    async (c) => {
      await Promise.resolve();
      await Promise.resolve();
      c.log.push("inner-done");
    },
  ])(ctx);
  expect(ctx.log).toEqual(["inner-done", "outer-after"]);
});

it("an empty chain resolves, and a middleware that skips next() stops the chain", async () => {
  await expect(composeMiddleware<Ctx>([])({ log: [] })).resolves.toBeUndefined();
  const ctx: Ctx = { log: [] };
  await composeMiddleware<Ctx>([
    (c) => {
      c.log.push("stop");
    },
    (c) => {
      c.log.push("never");
    },
  ])(ctx);
  expect(ctx.log).toEqual(["stop"]);
});

it("middlewares can mutate the shared context", async () => {
  const ctx: Ctx = { log: [] };
  await composeMiddleware<Ctx>([
    async (c, next) => {
      c.user = "ada";
      await next();
    },
    (c) => {
      c.log.push("user=" + c.user);
    },
  ])(ctx);
  expect(ctx.log).toEqual(["user=ada"]);
});

it("calling next() twice in one middleware rejects with an Error and runs downstream once", async () => {
  let downstream = 0;
  const run = composeMiddleware<Ctx>([
    async (_c, next) => {
      await next();
      await next();
    },
    () => {
      downstream++;
    },
  ]);
  await expect(run({ log: [] })).rejects.toBeInstanceOf(Error);
  expect(downstream).toBe(1);
});

it("each composed run has independent next() tracking", async () => {
  let downstream = 0;
  const run = composeMiddleware<Ctx>([
    async (_c, next) => {
      await next();
    },
    () => {
      downstream++;
    },
  ]);
  await run({ log: [] });
  await run({ log: [] });
  expect(downstream).toBe(2);
});

it("async errors from downstream reach upstream try/catch", async () => {
  const ctx: Ctx = { log: [] };
  await composeMiddleware<Ctx>([
    async (c, next) => {
      try {
        await next();
      } catch (e) {
        c.log.push("caught:" + (e as Error).message);
      }
    },
    async () => {
      await Promise.resolve();
      throw new Error("boom");
    },
  ])(ctx);
  expect(ctx.log).toEqual(["caught:boom"]);
});

it("synchronous throws downstream reach upstream try/catch", async () => {
  const ctx: Ctx = { log: [] };
  await composeMiddleware<Ctx>([
    async (c, next) => {
      try {
        await next();
      } catch (e) {
        c.log.push("caught:" + (e as Error).message);
      }
    },
    async (_c, next) => {
      await next();
    },
    () => {
      throw new Error("sync-boom");
    },
  ])(ctx);
  expect(ctx.log).toEqual(["caught:sync-boom"]);
});

it("uncaught errors reject the composed call and skip after-parts", async () => {
  const ctx: Ctx = { log: [] };
  const run = composeMiddleware<Ctx>([
    async (c, next) => {
      await next();
      c.log.push("after");
    },
    async () => {
      throw new Error("fatal");
    },
  ]);
  await expect(run(ctx)).rejects.toThrow("fatal");
  expect(ctx.log).toEqual([]);
});
