import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripe, isStripeConfigured } from "@socialx/core/stripe";
import { createServiceClient } from "@socialx/core/supabase/service";
import {
  provisionFromCheckout,
  provisionFromSubscription,
  syncSubscription,
  recordInvoice,
  markPastDue,
  clearPastDue,
} from "@/lib/billing/provision";

/**
 * Stripe webhook. This, not the success redirect, is what provisions an account.
 *
 * Node runtime because signature verification needs the raw body, and Stripe's
 * crypto does not run on Edge.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET is not set" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const stripe = getStripe();
  const raw = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, signature, secret);
  } catch (err) {
    // An unverifiable payload is not a Stripe event. Refuse it.
    const message = err instanceof Error ? err.message : "unknown";
    return NextResponse.json({ error: `Signature verification failed: ${message}` }, { status: 400 });
  }

  const db = createServiceClient();

  // Idempotency. Stripe retries on any non-2xx and can deliver the same event more
  // than once even on success, so a replay must be a no-op rather than a second
  // organization.
  const { data: seen } = await db
    .from("stripe_events")
    .select("id, processed_at")
    .eq("id", event.id)
    .maybeSingle();

  if (seen?.processed_at) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  if (!seen) {
    await db.from("stripe_events").insert({ id: event.id, type: event.type });
  }

  try {
    await handle(event, stripe);
    await db
      .from("stripe_events")
      .update({ processed_at: new Date().toISOString(), error: null })
      .eq("id", event.id);

    return NextResponse.json({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    await db.from("stripe_events").update({ error: message }).eq("id", event.id);

    // 500 so Stripe retries. The event stays unprocessed, and the error is stored
    // for whoever looks at why.
    console.error(`[stripe] ${event.type} ${event.id} failed:`, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function handle(event: Stripe.Event, stripe: Stripe) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription") return;

      const subId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;
      if (!subId) throw new Error("Checkout session has no subscription.");

      const subscription = await stripe.subscriptions.retrieve(subId);
      const result = await provisionFromCheckout(session, subscription);
      console.log(
        `[stripe] provisioned org ${result.orgId} for ${result.email} (${result.created ? "new" : "existing"})`
      );
      return;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;

      /*
       * The embedded checkout creates the subscription incomplete and it only
       * becomes active once the card is confirmed, so provisioning waits for that
       * rather than firing on creation. An incomplete subscription is somebody who
       * opened the form, not somebody who paid.
       *
       * provision() is idempotent, so the later updated events are harmless.
       */
      const paid = sub.status === "active" || sub.status === "trialing";
      if (paid && sub.metadata?.buyer_email) {
        const result = await provisionFromSubscription(sub);
        console.log(
          `[stripe] provisioned org ${result.orgId} for ${result.email} (${result.created ? "new" : "existing"})`
        );
      }

      await syncSubscription(sub);
      return;
    }

    case "customer.subscription.deleted": {
      await syncSubscription(event.data.object as Stripe.Subscription);
      return;
    }

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      await recordInvoice(invoice);
      await clearPastDue(invoice);
      return;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      await recordInvoice(invoice);
      await markPastDue(invoice);
      return;
    }

    default:
      // Everything else is acknowledged and ignored on purpose, so Stripe stops
      // retrying events this app has no opinion about.
      return;
  }
}
