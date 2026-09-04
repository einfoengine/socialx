import type { Metadata } from "next";
import { pageMeta } from "@/lib/page-meta";
import { requirePermission } from "@/lib/dal/permissions";
import { createClient } from "@/lib/core/supabase/server";
import { PageHead } from "@/components/DataTable";
import { listAccounts } from "@/lib/dal/accounts";
import PeopleView from "./PeopleView";
import { applySiteFilter } from "@/lib/dal/scoped";
import { adminSiteContext } from "@/lib/sites/admin";

export const metadata: Metadata = { title: "People | Admin" };

/* The roster comes from the Auth admin API, which is never cached. */
export const dynamic = "force-dynamic";

export default async function PeoplePage() {
  const session = await requirePermission("people");
  const supabase = await createClient();

  /* The roster spans every site, because staff belong to none and an account is
     an account. The organization picker does not: attaching a person to a client
     is an act inside one site, and offering another site's clients here is how
     somebody gets access to a company they have never heard of. */
  const { filterId } = await adminSiteContext();

  const [accounts, { data: orgs }] = await Promise.all([
    listAccounts(),
    applySiteFilter(supabase.from("organizations").select("id, name"), filterId).order("name"),
  ]);

  return (
    <div>
      <PageHead {...pageMeta("/admin/people")} />
      <PeopleView accounts={accounts} orgs={orgs ?? []} currentUserId={session.userId} />
    </div>
  );
}
