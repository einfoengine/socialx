import { requirePermission } from "@/lib/dal/permissions";
import { pageMeta } from "@/lib/page-meta";
import { DEFINITIONS, readSettings } from "@/lib/settings";
import SettingsForm from "./SettingsForm";
import { Note, Panel, ReadOnlyNotice, SectionHead } from "./ui";

export const dynamic = "force-dynamic";

/**
 * General.
 *
 * Values the product reads at runtime, which is the whole reason they are here
 * rather than in an env file: changing the support address should not be a
 * deploy, and it should not be a thing only whoever holds the deploy keys can
 * do. Every one of them has a shipped default in lib/settings.ts, so an empty
 * table renders the same product it always did.
 */
export default async function GeneralSettingsPage() {
  const access = await requirePermission("settings");
  const values = await readSettings();
  const canWrite = access.permissions.settings === "full";

  /* Platform, not Brand. A brand belongs to a site now, and there is no such
     thing as the platform's own brand for a customer to see. */
  const fields = DEFINITIONS.filter((d) => d.group === "Platform");

  return (
    <div>
      <SectionHead {...pageMeta("/admin/settings")} />

      {!canWrite && <ReadOnlyNotice />}

      <Panel>
        <SettingsForm group="Platform" fields={fields} values={values} canWrite={canWrite} />
      </Panel>

      <Note>
        Deleting a value is not possible here, and that is deliberate: every
        setting falls back to the value the platform shipped with, so the meaningful
        action is changing one rather than emptying it. What a website is called,
        where it sends buyers and who its customers write to are not here either:
        those belong to one site, under Sites. What is sold and what it costs are
        not settings at all, and live under Money on Packages and Coupons.
      </Note>
    </div>
  );
}
