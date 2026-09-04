import { notFound } from "next/navigation";
import Link from "next/link";
import { requirePermission } from "@/lib/dal/permissions";
import { createClient } from "@/lib/core/supabase/server";
import { portalUrl } from "@/lib/core/urls";
import { siteFromRow, SITE_COLUMNS, wordmarkOf } from "@/lib/core/sites";
import type { Scope } from "@/lib/api/scopes";
import { PageHead } from "@/components/DataTable";
import { Note } from "../../settings/ui";
import { externalCollectionEnabled, recentSyncs } from "@/lib/billing/external";
import { enabledSources } from "@/lib/orders/sources";
import SiteForm from "./SiteForm";
import DomainsPanel, { type DomainRow } from "./DomainsPanel";
import KeysPanel, { type KeyRow } from "./KeysPanel";
import PaymentsPanel from "./PaymentsPanel";
import WebhooksPanel, { type DeliveryRow, type WebhookRow } from "./WebhooksPanel";

export const dynamic = "force-dynamic";

/* Enough history to answer "did it work" and "when did it stop working", and not
   so much that a busy site's record takes a second to render. */
const DELIVERY_HISTORY = 25;

/* Fewer, because a sync is one line and the question it answers is "is this
   still working", which the last handful settles. */
const SYNC_HISTORY = 6;

/**
 * One site, and everything that makes it an integration.
 *
 * The order of the panels is the order somebody actually does this in, and it is
 * the same order the integration policy describes: identity and brand, then the
 * domains that have to be proved, then the credentials that can only name a
 * proved domain, then the endpoints that carry events back. Each step is
 * genuinely blocked on the one above it, so the page reads top to bottom as the
 * work rather than as a list of settings.
 *
 * Everything is read through the caller's own session under RLS. The two things
 * deliberately never selected are api_keys.token_hash and site_webhooks.secret. A
 * hash is useless to anybody, and the secret is shown once when it is minted; a
 * column no query selects is a column no later edit can accidentally render.
 */
export default async function SitePage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const access = await requirePermission("sites");
  const canWrite = access.permissions.sites === "full";

  const supabase = await createClient();
  const { data: siteRow } = await supabase
    .from("sites")
    .select(SITE_COLUMNS)
    .eq("key", key)
    .maybeSingle();

  if (!siteRow) notFound();
  const site = siteFromRow(siteRow as Record<string, unknown>);

  /*
   * Whether a credential is stored for the billing feed, asked without reading
   * it. The column is never selected anywhere, so the only honest way to render
   * "a value is set" is a filter that cannot return the value itself.
   */
  const { count: secretCount } = await supabase
    .from("sites")
    .select("id", { count: "exact", head: true })
    .eq("id", site.id)
    .not("billing_feed_secret", "is", null);

  const [domainsRes, keysRes, hooksRes, deliveriesRes, syncs, externalEnabled, sources] = await Promise.all([
    supabase
      .from("site_domains")
      .select("id, origin, purpose, verification_token, verified_at, last_checked_at, last_error")
      .eq("site_id", site.id)
      .order("origin"),
    supabase
      .from("api_keys")
      .select(
        "id, name, prefix, scopes, allowed_origins, note, created_at, last_used_at, last_used_origin, expires_at, revoked_at"
      )
      .eq("site_id", site.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("site_webhooks")
      .select(
        "id, url, description, events, active, last_success_at, last_failure_at, consecutive_failures, disabled_reason, created_at"
      )
      .eq("site_id", site.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("webhook_deliveries")
      .select("id, webhook_id, event, status, attempts, response_status, error, created_at, delivered_at")
      .eq("site_id", site.id)
      .order("created_at", { ascending: false })
      .limit(DELIVERY_HISTORY),
    recentSyncs(site.id, SYNC_HISTORY),
    externalCollectionEnabled(),
    enabledSources(site.id),
  ]);

  /* Cut to the minute rather than formatted with Intl. These are read to answer
     "was this used today", and a stable sortable string answers that better than
     a localized one that shifts with whoever is looking. */
  const stamp = (v: unknown) =>
    typeof v === "string" ? v.slice(0, 16).replace("T", " ") : null;

  const domains: DomainRow[] = (domainsRes.data ?? []).map((d) => ({
    id: d.id as string,
    origin: d.origin as string,
    purpose: d.purpose as "browser" | "portal",
    token: d.verification_token as string,
    verifiedAt: stamp(d.verified_at),
    lastCheckedAt: stamp(d.last_checked_at),
    lastError: (d.last_error as string | null) ?? null,
  }));

  const keys: KeyRow[] = (keysRes.data ?? []).map((k) => ({
    id: k.id as string,
    name: k.name as string,
    prefix: k.prefix as string,
    scopes: ((k.scopes as string[] | null) ?? []) as Scope[],
    allowedOrigins: (k.allowed_origins as string[] | null) ?? [],
    note: (k.note as string | null) ?? "",
    createdAt: stamp(k.created_at) ?? "",
    lastUsedAt: stamp(k.last_used_at),
    lastUsedOrigin: (k.last_used_origin as string | null) ?? null,
    expiresAt: stamp(k.expires_at),
    revokedAt: stamp(k.revoked_at),
  }));

  const webhooks: WebhookRow[] = (hooksRes.data ?? []).map((w) => ({
    id: w.id as string,
    url: w.url as string,
    description: (w.description as string | null) ?? "",
    events: (w.events as string[] | null) ?? [],
    active: w.active === true,
    lastSuccessAt: stamp(w.last_success_at),
    lastFailureAt: stamp(w.last_failure_at),
    consecutiveFailures: (w.consecutive_failures as number | null) ?? 0,
    disabledReason: (w.disabled_reason as string | null) ?? null,
  }));

  const deliveries: DeliveryRow[] = (deliveriesRes.data ?? []).map((d) => ({
    id: d.id as string,
    webhookId: d.webhook_id as string,
    event: d.event as string,
    status: d.status as DeliveryRow["status"],
    attempts: (d.attempts as number | null) ?? 0,
    responseStatus: (d.response_status as number | null) ?? null,
    error: (d.error as string | null) ?? null,
    createdAt: stamp(d.created_at) ?? "",
    deliveredAt: stamp(d.delivered_at),
  }));

  const verifiedOrigins = domains
    .filter((d) => d.verifiedAt && d.purpose === "browser")
    .map((d) => d.origin);

  return (
    <div>
      <PageHead
        title={wordmarkOf(site)}
        sub={`Everything this website is on the platform. Its key is ${site.key}, and its API base is ${portalUrl("/api/v1")}.`}
      />

      <p className="-mt-4 mb-6 text-[12.5px]">
        <Link href="/admin/sites" className="text-gray-500 hover:underline">
          Back to sites
        </Link>
      </p>

      {!canWrite && <ViewOnlyNotice />}

      <SiteForm site={site} canWrite={canWrite} />

      <PaymentsPanel
        siteId={site.id}
        siteKey={site.key}
        collection={site.paymentCollection}
        feedUrl={site.billingFeedUrl}
        feedHeader={site.billingFeedHeader}
        manageUrl={site.billingManageUrl}
        hasSecret={(secretCount ?? 0) > 0}
        externalEnabled={externalEnabled}
        sellsThroughPlatformCheckout={sources.includes("site_checkout")}
        runs={syncs}
        canWrite={canWrite}
      />

      <DomainsPanel siteId={site.id} siteKey={site.key} domains={domains} canWrite={canWrite} />

      <KeysPanel
        siteId={site.id}
        siteKey={site.key}
        keys={keys}
        verifiedOrigins={verifiedOrigins}
        canWrite={canWrite}
      />

      <WebhooksPanel
        siteId={site.id}
        siteKey={site.key}
        webhooks={webhooks}
        deliveries={deliveries}
        canWrite={canWrite}
      />

      <Note>
        Nothing here reaches another site. A key resolves to this record before its
        scopes are read, content queries are filtered by it, and orders are found
        through the organizations this site sold. Suspending the site above refuses
        every credential at once, which is the fastest way to stop an integration
        that has gone wrong.
      </Note>
    </div>
  );
}

/** Sites has its own read-only line, because the shared one talks about Settings. */
function ViewOnlyNotice() {
  return (
    <div className="mb-6 border border-black/10 bg-black/[0.02] px-5 py-3.5 text-[13px] leading-relaxed text-gray-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-400">
      Your role opens Sites but does not change them. Everything below is current;
      the controls are inert.
    </div>
  );
}
