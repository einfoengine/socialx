import type { Metadata } from "next";
import { pageMeta } from "@/lib/page-meta";
import Link from "next/link";
import { requirePermission } from "@/lib/dal/permissions";
import { createClient } from "@socialx/core/supabase/server";
import { PageHead, Table, Row, Cell, Status, EmptyRow } from "@/components/DataTable";
import { revisionLabel } from "@/lib/format";
import { createBatch } from "./actions";

export const metadata: Metadata = { title: "Batches | socialX Admin" };

export default async function BatchesPage() {
  await requirePermission("batches");
  const supabase = await createClient();

  const [{ data: batches }, { data: orgs }] = await Promise.all([
    supabase
      .from("batches")
      .select("id, period_start, status, due_at, quota_posts, quota_motion, revision_rounds_allowed, revision_rounds_used, org_id, organizations(name), posts(id)")
      .order("period_start", { ascending: false }),
    supabase
      .from("organizations")
      .select("id, name")
      .eq("status", "active")
      .order("name"),
  ]);

  // Read the clock through an await rather than inline: calling Date during render
  // is impure, and React flags it even where the route is already dynamic.
  const { now, thisMonth } = await clock();

  return (
    <div>
      <PageHead {...pageMeta("/admin/batches")} />

      <details className="border border-black/10 dark:border-white/10 bg-white dark:bg-[#111118] mb-6">
        <summary className="px-5 py-3.5 cursor-pointer font-grotesk text-[13.5px] font-semibold text-gray-900 dark:text-white select-none">
          Start a batch
        </summary>
        <form action={createBatch} className="px-5 pb-5 flex flex-wrap gap-3 items-end">
          <label className="flex-1 min-w-[200px]">
            <span className="block font-mono text-[10px] uppercase tracking-[0.13em] text-gray-500 mb-1.5">Client</span>
            <select name="org_id" required defaultValue="" className={INPUT}>
              <option value="" disabled>Choose one</option>
              {(orgs ?? []).map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="block font-mono text-[10px] uppercase tracking-[0.13em] text-gray-500 mb-1.5">Month</span>
            <input type="month" name="month" required defaultValue={thisMonth} className={INPUT} />
          </label>
          <button className="btn gradient-bg text-white px-5 py-2.5 font-grotesk font-semibold text-[13px] cursor-pointer border-0">
            Create
          </button>
        </form>
        <p className="px-5 pb-4 text-[12.5px] text-gray-500 max-w-[74ch]">
          Quota is copied from the plan at this moment and frozen onto the batch, so a
          later upgrade or downgrade cannot rewrite work already in production.
        </p>
      </details>

      <Table head={["Client", "Month", "Filled", "Revisions", "Due", "Status"]}>
        {(batches ?? []).length === 0 && (
          <EmptyRow cols={6}>No batches yet. Start one above.</EmptyRow>
        )}
        {(batches ?? []).map((b) => {
          const filled = ((b.posts as { id: string }[] | null) ?? []).length;
          const overdue =
            b.due_at && new Date(b.due_at).getTime() < now && !["live", "closed", "approved"].includes(b.status);
          return (
            <Row key={b.id}>
              <Cell strong>
                <Link href={`/admin/batches/${b.id}`} className="no-underline hover:underline">
                  {(b.organizations as { name?: string } | null)?.name ?? "unknown"}
                </Link>
              </Cell>
              <Cell>
                {new Date(b.period_start + "T00:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </Cell>
              <Cell>
                <span className={filled >= b.quota_posts ? "text-emerald-700 dark:text-emerald-400" : ""}>
                  {filled} of {b.quota_posts}
                </span>
              </Cell>
              <Cell>{revisionLabel(b.revision_rounds_allowed, b.revision_rounds_used)}</Cell>
              <Cell>
                {b.due_at ? (
                  <span className={overdue ? "text-rose-600 dark:text-rose-400 font-semibold" : ""}>
                    {new Date(b.due_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    {overdue && " overdue"}
                  </span>
                ) : (
                  "not set"
                )}
              </Cell>
              <Cell><Status value={b.status} /></Cell>
            </Row>
          );
        })}
      </Table>
    </div>
  );
}

async function clock() {
  const d = new Date();
  return { now: d.getTime(), thisMonth: d.toISOString().slice(0, 7) };
}

const INPUT =
  "bg-transparent border border-black/15 dark:border-white/15 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-hidden focus:border-[#2B50DC] w-full";
