/**
 * How a site takes money, stated once for everything that needs to know.
 *
 * Deliberately not server-only, and deliberately not in the console. The same
 * two words appear on a console form, on a portal billing screen and in the
 * importer, and a third spelling of "external" would be a bug that renders
 * rather than a bug that throws. Same split, for the same reason, as
 * order-sources.ts against lib/orders/sources.ts.
 *
 * The billing_source enum in migration 0030 is the authority. A value here the
 * database has never heard of is a bug this file cannot catch, so the two are
 * changed together or not at all.
 */

export type BillingSource = "platform" | "external";

export const PAYMENT_COLLECTION: {
  key: BillingSource;
  label: string;
  help: string;
}[] = [
  {
    key: "platform",
    label: "This platform collects",
    help: "Card payments run through the platform's own processor. Subscriptions and invoices are kept in step by the payment webhook, and a client changes their card in the hosted billing portal.",
  },
  {
    key: "external",
    label: "The site collects",
    help: "Money is taken somewhere this platform never sees. Billing state is fetched from a feed the site publishes, and the portal shows it as a read-only record with the site's own management link.",
  },
];

export function isBillingSource(value: string): value is BillingSource {
  return value === "platform" || value === "external";
}

/**
 * The subscription states this platform has.
 *
 * A feed reports whatever its own system calls things, and the sub_status enum
 * is what the database will accept. Mapping is done here rather than at the
 * point of import so the vocabulary and its synonyms sit next to each other,
 * which is the only way the list of synonyms ever gets extended correctly.
 */
export const SUB_STATUSES = [
  "incomplete",
  "trialing",
  "active",
  "past_due",
  "paused",
  "canceled",
] as const;

export type SubStatus = (typeof SUB_STATUSES)[number];

const STATUS_SYNONYMS: Record<string, SubStatus> = {
  trial: "trialing",
  trialling: "trialing",
  on_trial: "trialing",
  live: "active",
  current: "active",
  unpaid: "past_due",
  overdue: "past_due",
  pastdue: "past_due",
  delinquent: "past_due",
  paused: "paused",
  on_hold: "paused",
  cancelled: "canceled",
  canceled: "canceled",
  ended: "canceled",
  expired: "canceled",
  pending: "incomplete",
};

/**
 * Reads a feed's status word, or returns null.
 *
 * Null rather than a default, and this is the whole point of the function. A
 * status nobody recognizes could mean anything, and guessing "active" would
 * start delivery for somebody who stopped paying while guessing "canceled" would
 * stop it for somebody who did not. An unreadable status is a row the importer
 * refuses and names, which somebody then fixes at the source.
 */
export function readSubStatus(raw: unknown): SubStatus | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if ((SUB_STATUSES as readonly string[]).includes(value)) return value as SubStatus;
  return STATUS_SYNONYMS[value] ?? null;
}

/**
 * Whether this platform is willing to fetch a billing feed from this URL, and
 * what to say if not.
 *
 * https everywhere except loopback, the same rule domain verification and
 * webhook endpoints already hold to and for the same reason: the request carries
 * a shared secret in a header and the response carries customers' email
 * addresses and what they pay. Loopback is allowed because somebody building an
 * integration on their own machine is a real case and there is nothing on the
 * wire to protect.
 */
export function feedUrlProblem(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return "That is not a URL. Write it like https://example.com/billing/feed.";
  }

  if (url.protocol === "https:") return null;
  if (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    return null;
  }
  return "Use https for anything that is not localhost. The request carries your secret and the answer carries customer data.";
}

/**
 * How old imported billing may be before it is called stale.
 *
 * Not a constant: it is the billing.feed_max_age_hours setting, because a site
 * publishing hourly and a site publishing nightly are both reasonable and only
 * an operator knows which they agreed to. This is the shape of the answer, kept
 * here so the console and the portal describe staleness in the same words.
 */
export function freshness(
  syncedAt: string | null,
  maxAgeHours: number
): { ageHours: number | null; stale: boolean; label: string } {
  if (!syncedAt) return { ageHours: null, stale: true, label: "never fetched" };

  const then = Date.parse(syncedAt);
  if (Number.isNaN(then)) return { ageHours: null, stale: true, label: "never fetched" };

  const ageHours = (Date.now() - then) / 3_600_000;
  const stale = ageHours > maxAgeHours;

  if (ageHours < 1) return { ageHours, stale, label: "updated in the last hour" };
  if (ageHours < 48) {
    const hours = Math.round(ageHours);
    return { ageHours, stale, label: `updated ${hours} hour${hours === 1 ? "" : "s"} ago` };
  }
  const days = Math.round(ageHours / 24);
  return { ageHours, stale, label: `updated ${days} days ago` };
}
