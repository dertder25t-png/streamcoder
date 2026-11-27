type DeepPartialExcept<T, K extends keyof T> = 
  Required<Pick<T, K>> & 
  Partial<Omit<T, K>> & 
  { [P in keyof T[K]]?: T[K][P] };

// Example usage:
type User = { id: string; profile: { name: string; age: number } };
type Result = DeepPartialExcept<User, "id">;
// Result must require `id: string`, while `profile` is optional and its inner properties are optional.
