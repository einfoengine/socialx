import { Suspense } from "react";
import { pageMeta } from "@/lib/page-meta";
import Link from "next/link";
import Placeholder from "@/components/Placeholder";
import { SkeletonTiles, SkeletonCard } from "@/components/Skeleton";
import { requireOrg } from "@/lib/dal/session";
import { createClient } from "@socialx/core/supabase/server";
import { CYCLE_LABELS } from "@/lib/format";

/**
 * Overview.
 *
 * The heading and the layout are static, so they paint as soon as the response
 * opens. Everything that needs the database sits behind its own Suspense
 * boundary and streams in when it arrives, which matters here because the
 * database is roughly 400ms away and this page used to make three round trips
 * one after another before rendering a single character.
 *
 * Each module also fetches for itself rather than being handed props from a
 * parent. That is what lets them resolve independently: a parent that awaited
 * all three to pass them down would be the blocking version again with extra
 * steps.
 */
export default function PortalHome() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-grotesk text-2xl font-semibold tracking-[-0.6px] text-gray-900 dark:text-white">{pageMeta("/portal").title}</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{pageMeta("/portal").sub}</p>
      </div>

      <Suspense fallback={<SkeletonCard lines={2} />}>
        <OnboardingCallout />
      </Suspense>

      <Suspense fallback={<SkeletonTiles n={4} />}>
        <PlanTiles />
      </Suspense>

      <Placeholder title="Your calendar and approvals" release="R3">
        This is where you will review each month&apos;s batch, approve it, and request
        changes without sending a single email. Until then, delivery still runs through
        your existing channel.
      </Placeholder>
    </div>
  );
}

/* Onboarding is the only thing that matters until it is done, so it leads and it
   is the first module to resolve. */
async function OnboardingCallout() {
  const session = await requireOrg();
  const supabase = await createClient();

  const { data: brand } = await supabase
    .from("brand_profiles")
    .select("completed_at")
    .eq("org_id", session.orgId)
    .maybeSingle();

  if (brand?.completed_at) return null;

  return (
    <div className="border border-[#3D4AFF] bg-[#3D4AFF]/6 dark:bg-[#00A3FF]/10 p-6">
      <div className="font-mono text-[10px] uppercase tracking-[0.13em] text-[#3D4AFF] dark:text-[#00A3FF] mb-2">
        Start here
      </div>
      <h2 className="font-grotesk text-lg font-semibold text-gray-900 dark:text-white mb-2">
        Finish onboarding so we can build your first batch
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed max-w-[62ch] mb-5">
        Fifteen minutes, once. Until this is done we would be writing in a generic
        voice rather than yours, so nothing starts before it.
      </p>
      <Link
        href="/portal/onboarding"
        className="btn gradient-bg text-white inline-block px-6 py-3 font-grotesk font-semibold text-sm no-underline"
      >
        Start onboarding
      </Link>
    </div>
  );
}

async function PlanTiles() {
  const session = await requireOrg();
  const supabase = await createClient();

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("status, cycle_key, current_period_end, plans(name), plan_id")
    .eq("org_id", session.orgId)
    .maybeSingle();

  if (!subscription) {
    return (
      <div className="border border-black/10 dark:border-white/10 bg-white dark:bg-[#111118] p-6">
        <div className="font-grotesk text-[15px] font-semibold text-gray-900 dark:text-white mb-1">
          No active subscription on this account
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Once checkout is live in R1, your plan and billing details appear here.
        </p>
      </div>
    );
  }

  /* Entitlements hang off the plan, so this one genuinely cannot start until the
     subscription is known. Sequential because the data is sequential, not
     because the code was written that way. */
  const { data: entitlements } = subscription.plan_id
    ? await supabase
        .from("plan_entitlements")
        .select("posts_per_month, motion_videos, platforms_max, revision_rounds")
        .eq("plan_id", subscription.plan_id)
        .maybeSingle()
    : { data: null };

  const planName = (subscription.plans as { name?: string } | null)?.name ?? null;

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-black/10 dark:bg-white/10 border border-black/10 dark:border-white/10">
      <Stat label="Plan" value={planName ?? "Not set"} />
      <Stat
        label="Billing"
        value={CYCLE_LABELS[subscription.cycle_key] ?? subscription.cycle_key}
      />
      <Stat
        label="Posts per month"
        value={entitlements ? String(entitlements.posts_per_month) : "Not set"}
      />
      <Stat
        label="Revisions"
        value={
          entitlements
            ? entitlements.revision_rounds === null
              ? "Unlimited"
              : `${entitlements.revision_rounds} per batch`
            : "Not set"
        }
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white dark:bg-[#111118] p-5">
      <div className="font-mono text-[10px] uppercase tracking-[0.13em] text-gray-400 dark:text-gray-600 mb-2">
        {label}
      </div>
      <div className="font-grotesk text-lg font-semibold text-gray-900 dark:text-white">
        {value}
      </div>
    </div>
  );
}
