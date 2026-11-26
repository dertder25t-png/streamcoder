export interface Transaction {
  id: string;
  currency: string;
  amountMinor: number;
}

export interface Bucket {
  count: number;
  totalMinor: number;
  ids: string[];
}

export function groupTransactionsByCurrency(items: Transaction[]): Record<string, Bucket> {
  const result: Record<string, Bucket> = {};
  for (const item of items) {
    const bucket = (result[item.currency] ??= { count: 0, totalMinor: 0, ids: [] });
    bucket.count += 1;
    bucket.totalMinor += item.amountMinor;
    bucket.ids.push(item.id);
  }
  return result;
}
