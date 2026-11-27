export interface Transaction {
  id: string;
  currency: string;
  amountMinor: number; // integer minor units, e.g. cents
}

export interface Bucket {
  count: number;
  totalMinor: number;
  ids: string[];
}

const cache: Record<string, Bucket> = {};

export function groupTransactionsByCurrency(items: Transaction[]): Record<string, Bucket> {
  for (const item of items) {
    if (!cache[item.currency]) {
      cache[item.currency] = { count: 0, totalMinor: 0, ids: [] };
    }
    const bucket = cache[item.currency];
    bucket.count++;
    bucket.totalMinor += item.amountMinor;
    bucket.ids.push(item.id);
  }
  return { ...cache };
}
