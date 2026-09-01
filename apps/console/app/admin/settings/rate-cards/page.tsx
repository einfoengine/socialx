import Link from "next/link";
import { requirePermission } from "@/lib/dal/permissions";
import { createClient } from "@socialx/core/supabase/server";
import RateCardsForm, { type CardRow } from "./RateCardsForm";
import { Note, ReadOnlyNotice, SectionHead } from "../ui";

export const dynamic = "force-dynamic";

/**
 * Rate cards.
 *
 * Which pricing is live and for how long. Every checkout link resolves its
 * amount server side against whatever this says, so closing the launch offer is
 * a date on this screen rather than a deploy and rather than reissuing links.
 */
export default async function RateCardsPage() {
  const access = await requirePermission("settings");
  const canWrite = access.permissions.settings === "full";
  const supabase = await createClient();

  const { data } = await supabase
    .from("rate_cards")
    .select("key, label, is_active, active_from, active_to, sort")
    .order("sort");

  const cards: CardRow[] = (data ?? []).map((c) => ({
    key: c.key as string,
    label: c.label as string,
    isActive: c.is_active === true,
    activeFrom: (c.active_from as string | null) ?? null,
    activeTo: (c.active_to as string | null) ?? null,
    sort: (c.sort as number) ?? 0,
  }));

  return (
    <div>
      <SectionHead
        title="Rate cards"
        sub="Which pricing is live, and until when. Checkout takes the highest sorted active card whose window covers today."
      />

      {!canWrite && <ReadOnlyNotice />}

      <RateCardsForm cards={cards} canWrite={canWrite} />

      <Note>
        Giving the launch offer an end date is all it takes to fall back to
        regular pricing, with no code change and no reissued links. Amounts
        themselves are not here: what each card charges per plan and cycle is on{" "}
        <Link href="/admin/packages" className="text-[#2B50DC] dark:text-[#5B8DEF]">
          Packages
        </Link>
        . This screen decides which card applies, not what it says.
      </Note>
    </div>
  );
}
