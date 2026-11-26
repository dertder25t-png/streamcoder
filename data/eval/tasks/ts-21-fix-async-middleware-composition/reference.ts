export type Middleware<Ctx> = (ctx: Ctx, next: () => Promise<void>) => Promise<void> | void;

export function composeMiddleware<Ctx>(
  middlewares: readonly Middleware<Ctx>[],
): (ctx: Ctx) => Promise<void> {
  return (ctx: Ctx): Promise<void> => {
    let lastIndex = -1;
    const dispatch = async (i: number): Promise<void> => {
      if (i <= lastIndex) throw new Error("next() called multiple times");
      lastIndex = i;
      const fn = middlewares[i];
      if (!fn) return;
      await fn(ctx, () => dispatch(i + 1));
    };
    return dispatch(0);
  };
}
