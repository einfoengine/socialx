import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/lib/dal/permissions";
import { createClient } from "@socialx/core/supabase/server";
import { PageHead, Table, Row, Cell, Status, EmptyRow } from "@/components/portal/DataTable";

export const metadata: Metadata = { title: "Clients | socialX Admin" };

export default async function ClientsPage() {
  await requirePermission("clients");
  const supabase = await createClient();

  const { data } = await supabase
    .from("organizations")
    .select("id, name, owner_email, status, hl_location_id, created_at, subscriptions(status, plans(name))")
    .order("created_at", { ascending: false });

  const orgs = data ?? [];

  return (
    <div>
      <PageHead title="Clients" sub="Every organization, whatever state it is in." />
      <Table head={["Client", "Plan", "HL location", "Status", "Since"]}>
        {orgs.length === 0 && (
          <EmptyRow cols={5}>
            No clients yet. They appear here automatically when a checkout completes.
          </EmptyRow>
        )}
        {orgs.map((o) => {
          const sub = (o.subscriptions as { status?: string; plans?: { name?: string } }[] | null)?.[0];
          return (
            <Row key={o.id}>
              <Cell strong>
                <Link href={`/admin/clients/${o.id}`} className="no-underline hover:underline">
                  {o.name}
                </Link>
                <div className="font-normal text-[12px] text-gray-500 mt-0.5">{o.owner_email}</div>
              </Cell>
              <Cell>{sub?.plans?.name ?? "none"}</Cell>
              <Cell>
                {o.hl_location_id ? (
                  <span className="font-mono text-[11px]">{o.hl_location_id}</span>
                ) : (
                  <span className="text-amber-700 dark:text-amber-400">not connected</span>
                )}
              </Cell>
              <Cell><Status value={o.status} /></Cell>
              <Cell>{new Date(o.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</Cell>
            </Row>
          );
        })}
      </Table>
    </div>
  );
}
