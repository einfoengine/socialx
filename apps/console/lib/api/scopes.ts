/**
 * What an API key may do.
 *
 * Deliberately not in keys.ts, which is server-only because it holds the minting
 * and hashing. The vocabulary itself is not a secret and the console has to
 * render it, so it lives on its own where a client component can import it
 * without dragging node:crypto into the browser bundle.
 *
 * One list, read by both sides: a scope the console can grant is a scope some
 * route handler actually checks, because there is nowhere else to declare one.
 */

export type Scope = "content:read" | "content:write";

export const SCOPES: { key: Scope; label: string; help: string }[] = [
  {
    key: "content:read",
    label: "Read content",
    help: "GET the site content entries. The whole set, including entries not marked public.",
  },
  {
    key: "content:write",
    label: "Write content",
    help: "PUT an existing entry's JSON. Cannot create, delete, or change what is public.",
  },
];

export const SCOPE_KEYS = SCOPES.map((s) => s.key);

export function isScope(value: string): value is Scope {
  return (SCOPE_KEYS as string[]).includes(value);
}
