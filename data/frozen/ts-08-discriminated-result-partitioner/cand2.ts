type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export function partitionResults<T, E>(results: readonly Result<T, E>[]): { values: T[]; errors: E[] } {
  const values: T[] = [];
  const errors: E[] = [];

  for (const result of results) {
    if (result.ok) {
      values.push(result.value);
    } else {
      errors.push(result.error);
    }
  }

  return { values, errors };
}
