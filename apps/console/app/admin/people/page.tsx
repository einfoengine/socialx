import type { Metadata } from "next";
import { requirePermission } from "@/lib/dal/permissions";
import { createClient } from "@socialx/core/supabase/server";
import { PageHead } from "@/components/DataTable";
import { listAccounts } from "@/lib/dal/accounts";
import PeopleView from "./PeopleView";

export const metadata: Metadata = { title: "People | socialX Admin" };

/* The roster comes from the Auth admin API, which is never cached. */
export const dynamic = "force-dynamic";

export default async function PeoplePage() {
  const session = await requirePermission("people");
  const supabase = await createClient();

  const [accounts, { data: orgs }] = await Promise.all([
    listAccounts(),
    supabase.from("organizations").select("id, name").order("name"),
  ]);

  return (
    <div>
      <PageHead
        title="People"
        sub="Everyone who can sign in, staff and clients together. Checkout creates client accounts on its own; this is the manual way in."
      />
      <PeopleView accounts={accounts} orgs={orgs ?? []} currentUserId={session.userId} />
    </div>
  );
}
