"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/dal/permissions";
import { createServiceClient } from "@/lib/supabase/service";
import { getStripe } from "@/lib/stripe";

/**
 * Coupon management.
 *
 * A coupon exists in two places and both have to agree: a row here, and a Stripe
 * coupon that checkout actually applies. Stripe is created first, because a row
 * pointing at a coupon that does not exist would fail silently at the moment
 * somebody tries to pay.
 */

const KINDS = ["regular", "launch"] as const;
const CYCLES = ["monthly", "quarterly", "half", "yearly"] as const;

export async function createCoupon(formData: FormData) {
  const session = await requirePermission("coupons", "full");

  const kind = String(formData.get("kind") ?? "regular");
  const rawCode = String(formData.get("code") ?? "").trim().toUpperCase();
  const percent = Number(formData.get("percent_off") ?? 0);
  const cycleRaw = String(formData.get("cycle_key") ?? "").trim();
  const cycle = CYCLES.includes(cycleRaw as (typeof CYCLES)[number]) ? cycleRaw : null;
  const autoApply = formData.get("auto_apply") === "on";
  const maxRedemptions = Number(formData.get("max_redemptions") ?? 0) || null;
  const redeemBy = String(formData.get("redeem_by") ?? "").trim() || null;
  const name = String(formData.get("name") ?? "").trim();

  if (!KINDS.includes(kind as (typeof KINDS)[number])) return;
  if (!rawCode || !/^[A-Z0-9-]{3,40}$/.test(rawCode)) {
    throw new Error("A code uses letters, numbers and hyphens, 3 to 40 characters.");
  }
  if (!(percent > 0 && percent <= 100)) {
    throw new Error("The discount has to be between 1 and 100 percent.");
  }
  /*
   * An auto-applying coupon needs a cycle. Without one it would attach to every
   * checkout including monthly, which gives away a commitment discount to someone
   * making no commitment.
   */
  if (autoApply && !cycle) {
    throw new Error("An automatic coupon needs a billing cycle, or it would apply to monthly too.");
  }

  const db = createServiceClient();

  const { data: clash } = await db.from("coupons").select("id").eq("code", rawCode).maybeSingle();
  if (clash) throw new Error(`The code ${rawCode} is already in use.`);

  /*
   * duration forever, matching the standing offers: whoever buys on this coupon
   * keeps the rate at every renewal until it is removed from their subscription.
   * The percentage is in the Stripe id, so changing it later creates a new coupon
   * rather than silently repricing everyone already on it.
   */
  const stripeId = `sx_${kind}_${cycle ?? "any"}_${Math.round(percent)}_${rawCode.toLowerCase()}`.slice(0, 60);

  const stripe = getStripe();
  let stripeCouponId: string;
  try {
    const existing = await stripe.coupons.retrieve(stripeId).catch(() => null);
    stripeCouponId =
      existing?.valid
        ? existing.id
        : (
            await stripe.coupons.create({
              id: stripeId,
              percent_off: percent,
              duration: "forever",
              name: name || `socialX ${rawCode}`,
              ...(maxRedemptions ? { max_redemptions: maxRedemptions } : {}),
              ...(redeemBy ? { redeem_by: Math.floor(new Date(redeemBy).getTime() / 1000) } : {}),
              metadata: { kind, cycle_key: cycle ?? "", code: rawCode },
            })
          ).id;
  } catch (err) {
    throw new Error(
      `Stripe refused the coupon: ${err instanceof Error ? err.message : "unknown error"}`
    );
  }

  const { error } = await db.from("coupons").insert({
    code: rawCode,
    name: name || `${kind} ${percent}% off`,
    kind,
    percent_off: percent,
    cycle_key: cycle,
    auto_apply: autoApply,
    stripe_coupon_id: stripeCouponId,
    max_redemptions: maxRedemptions,
    redeem_by: redeemBy,
    created_by: session.userId,
  });

  if (error) {
    // The unique index on (kind, cycle) for auto-applying coupons lands here.
    throw new Error(
      error.message.includes("coupons_one_auto_per_kind_cycle")
        ? `There is already an automatic ${kind} coupon for that cycle. Turn the old one off first.`
        : error.message
    );
  }

  revalidatePath(`/admin/coupons/${kind}`);
}

export async function toggleCoupon(formData: FormData) {
  await requirePermission("coupons", "full");
  const id = String(formData.get("id") ?? "");
  const next = formData.get("active") === "true";
  if (!id) return;

  const db = createServiceClient();
  await db.from("coupons").update({ is_active: next }).eq("id", id);
  revalidatePath("/admin/coupons/regular");
  revalidatePath("/admin/coupons/launch");
}

export async function deleteCoupon(formData: FormData) {
  await requirePermission("coupons", "full");
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const db = createServiceClient();
  const { data: coupon } = await db
    .from("coupons")
    .select("stripe_coupon_id, times_redeemed")
    .eq("id", id)
    .maybeSingle();

  /*
   * A coupon somebody has already used is switched off, never deleted. Deleting it
   * would leave live subscriptions pointing at a discount nothing can explain.
   */
  if (coupon && coupon.times_redeemed > 0) {
    await db.from("coupons").update({ is_active: false }).eq("id", id);
  } else {
    if (coupon?.stripe_coupon_id) {
      await getStripe().coupons.del(coupon.stripe_coupon_id).catch(() => undefined);
    }
    await db.from("coupons").delete().eq("id", id);
  }

  revalidatePath("/admin/coupons/regular");
  revalidatePath("/admin/coupons/launch");
}
