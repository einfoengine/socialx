import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/lib/dal/permissions";
import { createClient } from "@socialx/core/supabase/server";
import { PageHead, Table, Row, Cell, Status, EmptyRow } from "@/components/portal/DataTable";
import { markScheduled, markPublished } from "./actions";

export const metadata: Metadata = { title: "Publishing | socialX Admin" };

export default async function PublishingPage() {
  await requirePermission("publishing");
  const supabase = await createClient();

  const { data: posts } = await supabase
    .from("posts")
    .select("id, title, format, platforms, scheduled_for, status, org_id, batch_id, organizations(name)")
    .in("status", ["approved", "scheduled"])
    .order("scheduled_for", { ascending: true, nullsFirst: false });

  const approved = (posts ?? []).filter((p) => p.status === "approved");
  const scheduled = (posts ?? []).filter((p) => p.status === "scheduled");

  return (
    <div>
      <PageHead
        title="Publishing"
        sub="Approved posts waiting to be loaded into the client's HL Social Planner. Automated in R4; a human does it today and marks it here."
      />

      <div className="border border-[#2B50DC]/30 bg-[#2B50DC]/5 p-4 mb-6 text-[13px] text-gray-700 dark:text-gray-300 max-w-[80ch]">
        The portal is already the record of what is scheduled. R4 swaps out who performs
        the push, not what it means, so nothing here has to be re-modelled later.
      </div>

      <H>Ready to load ({approved.length})</H>
      <Table head={["Client", "Post", "Platforms", "Scheduled for", "Action"]}>
        {approved.length === 0 && (
          <EmptyRow cols={5}>Nothing approved and waiting. Approved batches land here.</EmptyRow>
        )}
        {approved.map((p) => (
          <Row key={p.id}>
            <Cell strong>{(p.organizations as { name?: string } | null)?.name ?? "unknown"}</Cell>
            <Cell>
              <Link href={`/admin/batches/${p.batch_id}`} className="no-underline hover:underline">
                {p.title}
              </Link>
            </Cell>
            <Cell>{(p.platforms ?? []).join(", ") || "none"}</Cell>
            <Cell>
              {p.scheduled_for
                ? new Date(p.scheduled_for).toLocaleString("en-US", {
                    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                  })
                : "not set"}
            </Cell>
            <Cell>
              <form action={markScheduled}>
                <input type="hidden" name="post_id" value={p.id} />
                <button className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#2B50DC] dark:text-[#5B8DEF] cursor-pointer bg-transparent border-0">
                  Mark loaded
                </button>
              </form>
            </Cell>
          </Row>
        ))}
      </Table>

      <H>In the Social Planner ({scheduled.length})</H>
      <Table head={["Client", "Post", "Platforms", "Goes out", "Action"]}>
        {scheduled.length === 0 && <EmptyRow cols={5}>Nothing scheduled yet.</EmptyRow>}
        {scheduled.map((p) => (
          <Row key={p.id}>
            <Cell strong>{(p.organizations as { name?: string } | null)?.name ?? "unknown"}</Cell>
            <Cell>{p.title}</Cell>
            <Cell>{(p.platforms ?? []).join(", ")}</Cell>
            <Cell>
              {p.scheduled_for
                ? new Date(p.scheduled_for).toLocaleString("en-US", {
                    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                  })
                : "not set"}
            </Cell>
            <Cell>
              <form action={markPublished}>
                <input type="hidden" name="post_id" value={p.id} />
                <button className="font-mono text-[10px] uppercase tracking-[0.1em] text-gray-500 hover:text-[#2B50DC] cursor-pointer bg-transparent border-0">
                  Mark published
                </button>
              </form>
            </Cell>
          </Row>
        ))}
      </Table>
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
