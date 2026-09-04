import Link from "next/link";
import { pageMeta } from "@/lib/page-meta";
import { requirePermission } from "@/lib/dal/permissions";
import { createClient } from "@/lib/core/supabase/server";
import { rel } from "@/lib/rel";
import PlansForm, { type PlanRow } from "./PlansForm";
import { Note, ReadOnlyNotice, SectionHead } from "../ui";

export const dynamic = "force-dynamic";

/**
 * Plans.
 *
 * The tier contract as the system enforces it, and now editable, which needs one
 * caveat said plainly on the screen: a batch snapshots these at creation, so
 * changing a number here does not rewrite work already in production. That is
 * what makes editing safe. Without the snapshot this form would silently reprice
 * every open batch.
 *
 * What is not here is what the tiers cost. Prices are the offer, not
 * configuration, and they live under Money.
 */
export default async function PlansPage() {
  const access = await requirePermission("settings");
  const canWrite = access.permissions.settings === "full";
  const supabase = await createClient();

  const { data } = await supabase
    .from("plan_entitlements")
    .select(
      "plan_id, posts_per_month, motion_videos, platforms_max, revision_rounds, first_batch_days, customization_level, monthly_call, plans(key, name, sort)"
    );

  const plans: PlanRow[] = (data ?? [])
    .map((e) => {
      const plan = rel<{ key?: string; name?: string; sort?: number }>(e.plans);
      return {
        id: e.plan_id as string,
        key: plan?.key ?? "",
        name: plan?.name ?? "",
        sort: plan?.sort ?? 0,
        posts: e.posts_per_month as number,
        motion: e.motion_videos as number,
        platforms: e.platforms_max as number,
        revisions: (e.revision_rounds as number | null) ?? null,
        firstBatchDays: e.first_batch_days as number,
        customization: e.customization_level as string,
        monthlyCall: e.monthly_call === true,
      };
    })
    .sort((a, b) => a.sort - b.sort);

  return (
    <div>
      <SectionHead {...pageMeta("/admin/settings/plans")} />

      {!canWrite && <ReadOnlyNotice />}

      <PlansForm plans={plans} canWrite={canWrite} />

      <Note>
        A batch snapshots these numbers when it is created, so a change here
        applies to the next batch and never rewrites one already in production.
        That is deliberate: a client who was promised sixteen posts is owed
        sixteen, whatever the plan says by the time the month closes.
        <br />
        <br />
        Unlimited is stored as no value rather than as a large number, so the
        portal can say unlimited instead of counting down from something
        arbitrary. Prices are not here. They are on{" "}
        <Link href="/admin/packages" className="text-[#2B50DC] dark:text-[#5B8DEF]">
          Packages
        </Link>
        , because what the platform charges is the offer rather than configuration.
      </Note>
    </div>
  );
}
