import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/dal/session";
import { createClient } from "@/lib/supabase/server";
import { Status } from "@/components/portal/DataTable";
import { formatMoney } from "@/lib/format";

export const metadata: Metadata = { title: "Today | socialX Admin" };

/**
 * Today.
 *
 * Ordered by what needs a decision, not by what is easy to count. Anything that is
 * merely informational sits below the fold of attention.
 */
export default async function AdminToday() {
  const session = await requireStaff();
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const [
    { data: batches },
    { data: awaitingApproval },
    { data: pastDue },
    { data: onboarding },
    { data: approvedPosts },
    { count: brokenAssets },
    { data: changedFeatures },
    { data: prices },
  ] = await Promise.all([
    supabase
      .from("batches")
      .select("id, period_start, status, due_at, quota_posts, org_id, organizations(name), posts(id)")
      .in("status", ["draft", "in_production", "changes_requested"])
      .order("due_at", { ascending: true, nullsFirst: false }),
    supabase
      .from("batches")
      .select("id, submitted_at, org_id, organizations(name)")
      .eq("status", "in_review")
      .order("submitted_at", { ascending: true }),
    supabase
      .from("subscriptions")
      .select("id, org_id, status, delivery_hold, organizations(name)")
      .in("status", ["past_due", "paused"]),
    supabase
      .from("organizations")
      .select("id, name, created_at")
      .eq("status", "onboarding")
      .order("created_at", { ascending: true }),
    supabase.from("posts").select("id").eq("status", "approved"),
    supabase.from("assets").select("*", { count: "exact", head: true }).eq("is_broken", true),
    supabase.from("hl_features").select("id, name").eq("status", "changed"),
    supabase
      .from("plan_prices")
      .select("monthly_amount, plans(key)")
      .eq("cycle_key", "monthly"),
  ]);

  const overdue = (batches ?? []).filter((b) => b.due_at && b.due_at < nowIso);
  const needsAttention =
    overdue.length + (awaitingApproval ?? []).length + (pastDue ?? []).length + (onboarding ?? []).length;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-grotesk text-2xl font-semibold tracking-[-0.6px] text-gray-900 dark:text-white">
          Today
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {needsAttention === 0
            ? "Nothing needs a decision right now."
            : `${needsAttention} thing${needsAttention === 1 ? "" : "s"} need attention.`}
        </p>
      </div>

      {overdue.length > 0 && (
        <Block tone="alert" title={`${overdue.length} batch${overdue.length === 1 ? "" : "es"} overdue`}>
          {overdue.map((b) => (
            <RowLink key={b.id} href={`/admin/batches/${b.id}`}>
              <span className="font-grotesk font-semibold">
                {(b.organizations as { name?: string } | null)?.name}
              </span>
              <span className="text-gray-500">
                {((b.posts as { id: string }[] | null) ?? []).length} of {b.quota_posts} built
              </span>
              <span className="text-rose-600 dark:text-rose-400 ml-auto font-mono text-[11px]">
                due {new Date(b.due_at!).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            </RowLink>
          ))}
        </Block>
      )}

      {(awaitingApproval ?? []).length > 0 && (
        <Block tone="info" title={`${(awaitingApproval ?? []).length} waiting on client approval`}>
          {(awaitingApproval ?? []).map((b) => (
            <RowLink key={b.id} href={`/admin/batches/${b.id}`}>
              <span className="font-grotesk font-semibold">
                {(b.organizations as { name?: string } | null)?.name}
              </span>
              <span className="text-gray-500 ml-auto font-mono text-[11px]">
                sent {b.submitted_at ? new Date(b.submitted_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
              </span>
            </RowLink>
          ))}
        </Block>
      )}

      {(pastDue ?? []).length > 0 && (
        <Block tone="alert" title="Billing needs attention">
          {(pastDue ?? []).map((s) => (
            <RowLink key={s.id} href={`/admin/clients/${s.org_id}`}>
              <span className="font-grotesk font-semibold">
                {(s.organizations as { name?: string } | null)?.name}
              </span>
              <Status value={s.status} />
              {s.delivery_hold && (
                <span className="font-mono text-[10px] uppercase text-rose-600 ml-auto">delivery held</span>
              )}
            </RowLink>
          ))}
        </Block>
      )}

      {(onboarding ?? []).length > 0 && (
        <Block tone="info" title={`${(onboarding ?? []).length} finishing onboarding`}>
          {(onboarding ?? []).map((o) => (
            <RowLink key={o.id} href={`/admin/clients/${o.id}`}>
              <span className="font-grotesk font-semibold">{o.name}</span>
              <span className="text-gray-500 ml-auto font-mono text-[11px]">
                since {new Date(o.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            </RowLink>
          ))}
        </Block>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-black/10 dark:bg-white/10 border border-black/10 dark:border-white/10">
        <Tile label="In production" value={String((batches ?? []).length)} href="/admin/batches" />
        <Tile label="Ready to publish" value={String((approvedPosts ?? []).length)} href="/admin/publishing" />
        <Tile
          label="Changed HL features"
          value={String((changedFeatures ?? []).length)}
          href="/admin/library/features"
          warn={(changedFeatures ?? []).length > 0}
        />
        <Tile
          label="Broken assets"
          value={String(brokenAssets ?? 0)}
          href="/admin/library"
          warn={(brokenAssets ?? 0) > 0}
        />
      </div>

      <div className="border border-black/10 dark:border-white/10 bg-white dark:bg-[#111118] p-5">
        <div className="font-mono text-[10px] uppercase tracking-[0.13em] text-gray-400 dark:text-gray-600 mb-3">
          Catalog check, monthly list price
        </div>
        <div className="flex flex-wrap gap-6">
          {(prices ?? []).map((p) => {
            const key = (p.plans as { key?: string } | null)?.key ?? "?";
            const expected = { starter: 19700, growth: 39700, scale: 59700 }[key];
            const ok = expected === p.monthly_amount;
            return (
              <div key={key}>
                <div className={`font-grotesk text-base font-semibold ${ok ? "text-gray-900 dark:text-white" : "text-rose-600"}`}>
                  {formatMoney(p.monthly_amount)}
                </div>
                <div className="text-[11px] text-gray-500 capitalize">{key}</div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-500 mt-4 max-w-[64ch] leading-relaxed">
          Signed in as {session.email} ({session.staffRole}). If a figure here is not 197,
          397, or 597, the seed drifted and checkout would charge it.
        </p>
      </div>
    </div>
  );
}

function Block({
  tone,
  title,
  children,
}: {
  tone: "alert" | "info";
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`border ${
        tone === "alert"
          ? "border-rose-500/40 bg-rose-500/4"
          : "border-[#2B50DC]/30 bg-[#2B50DC]/4"
      }`}
    >
      <h2
        className={`font-grotesk text-[14px] font-semibold px-5 py-3 border-b ${
          tone === "alert"
            ? "border-rose-500/25 text-rose-800 dark:text-rose-300"
            : "border-[#2B50DC]/20 text-[#2B50DC] dark:text-[#5B8DEF]"
        }`}
      >
        {title}
      </h2>
      <div className="flex flex-col">{children}</div>
    </section>
  );
}

function RowLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex flex-wrap items-center gap-3 px-5 py-3 text-[13.5px] text-gray-700 dark:text-gray-300 no-underline border-b border-black/5 dark:border-white/5 last:border-0 hover:bg-black/3 dark:hover:bg-white/3 transition-colors"
    >
      {children}
    </Link>
  );
}

function Tile({ label, value, href, warn }: { label: string; value: string; href: string; warn?: boolean }) {
  return (
    <Link href={href} className="bg-white dark:bg-[#111118] p-5 no-underline hover:bg-black/2 dark:hover:bg-white/2 transition-colors">
      <div className="font-mono text-[10px] uppercase tracking-[0.13em] text-gray-400 dark:text-gray-600 mb-2">
        {label}
      </div>
      <div className={`font-grotesk text-lg font-semibold ${warn ? "text-amber-600 dark:text-amber-400" : "text-gray-900 dark:text-white"}`}>
        {value}
      </div>
    </Link>
  );
}
