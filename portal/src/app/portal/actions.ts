"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrg, assertNotViewingAs } from "@/lib/dal/session";
import { createClient } from "@/lib/core/supabase/server";
import { createServiceClient } from "@/lib/core/supabase/service";
import { getStripe } from "@/lib/core/stripe";
import { portalUrl } from "@/lib/core/urls";
import { portalSite } from "@/lib/sites/resolve";

/**
 * Client portal mutations.
 *
 * Clients have read access plus three narrow verbs. Approving a batch and changing
 * post status are state transitions, not table writes, so they run through here with
 * an explicit ownership check rather than through a broad RLS update policy.
 */

async function assertOwnsBatch(batchId: string) {
  const session = await requireOrg();
  assertNotViewingAs(session);
  const supabase = await createClient();

  // RLS already scopes this select to the caller's org, so a batch belonging to
  // anyone else simply does not come back.
  const { data: batch } = await supabase
    .from("batches")
    .select("id, org_id, status, revision_rounds_allowed, revision_rounds_used")
    .eq("id", batchId)
    .maybeSingle();

  if (!batch || batch.org_id !== session.orgId) redirect("/portal/approvals");
  return { session, batch };
}

export async function approveBatch(formData: FormData) {
  const batchId = String(formData.get("batch_id") ?? "");
  if (!batchId) return;

  const { session, batch } = await assertOwnsBatch(batchId);
  if (batch.status !== "in_review") return;

  const db = createServiceClient();
  const now = new Date().toISOString();

  await db.from("batches").update({ status: "approved", approved_at: now }).eq("id", batchId);
  await db.from("posts").update({ status: "approved" }).eq("batch_id", batchId).eq("status", "in_review");

  await db.from("activity_log").insert({
    actor_id: session.userId,
    org_id: session.orgId,
    entity: "batch",
    entity_id: batchId,
    action: "approved_by_client",
  });

  revalidatePath("/portal/approvals");
  redirect(`/portal/approvals/${batchId}?approved=1`);
}

export async function approvePost(formData: FormData) {
  const postId = String(formData.get("post_id") ?? "");
  const batchId = String(formData.get("batch_id") ?? "");
  if (!postId || !batchId) return;

  const { session } = await assertOwnsBatch(batchId);
  const db = createServiceClient();

  await db.from("posts").update({ status: "approved" }).eq("id", postId).eq("org_id", session.orgId);
  revalidatePath(`/portal/approvals/${batchId}`);
}

/**
 * Requests changes.
 *
 * One submission is one round, however many posts it touches. That matches what the
 * tiers actually sell: Growth buys two rounds of feedback, not two notes. The
 * database trigger refuses the insert once the allowance is spent, so the ceiling
 * holds regardless of which screen performs the write.
 */
export async function requestChanges(formData: FormData) {
  const batchId = String(formData.get("batch_id") ?? "");
  if (!batchId) return;

  const { session, batch } = await assertOwnsBatch(batchId);
  if (batch.status !== "in_review") return;

  // Collect per-post notes plus an optional batch-level note.
  const notes: { postId: string | null; note: string }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("note_")) continue;
    const text = String(value).trim();
    if (!text) continue;
    notes.push({ postId: key.slice("note_".length), note: text });
  }

  const general = String(formData.get("general_note") ?? "").trim();
  if (general) notes.push({ postId: null, note: general });

  if (notes.length === 0) {
    throw new Error("Add at least one note so we know what to change.");
  }

  const db = createServiceClient();

  // The trigger sets the round number and enforces the ceiling. Inserting the whole
  // set before incrementing means they all carry the same round.
  for (const n of notes) {
    const { error } = await db.from("revisions").insert({
      batch_id: batchId,
      post_id: n.postId,
      round: null,
      requested_by: session.userId,
      note: n.note,
      status: "open",
    });
    if (error) {
      // Surfaces the trigger's message, which names the plan's allowance.
      throw new Error(error.message);
    }
  }

  await db
    .from("batches")
    .update({
      status: "changes_requested",
      revision_rounds_used: batch.revision_rounds_used + 1,
    })
    .eq("id", batchId);

  // Only the posts actually flagged go back; the rest stay where they are.
  const flagged = notes.map((n) => n.postId).filter(Boolean) as string[];
  if (flagged.length > 0) {
    await db.from("posts").update({ status: "changes_requested" }).in("id", flagged);
  }

  await db.from("activity_log").insert({
    actor_id: session.userId,
    org_id: session.orgId,
    entity: "batch",
    entity_id: batchId,
    action: "changes_requested",
    diff: { round: batch.revision_rounds_used + 1, notes: notes.length },
  });

  revalidatePath(`/portal/approvals/${batchId}`);
}

export async function addComment(formData: FormData) {
  const session = await requireOrg();
  assertNotViewingAs(session);
  const supabase = await createClient();

  const postId = String(formData.get("post_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const batchId = String(formData.get("batch_id") ?? "");
  if (!postId || !body) return;

  // Insert as the caller so the RLS policy checks it, rather than bypassing with
  // the service role. is_internal is forced false: a client cannot write a staff note.
  await supabase.from("comments").insert({
    post_id: postId,
    author_id: session.userId,
    body,
    is_internal: false,
  });

  revalidatePath(`/portal/approvals/${batchId}`);
}

/** Sends the client to Stripe's billing portal for cards, invoices, and cancellation. */
export async function openBillingPortal() {
  const session = await requireOrg();
  assertNotViewingAs(session);
  const db = createServiceClient();

  const { data: subs } = await db
    .from("subscriptions")
    .select("source, stripe_customer_id")
    .eq("org_id", session.orgId)
    .order("updated_at", { ascending: false })
    .limit(1);

  const sub = subs?.[0] ?? null;

  /*
   * A client billed by the site that sold them has no card here to manage, and
   * this action is where that has to be said rather than on the screen that
   * renders the button. A server action is a public endpoint: the billing page
   * showing a link instead of a form proves nothing about what is posted to
   * this. What it would do otherwise is open a Stripe session against a customer
   * this platform never charged, or throw about a missing billing account, which
   * is true and tells them nothing.
   */
  if (sub?.source === "external") {
    throw new Error(
      "This workspace is billed by the company that sold it, so its card is managed there rather than here."
    );
  }

  if (!sub?.stripe_customer_id) {
    throw new Error("There is no billing account attached to this workspace yet.");
  }

  /*
   * Where Stripe sends them back to.
   *
   * This used to be NEXT_PUBLIC_SITE_URL, which is a website rather than the
   * portal, and
   * /portal/billing does not exist there: a client who changed their card was
   * returned to a 404 on somebody's homepage. The same mistake urls.ts was
   * written to stop, in a file that was not using it.
   *
   * Their own site's portal host when it has one, so the address bar does not
   * change brand halfway through a billing flow, and this deployment's portal
   * origin otherwise.
   */
  const site = await portalSite(session.orgId);
  const origin = site?.portalHost ? `https://${site.portalHost}` : portalUrl();

  const portal = await getStripe().billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${origin}/portal/billing`,
  });

  redirect(portal.url);
}
