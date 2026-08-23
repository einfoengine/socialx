/**
 * Money and label helpers. Amounts are always cents internally, so there is one
 * place that turns them into something a person reads.
 */

export function formatMoney(cents: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export const CYCLE_LABELS: Record<string, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  half: "Half yearly",
  yearly: "Yearly",
};

/** Revision allowance, phrased the way the client portal must phrase it. */
export function revisionLabel(allowed: number | null, used: number): string {
  if (allowed === null) return "Unlimited revisions";
  const left = Math.max(0, allowed - used);
  if (left === 0) return `No revision rounds remaining (${allowed} of ${allowed} used)`;
  return `Revision round ${used + 1} of ${allowed}`;
}

/**
 * What a subscription actually costs, given a list price and the discount on its
 * rate card.
 *
 * Amounts are cents throughout. Every published percentage is a multiple of five
 * and every list price is a whole number of dollars, so the result is always a
 * whole number of cents; there is no sub-cent case to round away.
 */
export function applyDiscount(listTotalCents: number, percentOff: number, months: number) {
  const total = Math.round(listTotalCents * (1 - percentOff / 100));
  return {
    listTotal: listTotalCents,
    total,
    perMonth: Math.round(total / months),
    saving: listTotalCents - total,
    percentOff,
  };
}

export const CYCLE_MONTHS: Record<string, number> = {
  monthly: 1,
  quarterly: 3,
  half: 6,
  yearly: 12,
};
