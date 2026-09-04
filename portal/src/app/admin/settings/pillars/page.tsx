import { requirePermission } from "@/lib/dal/permissions";
import { pageMeta } from "@/lib/page-meta";
import { createClient } from "@/lib/core/supabase/server";
import PillarsForm, { type PillarRow } from "./PillarsForm";
import { Note, ReadOnlyNotice, SectionHead } from "../ui";

export const dynamic = "force-dynamic";

/**
 * Content pillars.
 *
 * The shape of a month before anything is written. Editable because the mix is a
 * strategy call that changes with what is working, and it changing should not
 * wait on a migration.
 *
 * The pillars themselves are not editable here. Adding or retiring one changes
 * what every template in the library is tagged with, so it stays a migration.
 * What this screen moves is the proportions.
 */
export default async function PillarsPage() {
  const access = await requirePermission("settings");
  const canWrite = access.permissions.settings === "full";
  const supabase = await createClient();

  const { data } = await supabase
    .from("pillars")
    .select("key, name, default_mix_pct")
    .order("sort");

  const pillars: PillarRow[] = (data ?? []).map((p) => ({
    key: p.key as string,
    name: p.name as string,
    pct: (p.default_mix_pct as number) ?? 0,
  }));

  return (
    <div>
      <SectionHead {...pageMeta("/admin/settings/pillars")} />

      {!canWrite && <ReadOnlyNotice />}

      <PillarsForm pillars={pillars} canWrite={canWrite} />

      <Note>
        The mix has to total exactly 100, and the save is refused otherwise. A mix
        summing to less than 100 does not fail loudly, it quietly under-fills
        every batch built from it, and the month is already short by the time
        anyone notices. Which pillars exist is a migration, because retiring one
        changes what every template in the library is tagged with.
      </Note>
    </div>
  );
}
