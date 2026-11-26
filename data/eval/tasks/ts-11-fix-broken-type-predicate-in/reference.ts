export interface PaymentWebhook {
  type: "payment.settled";
  id: string;
  amountCents: number;
}

export function isPaymentWebhook(payload: unknown): payload is PaymentWebhook {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return false;
  const p = payload as Record<string, unknown>;
  return (
    p.type === "payment.settled" &&
    typeof p.id === "string" &&
    p.id.length > 0 &&
    typeof p.amountCents === "number" &&
    Number.isInteger(p.amountCents) &&
    p.amountCents >= 0
  );
}
