import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/dal/permissions";
import { createClient } from "@/lib/core/supabase/server";
import { PageHead, Status } from "@/components/DataTable";
import { viewClientPortal } from "@/app/view-as-actions";
import { formatMoney, CYCLE_LABELS, revisionLabel } from "@/lib/format";

export const metadata: Metadata = { title: "Client | Admin" };

export default async function ClientDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("clients");
  const { id } = await params;
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, slug, owner_email, status, source, hl_location_id, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!org) notFound();

  const [{ data: subs }, { data: brand }, { data: batches }, { data: invoices }, { data: activity }] =
    await Promise.all([
      /* Ordered and limited rather than maybeSingle(), which errors outright the
         moment a client has two rows, and a client who moved between this
         platform's billing and their site's own has exactly that. The current one
         is the most recently touched, whichever direction the move went. */
      supabase
        .from("subscriptions")
        .select(
          "status, cycle_key, rate_card_key, current_period_end, delivery_hold, stripe_subscription_id, source, amount, currency, external_ref, synced_at, plans(name, key)"
        )
        .eq("org_id", id)
        .order("updated_at", { ascending: false })
        .limit(1),
      supabase.from("brand_profiles").select("*").eq("org_id", id).maybeSingle(),
      supabase
        .from("batches")
        .select("id, period_start, status, due_at, quota_posts, quota_motion, revision_rounds_allowed, revision_rounds_used")
        .eq("org_id", id)
        .order("period_start", { ascending: false }),
      supabase
        .from("invoices")
        .select("id, number, amount_paid, status, issued_at, hosted_invoice_url")
        .eq("org_id", id)
        .order("issued_at", { ascending: false })
        .limit(10),
      supabase
        .from("activity_log")
        .select("id, action, entity, created_at, diff")
        .eq("org_id", id)
        .order("created_at", { ascending: false })
        .limit(15),
    ]);

  const sub = subs?.[0] ?? null;

  return (
    <div>
      <Link
        href="/admin/clients"
        className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500 no-underline hover:text-[#2B50DC]"
      >
        back to clients
      </Link>

      <div className="mt-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <PageHead title={org.name} sub={org.owner_email ?? undefined} />
          <form action={viewClientPortal}>
            <input type="hidden" name="org_id" value={org.id} />
            <button
              type="submit"
              className="border border-black/15 dark:border-white/20 px-4 py-2 font-grotesk text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer whitespace-nowrap"
            >
              View their portal
            </button>
          </form>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-8">
        <Status value={org.status} />
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] border border-black/12 dark:border-white/15 text-gray-600 dark:text-gray-400 px-2 py-0.5">
          {org.source}
        </span>
        {org.hl_location_id && (
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] border border-black/12 dark:border-white/15 text-gray-600 dark:text-gray-400 px-2 py-0.5">
            HL {org.hl_location_id}
          </span>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Panel title="Subscription">
          {sub ? (
            <dl className="flex flex-col gap-2.5">
              <Line k="Plan" v={(sub.plans as { name?: string } | null)?.name ?? "?"} />
              <Line k="Cycle" v={`${CYCLE_LABELS[sub.cycle_key] ?? sub.cycle_key} (${sub.rate_card_key})`} />
              <Line k="Status" v={sub.status} />
              <Line
                k="Renews"
                v={sub.current_period_end ? new Date(sub.current_period_end).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "not set"}
              />
              {sub.delivery_hold && <Line k="Delivery" v="ON HOLD" />}
              {/* Where the money actually goes, and what this platform holds to
                  identify it with. For an imported subscription the useful
                  identifier is the selling site's own, since that is what
                  support will be given on the phone. */}
              {sub.source === "external" ? (
                <>
                  <Line
                    k="Billed by"
                    v={`the site, ${
                      typeof sub.amount === "number"
                        ? formatMoney(sub.amount, sub.currency ?? "usd")
                        : "amount not reported"
                    }`}
                  />
                  <Line k="Their ref" v={sub.external_ref ?? "none"} mono />
                  <Line
                    k="Fetched"
                    v={sub.synced_at ? String(sub.synced_at).slice(0, 16).replace("T", " ") : "never"}
                  />
                </>
              ) : (
                sub.stripe_subscription_id && (
                  <Line k="Stripe" v={sub.stripe_subscription_id} mono />
                )
              )}
            </dl>
          ) : (
            <Muted>No subscription on this organization.</Muted>
          )}
        </Panel>

        <Panel title="Brand profile">
          {brand?.completed_at ? (
            <dl className="flex flex-col gap-2.5">
              <Line k="Brand" v={brand.brand_name ?? "not set"} />
              <Line k="Website" v={brand.website ?? "not set"} />
              <Line k="Niches" v={(brand.niches ?? []).join(", ") || "not set"} />
              <Line k="Approver" v={brand.approver_email ?? "not set"} />
              <Line
                k="Completed"
                v={new Date(brand.completed_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              />
            </dl>
          ) : (
            <Muted>
              Onboarding not finished. The client still needs to complete the brand form
              before a batch can be built for them.
            </Muted>
          )}
        </Panel>
      </div>

      <Section title="Batches">
        {(batches ?? []).length === 0 ? (
          <Muted>No batches yet.</Muted>
        ) : (
          <div className="flex flex-col gap-2">
            {(batches ?? []).map((b) => (
              <div
                key={b.id}
                className="border border-black/10 dark:border-white/10 bg-white dark:bg-[#111118] p-4 flex flex-wrap items-center gap-x-6 gap-y-2"
              >
                <span className="font-grotesk font-semibold text-gray-900 dark:text-white">
                  {new Date(b.period_start + "T00:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                </span>
                <Status value={b.status} />
                <span className="text-[13px] text-gray-600 dark:text-gray-400">
                  {b.quota_posts} posts, {b.quota_motion} motion
                </span>
                <span className="text-[13px] text-gray-600 dark:text-gray-400">
                  {revisionLabel(b.revision_rounds_allowed, b.revision_rounds_used)}
                </span>
                {b.due_at && (
                  <span className="font-mono text-[11px] text-gray-500 ml-auto">
                    due {new Date(b.due_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Invoices">
        {(invoices ?? []).length === 0 ? (
          <Muted>No invoices recorded.</Muted>
        ) : (
          <div className="flex flex-col gap-2">
            {(invoices ?? []).map((i) => (
              <div
                key={i.id}
                className="border border-black/10 dark:border-white/10 bg-white dark:bg-[#111118] p-3 flex items-center gap-4 text-[13px]"
              >
                <span className="font-mono text-[11px] text-gray-500">{i.number ?? "draft"}</span>
                <span className="font-grotesk font-semibold text-gray-900 dark:text-white">
                  {formatMoney(i.amount_paid ?? 0)}
                </span>
                <Status value={i.status} />
                <span className="text-gray-500 ml-auto">
                  {i.issued_at ? new Date(i.issued_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
                </span>
                {i.hosted_invoice_url && (
                  <a
                    href={i.hosted_invoice_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-[10px] uppercase text-[#2B50DC] dark:text-[#5B8DEF]"
                  >
                    view
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Activity">
        {(activity ?? []).length === 0 ? (
          <Muted>Nothing logged yet.</Muted>
        ) : (
          <ol className="flex flex-col gap-0 border-l border-black/10 dark:border-white/10 pl-4">
            {(activity ?? []).map((a) => (
              <li key={a.id} className="py-2 text-[13px]">
                <span className="font-grotesk font-semibold text-gray-900 dark:text-white">
                  {a.action.replace(/_/g, " ")}
                </span>
                <span className="text-gray-500 ml-2 font-mono text-[11px]">
                  {new Date(a.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Section>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-black/10 dark:border-white/10 bg-white dark:bg-[#111118] p-5">
      <div className="font-mono text-[10px] uppercase tracking-[0.13em] text-gray-400 dark:text-gray-600 mb-4">
        {title}
      </div>
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-8">
      <h2 className="font-mono text-[10px] uppercase tracking-[0.13em] text-gray-400 dark:text-gray-600 mb-3">
        {title}
      </h2>
      {children}
    </div>
  );
}

function Line({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4 text-[13.5px]">
      <dt className="text-gray-500 dark:text-gray-500 shrink-0">{k}</dt>
      <dd className={`text-gray-900 dark:text-white text-right ${mono ? "font-mono text-[11.5px]" : ""}`}>
        {v}
      </dd>
    </div>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <p className="text-[13.5px] text-gray-500 dark:text-gray-500 leading-relaxed">{children}</p>;
}
