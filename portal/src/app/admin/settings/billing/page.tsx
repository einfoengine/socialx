import Link from "next/link";
import { pageMeta } from "@/lib/page-meta";
import { requirePermission } from "@/lib/dal/permissions";
import { DEFINITIONS, readSettings } from "@/lib/settings";
import { freshness } from "@/lib/core/payments";
import { adminSiteContext } from "@/lib/sites/admin";
import { billingMaxAgeHours, recentSyncs } from "@/lib/billing/external";
import SettingsForm from "../SettingsForm";
import { Mono, Note, Panel, ReadOnlyNotice, SectionHead } from "../ui";

export const dynamic = "force-dynamic";

/**
 * Payments.
 *
 * One switch and one number, and between them they decide whether this platform
 * ever asks another system what it charged.
 *
 * The switch is the same shape as the order sources next door, for the same
 * reason: which sites bill through their own processor is a commercial
 * arrangement recorded on each site, and this is the single edit that stops the
 * arrangement everywhere at once. It ships off. A platform nobody has asked to
 * import billing should not be making scheduled outbound requests carrying a
 * stored credential.
 *
 * What the switch deliberately does not do is rewrite history. Turning it off
 * stops the fetching; the subscriptions and invoices already imported keep
 * showing as external, because that is where those clients' money actually goes
 * and a billing screen that changed its story with a platform setting would be
 * lying to them.
 *
 * The staleness number exists because imported billing has an age and Stripe
 * data does not. A figure fetched nightly is fine at breakfast and misleading a
 * week later, and the only honest way to render it is with how old it is. This
 * is where an operator says what old means for the feeds they have agreed to.
 */
export default async function BillingSettingsPage() {
  const access = await requirePermission("settings");
  const canWrite = access.permissions.settings === "full";

  const [settings, ctx, maxAge] = await Promise.all([
    readSettings(),
    adminSiteContext(),
    billingMaxAgeHours(),
  ]);
  const { site } = ctx;

  const enabled = settings["billing.external_collection"] === true;
  const runs = site ? await recentSyncs(site.id, 1) : [];
  const last = runs[0] ?? null;
  const age = freshness(last?.finishedAt ?? null, maxAge);

  const fields = DEFINITIONS.filter((d) => d.group === "Billing");

  return (
    <div>
      <SectionHead {...pageMeta("/admin/settings/billing")} />

      {!canWrite && <ReadOnlyNotice />}

      <Panel>
        <SettingsForm group="Billing" fields={fields} values={settings} canWrite={canWrite} />
      </Panel>

      <Panel>
        <h2 className="font-grotesk text-[13px] font-semibold text-gray-900 dark:text-white">
          {site ? `In effect for ${site.name}` : "In effect"}
        </h2>
        <p className="mt-1 max-w-[70ch] text-[11.5px] leading-relaxed text-gray-500">
          A site imports its billing only when the switch above is on and the site
          itself is set to collect. This is the result of both, for the site
          selected in the top bar.
        </p>

        {!site ? (
          <p className="mt-4 text-[12.5px] text-gray-500">
            No site is selected. Pick one in the top bar.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2 text-[12.5px]">
            <Line
              label="This site collects"
              value={site.paymentCollection === "external" ? "yes" : "no, the platform does"}
              good={site.paymentCollection === "external"}
            />
            <Line
              label="Importing"
              value={
                site.paymentCollection !== "external"
                  ? "nothing to import"
                  : !enabled
                    ? "off platform-wide"
                    : site.billingFeedUrl
                      ? "on"
                      : "no feed address set"
              }
              good={site.paymentCollection === "external" && enabled && Boolean(site.billingFeedUrl)}
            />
            {site.paymentCollection === "external" && (
              <Line
                label="Last import"
                value={
                  last
                    ? `${age.label}${last.ok === false ? ", and it failed" : ""}`
                    : "never fetched"
                }
                good={Boolean(last?.ok) && !age.stale}
              />
            )}
          </ul>
        )}

        {site && (
          <p className="mt-5 text-[11.5px] text-gray-500">
            Change how this site is billed, and what its feed is, on{" "}
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
        Imports run on a schedule that is not part of this application: point one
        at <Mono>/api/internal/billing/sync</Mono> hourly, with the same{" "}
        <Mono>CRON_SECRET</Mono> the webhook drain uses. Without it the switch
        above still works and Fetch now on a site record still works, but nothing
        happens on its own, which shows up as billing that is only ever as fresh
        as the last person who pressed the button.
      </Note>
    </div>
  );
}

function Line({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <li className="flex items-baseline justify-between gap-6">
      <span className="text-gray-900 dark:text-white">{label}</span>
      <span
        className={`font-mono text-[10.5px] uppercase tracking-[0.08em] ${
          good ? "text-emerald-700 dark:text-emerald-400" : "text-gray-500"
        }`}
      >
        {value}
      </span>
    </li>
  );
}
