import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/lib/dal/permissions";
import { createClient } from "@socialx/core/supabase/server";
import { PageHead, Table, Row, Cell } from "@/components/DataTable";
import { rel } from "@/lib/rel";

export const metadata: Metadata = { title: "Settings | socialX Admin" };

/**
 * Operational configuration.
 *
 * What socialX sells and what it charges is not configuration, so packages,
 * prices and coupons live under Money. What is left here is the machinery the
 * delivery side reads: entitlements, which rate card is live, and the pillar mix.
 */
export default async function SettingsPage() {
  await requirePermission("settings");
  const supabase = await createClient();

  const [{ data: ents }, { data: cards }, { data: pillars }, { data: features }] =
    await Promise.all([
      supabase
        .from("plan_entitlements")
        .select(
          "posts_per_month, motion_videos, platforms_max, revision_rounds, first_batch_days, customization_level, monthly_call, plans(key, name, sort)"
        ),
      supabase.from("rate_cards").select("key, label, is_active, active_from, active_to").order("sort"),
      supabase.from("pillars").select("key, name, default_mix_pct").order("sort"),
      supabase.from("hl_features").select("id", { count: "exact", head: false }).limit(1),
    ]);

  const sortedEnts = (ents ?? []).sort(
    (a, b) =>
      (rel<{ sort?: number }>(a.plans)?.sort ?? 0) - (rel<{ sort?: number }>(b.plans)?.sort ?? 0)
  );

  return (
    <div>
      <PageHead
        title="Settings"
        sub="The machinery delivery reads. Read only by design: these change in the seed files and are applied with the migration runner."
      />

      <H>Access</H>
      <div className="border border-black/10 dark:border-white/10 bg-white dark:bg-[#111118] p-5 text-[13.5px] text-gray-600 dark:text-gray-400 leading-relaxed max-w-[78ch]">
        What each staff role can reach is set on{" "}
        <Link href="/admin/settings/permissions" className="text-[#3D4AFF] dark:text-[#00A3FF]">
          Access
        </Link>
        . Roles are assigned per person on{" "}
        <Link href="/admin/people" className="text-[#3D4AFF] dark:text-[#00A3FF]">People</Link>.
        Unlike the rest of this screen, access is editable, and only a staff owner can change it.
      </div>

      <H>Plan and context</H>
      <div className="border border-black/10 dark:border-white/10 bg-white dark:bg-[#111118] p-5 text-[13.5px] text-gray-600 dark:text-gray-400 leading-relaxed max-w-[78ch]">
        Build context, locked decisions and ideas worth keeping live in{" "}
        <Link href="/admin/journal" className="text-[#3D4AFF] dark:text-[#00A3FF]">
          Plan &amp; Context
        </Link>
        . It has its own access level, so a role can be given it without being given
        the rest of Settings.
      </div>

      <H>Where pricing lives now</H>
      <div className="border border-black/10 dark:border-white/10 bg-white dark:bg-[#111118] p-5 text-[13.5px] text-gray-600 dark:text-gray-400 leading-relaxed max-w-[78ch]">
        Packages, list prices and discount coupons moved to{" "}
        <Link href="/admin/packages" className="text-[#2B50DC] dark:text-[#5B8DEF]">Packages</Link>,{" "}
        <Link href="/admin/coupons" className="text-[#2B50DC] dark:text-[#5B8DEF]">Coupons</Link> and{" "}
        <Link href="/admin/links" className="text-[#2B50DC] dark:text-[#5B8DEF]">Links</Link>, under
        Money. What socialX sells is not the same kind of thing as configuration, and filing it
        under Settings made the offer look like a preference.
      </div>

      <H>Entitlements</H>
      <p className="text-[12.5px] text-gray-500 dark:text-gray-500 mb-3 max-w-[78ch]">
        The tier contract as the system enforces it. A batch snapshots these at creation, so a
        mid-cycle plan change cannot rewrite work already in production.
      </p>
      <Table head={["Plan", "Posts", "Motion", "Platforms", "Revisions", "First batch", "Customization", "Call"]}>
        {sortedEnts.map((e) => (
          <Row key={rel<{ key?: string }>(e.plans)?.key}>
            <Cell strong>{rel<{ name?: string }>(e.plans)?.name}</Cell>
            <Cell>{e.posts_per_month}</Cell>
            <Cell>{e.motion_videos}</Cell>
            <Cell>{e.platforms_max}</Cell>
            <Cell>
              {e.revision_rounds === null ? (
                <span className="text-[#2B50DC] dark:text-[#5B8DEF]">unlimited</span>
              ) : (
                `${e.revision_rounds} per batch`
              )}
            </Cell>
            <Cell>{e.first_batch_days} days</Cell>
            <Cell>{e.customization_level}</Cell>
            <Cell>{e.monthly_call ? "yes" : "no"}</Cell>
          </Row>
        ))}
      </Table>

      <H>Rate cards</H>
      <Table head={["Card", "Active", "From", "Until"]}>
        {(cards ?? []).map((c) => (
          <Row key={c.key}>
            <Cell strong>{c.label}</Cell>
            <Cell>{c.is_active ? "yes" : "no"}</Cell>
            <Cell>{c.active_from ?? "always"}</Cell>
            <Cell>
              {c.active_to ?? <span className="text-[#2B50DC] dark:text-[#5B8DEF]">open ended</span>}
            </Cell>
          </Row>
        ))}
      </Table>
      <p className="text-[12.5px] text-gray-500 dark:text-gray-500 mt-2 max-w-[78ch]">
        Checkout uses the highest sorted active card whose window covers today, so the launch
        offer wins while it is open. Giving it an end date is all it takes to fall back to
        regular pricing, with no code change and no reissued links.
      </p>

      <H>Content pillars</H>
      <Table head={["Pillar", "Default monthly mix"]}>
        {(pillars ?? []).map((p) => (
          <Row key={p.key}>
            <Cell strong>{p.name}</Cell>
            <Cell>{p.default_mix_pct}%</Cell>
          </Row>
        ))}
      </Table>

      <H>HighLevel features</H>
      <div className="border border-black/10 dark:border-white/10 bg-white dark:bg-[#111118] p-5 text-[13.5px] text-gray-600 dark:text-gray-400">
        {(features ?? []).length > 0
          ? "The feature vocabulary the library tags against is seeded and in use."
          : "No HighLevel features seeded yet. The library cannot tag posts by feature until they exist."}
      </div>
    </div>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-mono text-[10px] uppercase tracking-[0.13em] text-gray-400 dark:text-gray-600 mt-8 mb-3 first:mt-0">
      {children}
    </h2>
  );
}
