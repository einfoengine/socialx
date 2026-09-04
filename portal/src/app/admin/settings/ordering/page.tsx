import Link from "next/link";
import { pageMeta } from "@/lib/page-meta";
import { requirePermission } from "@/lib/dal/permissions";
import { DEFINITIONS, readSettings } from "@/lib/settings";
import { ORDER_SOURCES } from "@/lib/core/order-sources";
import { adminSiteContext } from "@/lib/sites/admin";
import { enabledSources } from "@/lib/orders/sources";
import SettingsForm from "../SettingsForm";
import { Note, Panel, ReadOnlyNotice, SectionHead } from "../ui";

export const dynamic = "force-dynamic";

/**
 * Ordering.
 *
 * What can create an order, and what this platform is willing to believe about
 * money it did not watch move.
 *
 * Same two-level shape as the Public API screen, for the same reason. The
 * switches here are platform-wide and are incident controls: one edit stops a
 * source across every site, and turning it back on restores what each site had
 * chosen rather than what somebody remembers. Which sources one website may
 * actually use is a commercial arrangement with that customer, so it lives on
 * the site record next to their credentials and domains.
 *
 * The trust setting below is the one with teeth. Three of the four sources can
 * produce a paid order without a payment processor confirming anything: an
 * operator ticking paid, and an integrator posting an order it says it
 * collected. Holding those for approval is the shipped default because the two
 * mistakes are not symmetrical. A held order is a delay somebody notices; an
 * auto-provisioned one on a leaked key is a live account nobody does.
 */
export default async function OrderingSettingsPage() {
  const access = await requirePermission("settings");
  const canWrite = access.permissions.settings === "full";

  const [settings, ctx] = await Promise.all([readSettings(), adminSiteContext()]);
  const { site } = ctx;
  const forSite = await enabledSources(site?.id ?? null);

  const fields = DEFINITIONS.filter((d) => d.group === "Orders");

  return (
    <div>
      <SectionHead {...pageMeta("/admin/settings/ordering")} />

      {!canWrite && <ReadOnlyNotice />}

      <Panel>
        <SettingsForm group="Orders" fields={fields} values={settings} canWrite={canWrite} />
      </Panel>

      <Panel>
        <h2 className="font-grotesk text-[13px] font-semibold text-gray-900 dark:text-white">
          {site ? `In effect for ${site.name}` : "In effect"}
        </h2>
        <p className="mt-1 max-w-[70ch] text-[11.5px] leading-relaxed text-gray-500">
          A source works only when the switch above is on and the site lists it.
          This is the result of both, for the site selected in the top bar.
        </p>

        {!site ? (
          <p className="mt-4 text-[12.5px] text-gray-500">
            No site is selected, so nothing can be sold. Pick one in the top bar.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {ORDER_SOURCES.map((s) => {
              const master = settings[`orders.source.${s.key}`] === true;
              const live = forSite.includes(s.key);
              /* Why it is off matters more than that it is off. "The switch is
                 on but this site does not list it" and "the switch is off for
                 everybody" send an operator to two different screens. */
              const state = live
                ? "on"
                : master
                  ? "not listed on this site"
                  : "off platform-wide";
              return (
                <li key={s.key} className="flex items-baseline justify-between gap-6">
                  <span className="text-[12.5px] text-gray-900 dark:text-white">{s.label}</span>
                  <span
                    className={`font-mono text-[10.5px] uppercase tracking-[0.08em] ${
                      live ? "text-emerald-700 dark:text-emerald-400" : "text-gray-500"
                    }`}
                  >
                    {state}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {site && (
          <p className="mt-5 text-[11.5px] text-gray-500">
            Change what this site may use on{" "}
            <Link
              href={`/admin/sites/${site.key}`}
              className="text-[#2B50DC] no-underline hover:underline dark:text-[#5B8DEF]"
            >
              its record
            </Link>
            .
          </p>
        )}
      </Panel>

      <Note>
        A card confirmed by Stripe is never held for approval, whatever the trust
        setting says, because there is nothing left to take on trust. The setting
        reaches exactly the two cases where this platform has only somebody&apos;s
        word: an operator marking an order paid, and an external system reporting
        one it collected itself.
      </Note>
    </div>
  );
}
