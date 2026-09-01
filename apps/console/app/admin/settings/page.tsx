import { requirePermission } from "@/lib/dal/permissions";
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

  const fields = DEFINITIONS.filter((d) => d.group === "Brand");

  return (
    <div>
      <SectionHead
        title="General"
        sub="How socialX names itself and where it points people. Read at request time, so a change here is live on the next page load."
      />

      {!canWrite && <ReadOnlyNotice />}

      <Panel>
        <SettingsForm group="Brand" fields={fields} values={values} canWrite={canWrite} />
      </Panel>

      <Note>
        Deleting a value is not possible here, and that is deliberate: every
        setting falls back to the value socialX shipped with, so the meaningful
        action is changing one rather than emptying it. What socialX sells and
        what it charges are not settings at all. They live under Money, on
        Packages and Coupons.
      </Note>
    </div>
  );
}
