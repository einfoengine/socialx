/**
 * Normalizes an embedded Supabase relation.
 *
 * PostgREST returns a joined table as an object for a to-one relation and an array
 * for a to-many, and the generated types are not always sure which they are looking
 * at. Rather than casting through `unknown` at every call site, funnel it here.
 */
export function rel<T>(value: unknown): T | null {
  if (Array.isArray(value)) return (value[0] as T) ?? null;
  return (value as T) ?? null;
}
