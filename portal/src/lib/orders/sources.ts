import "server-only";

import { cache } from "react";
import { createServiceClient } from "@/lib/core/supabase/service";
import {
  ORDER_SOURCES,
  isOrderSource,
  isVerifiedSource,
  orderSourceSettingKey,
  type OrderSource,
} from "@/lib/core/order-sources";
import { readSettings } from "@/lib/settings";

/**
 * May this site take an order through this source, and what happens when it does.
 *
 * One function, called by all four surfaces, because the alternative is four
 * places that each decide for themselves whether selling is currently allowed
 * and one of them being wrong after the next change. A source is permitted only
 * when both levels agree:
 *
 *   the platform master switch   orders.source.<key> in app_settings
 *   the site's own list          sites.order_sources
 *
 * The AND is the point rather than an implementation detail. The switch is an
 * incident control: one edit stops a source across every site without touching
 * a customer's configuration, and turning it back on restores exactly what each
 * site had chosen rather than whatever an operator can remember. The list is the
 * commercial arrangement: what this particular integrator agreed to sell
 * through. Neither can be inferred from the other.
 *
 * Both fail closed. A site that has not been given any source sells nothing, a
 * site that cannot be resolved sells nothing, and an unreachable database sells
 * nothing. That is the correct direction for a check standing in front of
 * account creation: the cost of a false refusal is a support message, and the
 * cost of a false permit is an account somebody did not pay for.
 */

export type TrustPolicy = "approval" | "auto";

export type SourceDecision = {
  allowed: boolean;
  /** Populated only when allowed is false, and written to be shown to staff. */
  reason: string | null;
  /**
   * Where an order from this source lands once it is marked paid.
   *
   * `paid` provisions immediately. `awaiting_approval` waits for somebody to
   * sign off. A source whose payment a processor confirmed is never held,
   * whatever the policy says, because there is nothing left to take on trust.
   */
  onPaid: "paid" | "awaiting_approval";
};

const REFUSED: SourceDecision = {
  allowed: false,
  reason: "Ordering is not available.",
  onPaid: "awaiting_approval",
};

/** The platform-wide policy for money this platform did not see move. */
export async function trustPolicy(): Promise<TrustPolicy> {
  const settings = await readSettings();
  return settings["orders.offline_trust"] === "auto" ? "auto" : "approval";
}

/**
 * The sources one site may currently use.
 *
 * cache() deduplicates within a render pass, so a screen rendering four toggles
 * and a form checking one costs a single query.
 */
export const enabledSources = cache(async (siteId: string | null): Promise<OrderSource[]> => {
  if (!siteId) return [];

  const settings = await readSettings();

  let listed: string[] = [];
  try {
    const db = createServiceClient();
    /* cross-site: reads one site by primary key, which is narrower than a site
       filter rather than wider than one. */
    const { data } = await db
      .from("sites")
      .select("status, order_sources")
      .eq("id", siteId)
      .maybeSingle();

    /* A draft or suspended site authenticates nothing and sells nothing. Same
       rule as P2 in the integration policy, applied at the point of sale rather
       than only at the point of authentication, because an operator creating an
       order in the console never passes through lib/api/auth.ts. */
    if (!data || data.status !== "active") return [];
    listed = Array.isArray(data.order_sources) ? (data.order_sources as string[]) : [];
  } catch {
    /* No answer is not a yes. */
    return [];
  }

  return listed
    .filter(isOrderSource)
    .filter((source) => settings[orderSourceSettingKey(source)] === true);
});

/** The full decision for one source, including what a paid order does next. */
export async function decideSource(
  siteId: string | null,
  source: OrderSource
): Promise<SourceDecision> {
  if (!siteId) return { ...REFUSED, reason: "This request does not belong to a site." };

  const allowed = await enabledSources(siteId);
  if (!allowed.includes(source)) {
    const label = ORDER_SOURCES.find((s) => s.key === source)?.label ?? source;
    return {
      ...REFUSED,
      reason: `${label} is not enabled for this site. Turn it on under Settings and on the site record.`,
    };
  }

  if (isVerifiedSource(source)) {
    return { allowed: true, reason: null, onPaid: "paid" };
  }

  const policy = await trustPolicy();
  return {
    allowed: true,
    reason: null,
    onPaid: policy === "auto" ? "paid" : "awaiting_approval",
  };
}
