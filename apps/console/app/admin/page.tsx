import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/lib/dal/permissions";
import { createClient } from "@socialx/core/supabase/server";
import { formatMoney } from "@/lib/format";

export const metadata: Metadata = { title: "Overview | socialX Admin" };

/**
 * Overview.
 *
 * The whole business on one screen: what is on fire at the top, the standing
 * numbers under it, then a breakdown per area.
 *
 * Every panel is gated on the permission for the section it reads from, because
 * this page aggregates across the entire schema. Without that, granting a role
 * the Overview would quietly hand it a summary of everything the matrix closes
 * off. The gate is on the query rather than the markup, so rows a role may not
 * see never leave Postgres.
 */
export default async function AdminOverview() {
  const session = await requirePermission("today");
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const p = session.permissions;
  const seeBatches = p.batches !== "none";
  const seeSubs = p.subscriptions !== "none";
  const seeClients = p.clients !== "none";
  const seeOrders = p.orders !== "none";
  const seePublishing = p.publishing !== "none";
  const seeLibrary = p.library !== "none";
  const seePackages = p.packages !== "none";

  const noRows = Promise.resolve({ data: null });
  const noCount = Promise.resolve({ count: null });

  const [
    { data: orgs },
    { data: subs },
    { data: invoices },
    { data: batches },
    { data: posts },
    { data: approvedPosts },
    { data: templates },
    { data: changedFeatures },
    { count: brokenAssets },
    { data: prices },
  ] = await Promise.all([
    seeClients
      ? supabase.from("organizations").select("id, name, status, created_at").order("created_at")
      : noRows,
    seeSubs
      ? supabase
          .from("subscriptions")
          .select("id, org_id, status, plan_id, cycle_key, delivery_hold, organizations(name)")
      : noRows,
    seeOrders
      ? supabase
          .from("invoices")
          .select("id, number, amount_paid, status, issued_at, org_id, organizations(name)")
          .order("issued_at", { ascending: false })
      : noRows,
    seeBatches
      ? supabase
          .from("batches")
          .select("id, status, due_at, quota_posts, submitted_at, org_id, organizations(name), posts(id)")
      : noRows,
    seeBatches ? supabase.from("posts").select("id, status") : noRows,
    seePublishing ? supabase.from("posts").select("id").eq("status", "approved") : noRows,
    seeLibrary ? supabase.from("templates").select("id, format") : noRows,
    seeLibrary ? supabase.from("hl_features").select("id, name").eq("status", "changed") : noRows,
    seeLibrary
      ? supabase.from("assets").select("*", { count: "exact", head: true }).eq("is_broken", true)
      : noCount,
    seePackages
      ? supabase.from("plan_prices").select("plan_id, monthly_amount, plans(key)").eq("cycle_key", "monthly")
      : noRows,
  ]);

  /* ---- Attention ---------------------------------------------------------- */
  const overdue = (batches ?? []).filter((b) => b.due_at && b.due_at < nowIso && b.status !== "closed");
  const awaitingApproval = (batches ?? []).filter((b) => b.status === "in_review");
  const pastDue = (subs ?? []).filter((s) => s.status === "past_due" || s.status === "paused");
  const onboarding = (orgs ?? []).filter((o) => o.status === "onboarding");
  const attention = [
    {
      n: overdue.length,
      label: `batch${overdue.length === 1 ? "" : "es"} overdue`,
      href: "/admin/batches",
      tone: "alert" as const,
    },
    {
      n: awaitingApproval.length,
      label: "awaiting client approval",
      href: "/admin/review",
      tone: "info" as const,
    },
    { n: pastDue.length, label: "billing needs attention", href: "/admin/subscriptions", tone: "alert" as const },
    { n: onboarding.length, label: "finishing onboarding", href: "/admin/clients", tone: "info" as const },
  ].filter((a) => a.n > 0);
  const attentionTotal = attention.reduce((n, a) => n + a.n, 0);

  /* ---- Standing numbers --------------------------------------------------- */
  const activeOrgs = (orgs ?? []).filter((o) => o.status === "active").length;
  const activeSubs = (subs ?? []).filter((s) => s.status === "active").length;

  /* List value, not revenue: this multiplies the published monthly price by the
     live subscriptions and knows nothing about a coupon applied at checkout. It
     is labelled as list so nobody reads it as money collected. */
  const priceByPlan = new Map((prices ?? []).map((r) => [r.plan_id as string, r.monthly_amount as number]));
  const listValue = (subs ?? [])
    .filter((s) => s.status === "active")
    .reduce((sum, s) => sum + (priceByPlan.get(s.plan_id as string) ?? 0), 0);

  const collected = (invoices ?? [])
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + (i.amount_paid ?? 0), 0);

  const kpis = [
    seeClients && { label: "Active clients", value: String(activeOrgs), href: "/admin/clients" },
    seeSubs && { label: "Live subscriptions", value: String(activeSubs), href: "/admin/subscriptions" },
    seeSubs && seePackages && {
      label: "Plan value, monthly list",
      value: formatMoney(listValue),
      href: "/admin/subscriptions",
    },
    seeOrders && { label: "Collected to date", value: formatMoney(collected), href: "/admin/orders" },
    seePublishing && {
      label: "Ready to publish",
      value: String((approvedPosts ?? []).length),
      href: "/admin/publishing",
    },
    seeLibrary && { label: "Library templates", value: String((templates ?? []).length), href: "/admin/library" },
  ].filter(Boolean) as { label: string; value: string; href: string }[];

  const batchesByStatus = tally((batches ?? []).map((b) => b.status as string));
  const postsByStatus = tally((posts ?? []).map((r) => r.status as string));
  const motion = (templates ?? []).filter((t) => t.format === "motion").length;

  return (
    <div className="flex flex-col gap-9">
      <div>
        <h1 className="font-grotesk text-2xl font-semibold tracking-[-0.6px] text-gray-900 dark:text-white">
          Overview
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {attentionTotal === 0
            ? "Nothing needs a decision right now."
            : `${attentionTotal} thing${attentionTotal === 1 ? "" : "s"} need${
                attentionTotal === 1 ? "s" : ""
              } attention.`}
        </p>
      </div>

      {attention.length > 0 && (
        <div className="flex flex-wrap gap-px bg-black/10 dark:bg-white/10 border border-black/10 dark:border-white/10">
          {attention.map((a) => (
            <Link
              key={a.label}
              href={a.href}
              className="flex-1 min-w-[190px] bg-white dark:bg-[#111118] px-5 py-4 no-underline hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
            >
              <div
                className={`font-grotesk text-2xl font-semibold ${
                  a.tone === "alert" ? "text-rose-600 dark:text-rose-400" : "text-[#3D4AFF] dark:text-[#00A3FF]"
                }`}
              >
                {a.n}
              </div>
              <div className="text-[12.5px] text-gray-600 dark:text-gray-400 mt-0.5">{a.label}</div>
            </Link>
          ))}
        </div>
      )}

      {kpis.length > 0 && (
        <div>
          <SectionLabel>Standing</SectionLabel>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-black/10 dark:bg-white/10 border border-black/10 dark:border-white/10">
            {kpis.map((k) => (
              <Link
                key={k.label}
                href={k.href}
                className="bg-white dark:bg-[#111118] p-5 no-underline hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
              >
                <div className="font-mono text-[10px] uppercase tracking-[0.13em] text-gray-400 dark:text-gray-600 mb-2">
                  {k.label}
                </div>
                <div className="font-grotesk text-[26px] font-semibold tracking-[-0.5px] text-gray-900 dark:text-white">
                  {k.value}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {seeBatches && (
        <div>
          <SectionLabel>Delivery</SectionLabel>
          <div className="grid lg:grid-cols-2 gap-5">
            <Panel title="Batches" href="/admin/batches" total={(batches ?? []).length}>
              <Distribution rows={batchesByStatus} />
            </Panel>
            <Panel title="Posts" href="/admin/batches" total={(posts ?? []).length}>
              <Distribution rows={postsByStatus} />
            </Panel>
          </div>
        </div>
      )}

      {seeLibrary && (
        <div>
          <SectionLabel>Content</SectionLabel>
          <div className="grid sm:grid-cols-3 gap-px bg-black/10 dark:bg-white/10 border border-black/10 dark:border-white/10">
            <Mini label="Templates" value={String((templates ?? []).length)} sub={`${motion} motion`} href="/admin/library" />
            <Mini
              label="Changed HL features"
              value={String((changedFeatures ?? []).length)}
              sub={(changedFeatures ?? []).length > 0 ? "needs a rewrite" : "all current"}
              href="/admin/library/features"
              warn={(changedFeatures ?? []).length > 0}
            />
            <Mini
              label="Broken assets"
              value={String(brokenAssets ?? 0)}
              sub={(brokenAssets ?? 0) > 0 ? "link no longer resolves" : "all resolving"}
              href="/admin/library"
              warn={(brokenAssets ?? 0) > 0}
            />
          </div>
        </div>
      )}

      {seeOrders && (invoices ?? []).length > 0 && (
        <div>
          <SectionLabel>Latest invoices</SectionLabel>
          <div className="border border-black/10 dark:border-white/10 bg-white dark:bg-[#111118]">
            {(invoices ?? []).slice(0, 5).map((i) => (
              <Link
                key={i.id}
                href="/admin/orders"
                className="flex flex-wrap items-center gap-3 px-5 py-3 text-[13.5px] text-gray-700 dark:text-gray-300 no-underline border-b border-black/5 dark:border-white/5 last:border-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
              >
                <span className="font-grotesk font-semibold">
                  {(i.organizations as { name?: string } | null)?.name ?? "Unknown"}
                </span>
                <span className="font-mono text-[11px] text-gray-500">{i.number ?? ""}</span>
                <span className="ml-auto font-grotesk font-semibold">{formatMoney(i.amount_paid ?? 0)}</span>
                <span
                  className={`font-mono text-[10px] uppercase tracking-[0.1em] ${
                    i.status === "paid" ? "text-gray-400 dark:text-gray-600" : "text-amber-600 dark:text-amber-400"
                  }`}
                >
                  {i.status}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {seePackages && (prices ?? []).length > 0 && (
        <div>
          <SectionLabel>Catalog check</SectionLabel>
          <div className="border border-black/10 dark:border-white/10 bg-white dark:bg-[#111118] p-5">
            <div className="flex flex-wrap gap-8">
              {(prices ?? []).map((r) => {
                const key = (r.plans as { key?: string } | null)?.key ?? "?";
                const expected = { starter: 19700, growth: 39700, scale: 59700 }[key];
                const ok = expected === r.monthly_amount;
                return (
                  <div key={key}>
                    <div
                      className={`font-grotesk text-base font-semibold ${
                        ok ? "text-gray-900 dark:text-white" : "text-rose-600"
                      }`}
                    >
                      {formatMoney(r.monthly_amount)}
                    </div>
                    <div className="text-[11px] text-gray-500 capitalize">{key}</div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-4 max-w-[64ch] leading-relaxed">
              If a figure here is not 197, 397, or 597, the seed drifted and checkout would charge it.
            </p>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400 dark:text-gray-600">
        Signed in as {session.email} ({session.staffRole}). This page shows only the sections your
        role can open.
      </p>
    </div>
  );
}

/** Counts per value, largest first. */
function tally(values: string[]): { label: string; n: number }[] {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()]
    .map(([label, n]) => ({ label, n }))
    .sort((a, b) => b.n - a.n);
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-gray-400 dark:text-gray-600 mb-3">
      {children}
    </div>
  );
}

function Panel({
  title,
  href,
  total,
  children,
}: {
  title: string;
  href: string;
  total: number;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-black/10 dark:border-white/10 bg-white dark:bg-[#111118] p-5">
      <div className="flex items-baseline justify-between mb-4">
        <Link href={href} className="font-grotesk text-[14px] font-semibold text-gray-900 dark:text-white no-underline">
          {title}
        </Link>
        <span className="font-grotesk text-[13px] text-gray-500">{total} total</span>
      </div>
      {children}
    </div>
  );
}

/* A proportion bar rather than a number alone: the shape of the pipeline is the
   thing worth seeing at a glance, and a column of counts hides it. */
function Distribution({ rows }: { rows: { label: string; n: number }[] }) {
  if (rows.length === 0) {
    return <p className="text-[13px] text-gray-500">Nothing yet.</p>;
  }
  const max = Math.max(...rows.map((r) => r.n));
  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-3">
          <span className="w-[135px] shrink-0 font-mono text-[11px] text-gray-500 dark:text-gray-500">
            {r.label.replace(/_/g, " ")}
          </span>
          <span className="flex-1 h-[6px] bg-black/[0.05] dark:bg-white/[0.07]">
            <span
              className="block h-full gradient-bg"
              style={{ width: `${Math.max(4, (r.n / max) * 100)}%` }}
            />
          </span>
          <span className="w-8 shrink-0 text-right font-grotesk text-[13px] font-semibold text-gray-800 dark:text-gray-200">
            {r.n}
          </span>
        </div>
      ))}
    </div>
  );
}

function Mini({
  label,
  value,
  sub,
  href,
  warn,
}: {
  label: string;
  value: string;
  sub: string;
  href: string;
  warn?: boolean;
}) {
  return (
    <Link
      href={href}
      className="bg-white dark:bg-[#111118] p-5 no-underline hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.13em] text-gray-400 dark:text-gray-600 mb-2">
        {label}
      </div>
      <div
        className={`font-grotesk text-lg font-semibold ${
          warn ? "text-amber-600 dark:text-amber-400" : "text-gray-900 dark:text-white"
        }`}
      >
        {value}
      </div>
      <div className="text-[11px] text-gray-500 mt-0.5">{sub}</div>
    </Link>
  );
}
