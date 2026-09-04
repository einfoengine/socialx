/**
 * The four ways an order can be created.
 *
 * Deliberately not server-only, and deliberately not in the console. Both
 * applications need this vocabulary: the site app checks whether its checkout is
 * still a permitted source before it takes a card, the console renders the
 * switches and the per-site list, and the API validates what a caller claims.
 * Same split, for the same reason, as webhook-events.ts against webhooks.ts.
 *
 * The order_source enum in migration 0028 is the authority. A value here that
 * the database has never heard of is a bug this file cannot catch, so the two
 * are changed together or not at all.
 */

export const ORDER_SOURCES = [
  {
    key: "site_checkout",
    label: "Website checkout",
    help: "A buyer pays by card on an integrating website. The payment is confirmed by Stripe before anything is provisioned.",
    /** Money moves through a processor this platform can verify. */
    verified: true,
  },
  {
    key: "admin_manual",
    label: "Operator-created",
    help: "Staff record a sale taken over a call or by invoice. Paying by link or invoice is verified; marking it paid is a claim.",
    verified: false,
  },
  {
    key: "portal_upgrade",
    label: "Self-serve upgrade",
    help: "An existing client changes plan, cycle or addons from their own portal, charged against the card already on file.",
    verified: true,
  },
  {
    key: "external_api",
    label: "External system",
    help: "Another system posts the order through the API. What it says about payment is a claim, because the money moved somewhere this platform cannot see.",
    verified: false,
  },
] as const;

export type OrderSource = (typeof ORDER_SOURCES)[number]["key"];

export const ORDER_SOURCE_KEYS = ORDER_SOURCES.map((s) => s.key);

export function isOrderSource(value: string): value is OrderSource {
  return (ORDER_SOURCE_KEYS as readonly string[]).includes(value);
}

/** The platform master switch for one source, as declared in lib/settings.ts. */
export function orderSourceSettingKey(source: OrderSource): string {
  return `orders.source.${source}`;
}

/**
 * Whether payment through this source is something the platform saw happen.
 *
 * The distinction the whole trust model rests on. A card confirmed by Stripe is
 * an event; an operator ticking "paid" and an integrator posting "collected" are
 * assertions. Only the assertions are subject to orders.offline_trust, which is
 * why this is a property of the source rather than a check somebody remembers to
 * write at each call site.
 */
export function isVerifiedSource(source: OrderSource): boolean {
  return ORDER_SOURCES.find((s) => s.key === source)?.verified ?? false;
}
