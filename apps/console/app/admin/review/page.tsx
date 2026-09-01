import type { Metadata } from "next";
import { pageMeta } from "@/lib/page-meta";
import Link from "next/link";
import { requirePermission } from "@/lib/dal/permissions";
import { createClient } from "@socialx/core/supabase/server";
import { PageHead, Table, Row, Cell, EmptyRow } from "@/components/DataTable";
import { resolveRevision } from "./actions";

export const metadata: Metadata = { title: "Review queue | socialX Admin" };

/**
 * Every open change request across all clients, oldest first.
 *
 * A revision round is a paid entitlement being spent, so the useful ordering is by
 * how long the client has been waiting, not by client name.
 */
export default async function ReviewQueue() {
  await requirePermission("review");
  const supabase = await createClient();

  const { data: open } = await supabase
    .from("revisions")
    .select("id, round, note, created_at, batch_id, post_id, status, batches(org_id, period_start, organizations(name)), posts(title)")
    .eq("status", "open")
    .order("created_at", { ascending: true });

  const now = await nowMs();

  return (
    <div>
      <PageHead {...pageMeta("/admin/review")} />

      <Table head={["Client", "Month", "Round", "What they want", "Waiting", "Action"]}>
        {(open ?? []).length === 0 && (
          <EmptyRow cols={6}>Nothing open. Change requests land here the moment a client sends them.</EmptyRow>
        )}
        {(open ?? []).map((r) => {
          const batch = r.batches as { org_id?: string; period_start?: string; organizations?: { name?: string } } | null;
          const hours = Math.floor((now - new Date(r.created_at).getTime()) / 3600000);
          return (
            <Row key={r.id}>
              <Cell strong>{batch?.organizations?.name ?? "unknown"}</Cell>
              <Cell>
                {batch?.period_start
                  ? new Date(batch.period_start + "T00:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" })
                  : ""}
              </Cell>
              <Cell>
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] border border-[#2B50DC]/30 text-[#2B50DC] dark:text-[#5B8DEF] px-1.5 py-0.5">
                  {r.round}
                </span>
              </Cell>
              <Cell>
                {(r.posts as { title?: string } | null)?.title && (
                  <span className="block font-grotesk text-[12.5px] font-semibold text-gray-900 dark:text-white mb-0.5">
                    {(r.posts as { title?: string }).title}
                  </span>
                )}
                <span className="text-[13px]">{r.note}</span>
              </Cell>
              <Cell>
                <span className={hours > 48 ? "text-rose-600 dark:text-rose-400 font-semibold" : ""}>
                  {hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d`}
                </span>
              </Cell>
              <Cell>
                <div className="flex flex-col gap-1.5">
                  <Link
                    href={`/admin/batches/${r.batch_id}`}
                    className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#2B50DC] dark:text-[#5B8DEF] no-underline"
                  >
                    Open batch
                  </Link>
                  <form action={resolveRevision}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className="font-mono text-[10px] uppercase tracking-[0.1em] text-gray-500 hover:text-emerald-600 cursor-pointer bg-transparent border-0 p-0">
                      Mark done
                    </button>
                  </form>
                </div>
              </Cell>
            </Row>
          );
        })}
      </Table>
    </div>
  );
}

async function nowMs() {
  return Date.now();
}
