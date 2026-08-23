import "server-only";

import type Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Turns a completed Stripe checkout into a usable socialX account.
 *
 * Called from the webhook, never from the success redirect. A redirect can be lost
 * to a closed tab or a flaky network; the webhook is retried by Stripe until it
 * succeeds. That means this must be safely repeatable, so every step either finds
 * what it needs or creates it, and none of them assume they are running first.
 */

type ProvisionResult = {
  orgId: string;
  created: boolean;
  email: string;
};

export async function provisionFromCheckout(
  session: Stripe.Checkout.Session,
  subscription: Stripe.Subscription
): Promise<ProvisionResult> {
  const email = session.customer_details?.email ?? session.customer_email ?? "";
  return provision(subscription, {
    email,
    name: session.customer_details?.name ?? null,
    extraMeta: session.metadata ?? {},
  });
}

/**
 * Provision from the subscription alone.
 *
 * The embedded checkout has no Checkout Session, so the buyer's email and company
 * are carried on the subscription's own metadata instead. Everything downstream is
 * identical, which is the point: one provisioning path, whichever way they paid.
 */
export async function provisionFromSubscription(
  subscription: Stripe.Subscription
): Promise<ProvisionResult> {
  const email = subscription.metadata?.buyer_email ?? "";
  return provision(subscription, {
    email,
    // The organization is named after the company, not the person.
    name: subscription.metadata?.buyer_company || null,
    contactName: subscription.metadata?.buyer_name || null,
    phone: subscription.metadata?.buyer_phone || null,
    extraMeta: {},
  });
}

async function provision(
  subscription: Stripe.Subscription,
  buyer: {
    email: string;
    name: string | null;
    contactName?: string | null;
    phone?: string | null;
    extraMeta: Record<string, string>;
  }
): Promise<ProvisionResult> {
  const db = createServiceClient();

  const email = buyer.email;
  if (!email) throw new Error("This subscription carried no email address.");

  const meta = { ...buyer.extraMeta, ...subscription.metadata };
  const planKey = meta.plan_key;
  const cycleKey = meta.cycle_key;
  const rateCardKey = meta.rate_card_key;

  if (!planKey || !cycleKey || !rateCardKey) {
    throw new Error("Checkout session is missing plan metadata.");
  }

  const { data: plan } = await db
    .from("plans")
    .select("id, name")
    .eq("key", planKey)
    .single();
  if (!plan) throw new Error(`Unknown plan "${planKey}".`);

  const { data: ent } = await db
    .from("plan_entitlements")
    .select("posts_per_month, motion_videos, platforms_max, revision_rounds, first_batch_days")
    .eq("plan_id", plan.id)
    .single();

  // 1. Organization. Keyed on the Stripe subscription so a retry finds the same one.
  const { data: existingSub } = await db
    .from("subscriptions")
    .select("org_id")
    .eq("stripe_subscription_id", subscription.id)
    .maybeSingle();

  let orgId = existingSub?.org_id ?? null;
  let created = false;

  if (!orgId) {
    // A returning buyer keeps their existing organization.
    const { data: byEmail } = await db
      .from("organizations")
      .select("id")
      .eq("owner_email", email)
      .maybeSingle();

    if (byEmail) {
      orgId = byEmail.id;
    } else {
      const companyName = buyer.name?.trim() || deriveOrgNameFromEmail(email);
      const { data: org, error } = await db
        .from("organizations")
        .insert({
          name: companyName,
          slug: await uniqueSlug(db, companyName),
          status: "onboarding",
          source: "stripe",
          owner_email: email,
          owner_name: buyer.contactName ?? null,
          owner_phone: buyer.phone ?? null,
        })
        .select("id")
        .single();
      if (error || !org) throw new Error(`Could not create the organization: ${error?.message}`);
      orgId = org.id;
      created = true;
    }
  }

  // 2. Subscription record.
  await db.from("subscriptions").upsert(
    {
      org_id: orgId,
      plan_id: plan.id,
      cycle_key: cycleKey,
      rate_card_key: rateCardKey,
      stripe_customer_id:
        typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id ?? null,
      stripe_subscription_id: subscription.id,
      status: mapStatus(subscription.status),
      current_period_start: toIso(subscriptionPeriod(subscription).start),
      current_period_end: toIso(subscriptionPeriod(subscription).end),
      cancel_at_period_end: subscription.cancel_at_period_end,
      addon_keys: (meta.addon_keys ?? "").split(",").filter(Boolean),
      started_at: toIso(subscription.start_date),
    },
    { onConflict: "stripe_subscription_id" }
  );

  // 3. The buyer's login. createUser is idempotent enough: a duplicate simply errors
  // and we fall back to finding them.
  const userId = await ensureUser(db, email, buyer.contactName ?? null);
  if (userId) {
    await db
      .from("profiles")
      .update({
        full_name: buyer.contactName ?? undefined,
        phone: buyer.phone ?? undefined,
      })
      .eq("id", userId);

    await db
      .from("memberships")
      .upsert({ org_id: orgId, user_id: userId, role: "owner" }, { onConflict: "org_id,user_id" });
  }

  // 4. First batch shell, so the turnaround promise is a dated commitment from the
  // moment they pay rather than something someone remembers to create.
  if (ent) {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const due = new Date(now.getTime() + ent.first_batch_days * 86400000);

    await db.from("batches").upsert(
      {
        org_id: orgId,
        period_start: periodStart.toISOString().slice(0, 10),
        period_end: periodEnd.toISOString().slice(0, 10),
        status: "draft",
        due_at: due.toISOString(),
        quota_posts: ent.posts_per_month,
        quota_motion: ent.motion_videos,
        quota_platforms: ent.platforms_max,
        revision_rounds_allowed: ent.revision_rounds,
      },
      { onConflict: "org_id,period_start", ignoreDuplicates: true }
    );
  }

  // 5. Trail.
  await db.from("activity_log").insert({
    org_id: orgId,
    entity: "subscription",
    entity_id: null,
    action: created ? "provisioned" : "subscription_updated",
    diff: {
      plan: planKey,
      cycle: cycleKey,
      rate_card: rateCardKey,
      stripe_subscription: subscription.id,
    },
  });

  return { orgId, created, email };
}

/** Keeps subscriptions in step on later Stripe events. */
export async function syncSubscription(subscription: Stripe.Subscription) {
  const db = createServiceClient();
  const period = subscriptionPeriod(subscription);

  await db
    .from("subscriptions")
    .update({
      status: mapStatus(subscription.status),
      current_period_start: toIso(period.start),
      current_period_end: toIso(period.end),
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: toIso(subscription.canceled_at),
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id);
}

export async function recordInvoice(invoice: Stripe.Invoice) {
  const db = createServiceClient();

  const subId = subscriptionIdOf(invoice);
  if (!subId) return;

  const { data: sub } = await db
    .from("subscriptions")
    .select("org_id")
    .eq("stripe_subscription_id", subId)
    .maybeSingle();
  if (!sub) return;

  await db.from("invoices").upsert(
    {
      org_id: sub.org_id,
      stripe_invoice_id: invoice.id,
      number: invoice.number,
      amount_due: invoice.amount_due,
      amount_paid: invoice.amount_paid,
      currency: invoice.currency,
      status: invoice.status,
      hosted_invoice_url: invoice.hosted_invoice_url,
      pdf_url: invoice.invoice_pdf,
      period_start: toIso(invoice.period_start),
      period_end: toIso(invoice.period_end),
      issued_at: toIso(invoice.created),
    },
    { onConflict: "stripe_invoice_id" }
  );
}

/**
 * Dunning. A failed payment does not stop delivery immediately, because a card can
 * fail for reasons that resolve in a day. It flags the account; the hold is applied
 * further down the escalation.
 */
export async function markPastDue(invoice: Stripe.Invoice) {
  const db = createServiceClient();
  const subId = subscriptionIdOf(invoice);
  if (!subId) return;

  await db
    .from("subscriptions")
    .update({ status: "past_due", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", subId);
}

export async function clearPastDue(invoice: Stripe.Invoice) {
  const db = createServiceClient();
  const subId = subscriptionIdOf(invoice);
  if (!subId) return;

  await db
    .from("subscriptions")
    .update({ status: "active", delivery_hold: false, updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", subId)
    .eq("status", "past_due");
}

// ---------------------------------------------------------------------------

function mapStatus(s: Stripe.Subscription.Status): string {
  const map: Record<string, string> = {
    active: "active",
    trialing: "trialing",
    past_due: "past_due",
    canceled: "canceled",
    unpaid: "past_due",
    incomplete: "incomplete",
    incomplete_expired: "canceled",
    paused: "paused",
  };
  return map[s] ?? "incomplete";
}

/**
 * Period dates moved onto the subscription item in recent Stripe API versions, with
 * the top-level fields kept for older ones. Read both so a version bump does not
 * silently null out every renewal date.
 */
function subscriptionPeriod(sub: Stripe.Subscription): { start: number | null; end: number | null } {
  const item = sub.items?.data?.[0] as
    | (Stripe.SubscriptionItem & { current_period_start?: number; current_period_end?: number })
    | undefined;
  const legacy = sub as unknown as { current_period_start?: number; current_period_end?: number };

  return {
    start: item?.current_period_start ?? legacy.current_period_start ?? null,
    end: item?.current_period_end ?? legacy.current_period_end ?? null,
  };
}

function subscriptionIdOf(invoice: Stripe.Invoice): string | null {
  const inv = invoice as unknown as {
    subscription?: string | { id: string } | null;
    parent?: { subscription_details?: { subscription?: string | { id: string } } };
  };
  const direct = inv.subscription;
  if (typeof direct === "string") return direct;
  if (direct && typeof direct === "object") return direct.id;

  const nested = inv.parent?.subscription_details?.subscription;
  if (typeof nested === "string") return nested;
  if (nested && typeof nested === "object") return nested.id;
  return null;
}

function toIso(seconds: number | null | undefined): string | null {
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

/** A usable company name when the buyer did not give one. */
function deriveOrgNameFromEmail(email: string): string {
  const domain = email.split("@")[1] ?? "";
  const base = domain.split(".")[0];
  if (base && !["gmail", "outlook", "yahoo", "hotmail", "icloud", "proton"].includes(base)) {
    return base.charAt(0).toUpperCase() + base.slice(1);
  }
  return email.split("@")[0];
}

async function uniqueSlug(
  db: ReturnType<typeof createServiceClient>,
  name: string
): Promise<string> {
  const base =
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "client";

  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const { data } = await db.from("organizations").select("id").eq("slug", candidate).maybeSingle();
    if (!data) return candidate;
  }
  return `${base}-${Date.now()}`;
}

async function ensureUser(
  db: ReturnType<typeof createServiceClient>,
  email: string,
  fullName?: string | null
): Promise<string | null> {
  const { data: created, error } = await db.auth.admin.createUser({
    email,
    email_confirm: true,
    ...(fullName ? { user_metadata: { full_name: fullName } } : {}),
  });
  if (created?.user) return created.user.id;

  // Already exists: find them rather than failing the whole provisioning run.
  if (error) {
    const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const found = list?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    return found?.id ?? null;
  }
  return null;
}
