import "server-only";

import { cache } from "react";
import { createServiceClient } from "@/lib/core/supabase/service";
import { normalizeOrigin } from "@/lib/core/sites";

/**
 * What is configurable, declared once.
 *
 * The database stores values; this file states which keys exist, what type each
 * holds, and what the app does when the row is missing. That ordering matters.
 * A setting read straight out of a table has no defined behaviour on an empty
 * database, a fresh clone, or a preview deploy, so every read here resolves
 * against a fallback and the fallback is the shipped default rather than a
 * placeholder. Deleting a row returns the app to it.
 *
 * Adding a setting is one entry in DEFINITIONS. The General screen renders
 * itself from this list, the save action validates against it, and nothing else
 * needs to know.
 */

export type SettingKind = "string" | "number" | "boolean" | "origins" | "choice";

export type SettingDef = {
  key: string;
  label: string;
  help: string;
  kind: SettingKind;
  group: string;
  /** Used when no row exists, and when a stored value fails validation. */
  fallback: unknown;
  /**
   * The permitted values, for kind "choice" only.
   *
   * A choice rather than a boolean wherever the two states are both real
   * positions rather than on and off. "Approval" and "auto" are two policies an
   * operator picks between, and naming them is what stops the screen asking
   * "offline trust: yes or no", which answers nothing.
   */
  options?: { value: string; label: string; help: string }[];
};

export const DEFINITIONS: SettingDef[] = [
  {
    key: "platform.name",
    label: "Platform name",
    help: "What this console calls itself. Operator-facing only: it never appears on a site's portal, which wears that site's own brand.",
    kind: "string",
    group: "Platform",
    fallback: "Portal",
  },
  {
    key: "support.reply_hours",
    label: "Reply window, hours",
    help: "The response time a portal promises. Say a number the team actually hits.",
    kind: "number",
    group: "Platform",
    fallback: 24,
  },
  {
    key: "api.public_enabled",
    label: "Public API enabled",
    help: "The master switch for unauthenticated reads, across every site. Off means every /api/v1 call needs a key, whatever any site has marked public.",
    kind: "boolean",
    group: "API",
    fallback: true,
  },

  /*
   * Order sources.
   *
   * One master switch per source, and each is a kill switch rather than a
   * preference: off stops that source across every site immediately, whatever
   * any site lists in sites.order_sources. Effective enablement is the AND of
   * the two, the same shape as api.public_enabled over site_content.is_public.
   *
   * Three of the four ship off. Card payment on a website is what the platform
   * already did and stays on; the three that can create a paid account without a
   * processor confirming anything are decisions somebody makes deliberately,
   * once, rather than capabilities that appear on deploy.
   */
  {
    key: "orders.source.site_checkout",
    label: "Website checkout",
    help: "A buyer pays by card on an integrating website. This is the original path and turning it off stops new sales everywhere.",
    kind: "boolean",
    group: "Orders",
    fallback: true,
  },
  {
    key: "orders.source.admin_manual",
    label: "Operator-created orders",
    help: "Staff record a sale in the console and either send an invoice or a payment link, or mark it paid for money that arrived elsewhere.",
    kind: "boolean",
    group: "Orders",
    fallback: false,
  },
  {
    key: "orders.source.portal_upgrade",
    label: "Self-serve in the portal",
    help: "An existing client changes plan, cycle or addons from their own portal, charged against the card already on file.",
    kind: "boolean",
    group: "Orders",
    fallback: false,
  },
  {
    key: "orders.source.external_api",
    label: "External ordering systems",
    help: "Another system posts orders through POST /api/v1/orders with an orders:write key. Each site still has to list it in its own sources.",
    kind: "boolean",
    group: "Orders",
    fallback: false,
  },
  /*
   * Payments.
   *
   * Who is allowed to collect money outside this platform, and how old imported
   * billing may get before the product stops presenting it as current.
   *
   * The switch is the same shape as the order sources above and is there for the
   * same reason: which sites bill through their own processor is a commercial
   * arrangement recorded on each site, and this is the one edit that stops the
   * arrangement everywhere at once. It ships off, because a platform that has
   * never been asked to import anybody's billing should not be making outbound
   * requests with a stored secret on a schedule.
   *
   * Note what the switch does not do. Turning it off stops fetching; it does not
   * rewrite the rows already imported. A client billed by their own site is
   * billed by their own site whatever this platform's configuration says, and a
   * screen that suddenly offered them a card form here would be lying about
   * where their money goes.
   */
  {
    key: "billing.external_collection",
    label: "Sites may collect their own payments",
    help: "Lets a site be set to collect outside this platform and have its billing imported. Off stops every import immediately; rows already imported keep showing as what they are.",
    kind: "boolean",
    group: "Billing",
    fallback: false,
  },
  {
    key: "billing.feed_max_age_hours",
    label: "Imported billing is stale after, hours",
    help: "How old a fetched figure may be before the portal and the console say so. 26 suits a nightly feed with a couple of hours of slack; drop it if a site publishes hourly.",
    kind: "number",
    group: "Billing",
    fallback: 26,
  },

  {
    key: "orders.offline_trust",
    label: "Money this platform cannot verify",
    help: "How an order is treated when it is marked paid by an operator, or arrives from an external system as already collected. A card confirmed by Stripe never queues either way.",
    kind: "choice",
    group: "Orders",
    fallback: "approval",
    options: [
      {
        value: "approval",
        label: "Hold for approval",
        help: "The order waits in a queue and provisions only once someone with the approval permission signs off. Nothing is created on the strength of a claim alone.",
      },
      {
        value: "auto",
        label: "Provision immediately",
        help: "The account is built as soon as the order is marked paid, and the journal is where it is reviewed afterwards. Faster, and a wrong click or a leaked key grants a live account with no second pair of eyes.",
      },
    ],
  },
];

/*
 * What used to be here and is not any more: brand.name, support.email,
 * checkout.url and api.public_origins.
 *
 * All four described one website, which is exactly what this platform stopped
 * having. They are fields on the site record now (sites.name, support_email,
 * checkout_url) and rows in site_domains, so there is one answer per site rather
 * than one answer for whichever site got there first. Migration 0026 reads the
 * old values on its way past to build the first site row, and the stored rows
 * that remain are ignored: a key with no definition has always read as absent.
 */

export const DEFINITION_BY_KEY = new Map(DEFINITIONS.map((d) => [d.key, d]));

export type SettingsMap = Record<string, unknown>;

/*
 * Origin normalization lives in @/lib/core/sites now, because both halves of
 * the platform need the same answer: this file validates what an operator types
 * into a form, and the API compares a browser's Origin header against what was
 * stored. Two implementations of "what is an origin" is one implementation and a
 * bug waiting for the day they disagree.
 *
 * Re-exported rather than replaced at every call site, since the callers here are
 * settings forms and this is where they already look.
 */
export { normalizeOrigin };

/** Coerces a stored value to the declared type, or returns null to fall back. */
export function coerce(def: SettingDef, value: unknown): unknown | null {
  switch (def.kind) {
    case "string":
      return typeof value === "string" ? value : null;
    case "number":
      return typeof value === "number" && Number.isFinite(value) ? value : null;
    case "boolean":
      return typeof value === "boolean" ? value : null;
    case "choice": {
      if (typeof value !== "string") return null;
      /* A stored value the definition no longer lists reads as absent, so
         removing an option returns those rows to the fallback rather than
         leaving the app in a state it has no code for. */
      return def.options?.some((o) => o.value === value) ? value : null;
    }
    case "origins": {
      if (!Array.isArray(value)) return null;
      const out: string[] = [];
      for (const item of value) {
        if (typeof item !== "string") continue;
        const origin = normalizeOrigin(item);
        if (origin && !out.includes(origin)) out.push(origin);
      }
      return out;
    }
  }
}

/**
 * Every setting, resolved.
 *
 * Reads with the service role because route handlers on the API path have no
 * user session at all and still need the public-API switch. A failure of any
 * kind, including the table not existing yet, resolves to the declared defaults
 * rather than throwing: configuration going missing must not take the product
 * down, only return it to how it shipped.
 *
 * cache() deduplicates within a render pass, so a layout and three components
 * asking cost one query.
 */
export const readSettings = cache(async (): Promise<SettingsMap> => {
  const resolved: SettingsMap = Object.fromEntries(
    DEFINITIONS.map((d) => [d.key, d.fallback])
  );

  try {
    const db = createServiceClient();
    const { data, error } = await db.from("app_settings").select("key, value");
    if (error || !data) return resolved;

    for (const row of data) {
      const def = DEFINITION_BY_KEY.get(row.key as string);
      if (!def) continue;
      const value = coerce(def, row.value);
      if (value !== null) resolved[def.key] = value;
    }
  } catch {
    /* No database reachable. The defaults above are the answer. */
  }

  return resolved;
});

export async function readSetting<T>(key: string): Promise<T> {
  const all = await readSettings();
  return all[key] as T;
}
