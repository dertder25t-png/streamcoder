import { expect, it } from "vitest";
import { isPaymentWebhook } from "./solution";

const good = { type: "payment.settled", id: "p_1", amountCents: 1250 };

it("accepts a valid webhook, including zero amount and extra fields", () => {
  expect(isPaymentWebhook(good)).toBe(true);
  expect(isPaymentWebhook({ ...good, amountCents: 0 })).toBe(true);
  expect(isPaymentWebhook({ ...good, extra: "ok" })).toBe(true);
});

it("rejects null, primitives and arrays without throwing", () => {
  for (const v of [null, undefined, 0, 42, "payment.settled", true, [], [good], () => good]) {
    expect(isPaymentWebhook(v)).toBe(false);
  }
});

it("rejects wrong type, bad id and bad amounts", () => {
  expect(isPaymentWebhook({ ...good, type: "payment.failed" })).toBe(false);
  expect(isPaymentWebhook({ id: "p", amountCents: 1 })).toBe(false);
  expect(isPaymentWebhook({ ...good, id: "" })).toBe(false);
  expect(isPaymentWebhook({ ...good, id: 7 })).toBe(false);
  expect(isPaymentWebhook({ type: good.type, amountCents: 5 })).toBe(false);
  expect(isPaymentWebhook({ ...good, amountCents: 12.5 })).toBe(false);
  expect(isPaymentWebhook({ ...good, amountCents: -1 })).toBe(false);
  expect(isPaymentWebhook({ ...good, amountCents: "100" })).toBe(false);
  expect(isPaymentWebhook({ ...good, amountCents: NaN })).toBe(false);
  expect(isPaymentWebhook({ ...good, amountCents: Infinity })).toBe(false);
  expect(isPaymentWebhook({ type: good.type, id: "p" })).toBe(false);
});

it("narrows to typed fields without casts", () => {
  const x: unknown = JSON.parse(JSON.stringify(good));
  if (isPaymentWebhook(x)) {
    const id: string = x.id;
    const cents: number = x.amountCents;
    const t: "payment.settled" = x.type;
    expect([id, cents, t]).toEqual(["p_1", 1250, "payment.settled"]);
  } else {
    throw new Error("expected narrowing");
  }
});
