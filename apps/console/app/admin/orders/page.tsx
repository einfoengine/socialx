import type { Metadata } from "next";
import { pageMeta } from "@/lib/page-meta";
import Link from "next/link";
import { requirePermission } from "@/lib/dal/permissions";
import { createClient } from "@socialx/core/supabase/server";
import { PageHead, Table, Row, Cell, Status, EmptyRow } from "@/components/DataTable";

export const metadata: Metadata = { title: "Orders | socialX Admin" };

/**
 * New business. An order is an organization that has paid but has not finished
 * onboarding, so this is the queue of accounts waiting on someone.
 */
export default async function OrdersPage() {
  await requirePermission("orders");
  const supabase = await createClient();

  const { data } = await supabase
    .from("organizations")
    .select(
      "id, name, owner_email, status, created_at, subscriptions(status, cycle_key, rate_card_key, plans(name)), brand_profiles(completed_at)"
    )
    .in("status", ["pending", "onboarding"])
    .order("created_at", { ascending: false });

  const orders = data ?? [];

  return (
    <div>
      <PageHead {...pageMeta("/admin/orders")} />

      <Table head={["Client", "Plan", "Billing", "Onboarding", "Status", "Paid"]}>
        {orders.length === 0 && (
          <EmptyRow cols={6}>
            No open orders. New checkouts appear here the moment Stripe confirms payment.
          </EmptyRow>
        )}
        {orders.map((o) => {
          const sub = (o.subscriptions as { cycle_key?: string; rate_card_key?: string; plans?: { name?: string } }[] | null)?.[0];
          const brand = (o.brand_profiles as { completed_at?: string | null }[] | null)?.[0];
          const done = Boolean(brand?.completed_at);
          return (
            <Row key={o.id}>
              <Cell strong>
                <Link href={`/admin/clients/${o.id}`} className="no-underline hover:underline">
                  {o.name}
                </Link>
                <div className="font-normal text-[12px] text-gray-500 mt-0.5">{o.owner_email}</div>
              </Cell>
              <Cell>{sub?.plans?.name ?? "not set"}</Cell>
              <Cell>
                {sub?.cycle_key ?? "?"}
                {sub?.rate_card_key === "launch" && (
                  <span className="ml-2 font-mono text-[9.5px] uppercase text-[#2B50DC] dark:text-[#5B8DEF]">
                    launch
                  </span>
                )}
              </Cell>
              <Cell>
                {done ? (
                  <span className="text-emerald-700 dark:text-emerald-400">complete</span>
                ) : (
                  <span className="text-amber-700 dark:text-amber-400">waiting on client</span>
                )}
              </Cell>
              <Cell><Status value={o.status} /></Cell>
              <Cell>{new Date(o.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</Cell>
            </Row>
          );
        })}
      </Table>
    </div>
  );
}
