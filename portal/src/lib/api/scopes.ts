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
 *
 * Every scope is bounded by the key's site before it is bounded by anything
 * here. `orders:read` does not mean "read orders", it means "read this site's
 * orders", and there is no scope, no combination of scopes, and no console
 * setting that widens a key past the site it was issued for. That is the
 * isolation guarantee, and it is enforced in lib/api/auth.ts rather than
 * described in this comment.
 */

export type Scope =
  | "content:read"
  | "content:write"
  | "catalog:read"
  | "orders:read"
  | "checkout:quote"
  | "checkout:write";

export const SCOPES: { key: Scope; label: string; help: string }[] = [
  {
    key: "content:read",
    label: "Read content",
    help: "GET this site's content entries. The whole set, including entries not marked public.",
  },
  {
    key: "content:write",
    label: "Write content",
    help: "PUT an existing entry's JSON. Cannot create, delete, or change what is public.",
  },
  {
    key: "catalog:read",
    label: "Read catalogue",
    help: "GET the plans, entitlements and prices this site sells, so a pricing page can render from the source rather than a copy.",
  },
  {
    key: "orders:read",
    label: "Read orders",
    help: "GET this site's subscriptions and their status. Carries the buying organization, never another site's.",
  },
  {
    key: "checkout:quote",
    label: "Price a checkout",
    help: "POST a package, cycle, add-ons and at most a coupon code, and get back what it would cost. Never public, because an endpoint that says whether a code is real is a coupon oracle.",
  },
  {
    key: "checkout:write",
    label: "Create a subscription",
    help: "POST a buyer and a basket, and get back a client secret to confirm in the browser. This is the money path: grant it only to the website that actually sells.",
  },
];

export const SCOPE_KEYS = SCOPES.map((s) => s.key);

export function isScope(value: string): value is Scope {
  return (SCOPE_KEYS as string[]).includes(value);
}
