"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { PAYMENT_COLLECTION, type BillingSource } from "@/lib/core/payments";
import { fetchBillingAction, updatePaymentsAction } from "../actions";
import { Field, Note, Panel, btnClass, inputClass } from "../../settings/ui";
import type { ActionResult } from "../../settings/types";

/**
 * Who takes this site's money.
 *
 * Two states, and the screen is built around the fact that they are not
 * symmetrical. "This platform collects" needs no configuration at all, because
 * the processor is already wired up and the webhook already runs. "The site
 * collects" needs an address, a credential and a schedule, and it needs somebody
 * to be able to see whether the last fetch worked without opening a log.
 *
 * So the feed fields appear only once external is chosen. A form that showed
 * four disabled boxes to every site on the platform would be teaching everybody
 * about an arrangement almost none of them have.
 *
 * The sync history at the bottom is the part that earns its space. An
 * integration that works is a green line with two counts; one that half works is
 * a green line, two counts and a list of the clients it could not match, which is
 * the actual failure mode of this feature and the one a status boolean hides.
 */

export type SyncRun = {
  id: string;
  kind: string;
  startedAt: string;
  finishedAt: string | null;
  ok: boolean | null;
  httpStatus: number | null;
  subscriptions: number;
  invoices: number;
  skipped: number;
  problems: string[];
  error: string | null;
};

const SAMPLE = `{
  "subscriptions": [
    {
      "id": "sub_9f21",
      "client_email": "nathan@flowstackpro.com",
      "plan": "growth",
      "cycle": "monthly",
      "status": "active",
      "amount": 39700,
      "currency": "usd",
      "current_period_end": "2026-10-01T00:00:00Z",
      "cancel_at_period_end": false,
      "manage_url": "https://billing.example.com/s/9f21"
    }
  ],
  "invoices": [
    {
      "id": "in_4410",
      "client_email": "nathan@flowstackpro.com",
      "number": "INV-4410",
      "amount_paid": 39700,
      "currency": "usd",
      "status": "paid",
      "issued_at": "2026-09-01T09:12:00Z",
      "url": "https://billing.example.com/i/4410"
    }
  ]
}`;

export default function PaymentsPanel({
  siteId,
  siteKey,
  collection,
  feedUrl,
  feedHeader,
  manageUrl,
  hasSecret,
  externalEnabled,
  sellsThroughPlatformCheckout,
  runs,
  canWrite,
}: {
  siteId: string;
  siteKey: string;
  collection: BillingSource;
  feedUrl: string | null;
  feedHeader: string;
  manageUrl: string | null;
  hasSecret: boolean;
  /** The platform switch. Off means nothing is fetched, whatever this site says. */
  externalEnabled: boolean;
  /** Whether this site also sells through the platform's own card checkout. */
  sellsThroughPlatformCheckout: boolean;
  runs: SyncRun[];
  canWrite: boolean;
}) {
  const [mode, setMode] = useState<BillingSource>(collection);
  const [saved, save, saving] = useActionState<ActionResult | null, FormData>(
    updatePaymentsAction,
    null
  );
  const [fetched, fetchNow, fetching] = useActionState<ActionResult | null, FormData>(
    fetchBillingAction,
    null
  );

  const external = mode === "external";

  return (
    <Panel
      title="Payments"
      sub="Whether this platform collects this site's money, or the site collects it somewhere else and this platform imports what happened."
    >
      {external && !externalEnabled && (
        <p className="mb-5 border border-amber-500/40 bg-amber-500/[0.06] px-4 py-3 text-[12.5px] leading-relaxed text-amber-800 dark:text-amber-300">
          External collection is switched off platform-wide, so nothing is fetched
          for this site. Turn it on under{" "}
          <Link href="/admin/settings/billing" className="underline">
            Settings, Payments
          </Link>
          . Billing already imported keeps showing as what it is.
        </p>
      )}

      {external && sellsThroughPlatformCheckout && (
        <p className="mb-5 border border-amber-500/40 bg-amber-500/[0.06] px-4 py-3 text-[12.5px] leading-relaxed text-amber-800 dark:text-amber-300">
          This site still lists the platform&apos;s card checkout as an order source,
          so a new buyer would pay here while its existing clients are billed
          there. That is a real arrangement for a site mid-migration and a mistake
          otherwise. Its sources are further down this page.
        </p>
      )}

      <form action={save} className="flex max-w-[720px] flex-col gap-5">
        <input type="hidden" name="id" value={siteId} />
        <input type="hidden" name="key" value={siteKey} />

        <fieldset className="border-0 p-0">
          <legend className="font-grotesk text-[12.5px] font-semibold text-gray-900 dark:text-white">
            Who collects
          </legend>
          <div className="mt-3 flex flex-col gap-3">
            {PAYMENT_COLLECTION.map((option) => (
              <label key={option.key} className="flex cursor-pointer items-start gap-3">
                <input
                  type="radio"
                  name="payment_collection"
                  value={option.key}
                  checked={mode === option.key}
                  onChange={() => setMode(option.key)}
                  disabled={!canWrite}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[#2B50DC] disabled:cursor-not-allowed disabled:opacity-55"
                />
                <span>
                  <span className="block font-grotesk text-[12.5px] font-semibold text-gray-900 dark:text-white">
                    {option.label}
                  </span>
                  <span className="mt-0.5 block max-w-[70ch] text-[11.5px] leading-relaxed text-gray-500">
                    {option.help}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {external && (
          <div className="flex flex-col gap-5 border-t border-black/8 pt-5 dark:border-white/8">
            <Field
              label="Feed address"
              hint="Fetched hourly and whenever Fetch now is pressed. https, except on localhost. Redirects are refused, because this request carries the secret below."
            >
              <input
                name="billing_feed_url"
                placeholder="https://example.com/portal/billing-feed"
                defaultValue={feedUrl ?? ""}
                disabled={!canWrite}
                className={inputClass}
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Auth header" hint="The header name the feed expects. Authorization unless their system cannot set one.">
                <input
                  name="billing_feed_header"
                  placeholder="Authorization"
                  defaultValue={feedHeader}
                  disabled={!canWrite}
                  className={inputClass}
                />
              </Field>
              <Field
                label={hasSecret ? "Replace the value" : "Header value"}
                hint={
                  hasSecret
                    ? "A value is set. Leave this empty to keep it; anything typed here replaces it."
                    : "Sent exactly as written, so include the scheme: Bearer abc123."
                }
              >
                <input
                  name="billing_feed_secret"
                  type="password"
                  autoComplete="off"
                  placeholder={hasSecret ? "unchanged" : "Bearer abc123"}
                  disabled={!canWrite}
                  className={inputClass}
                />
              </Field>
            </div>

            {hasSecret && canWrite && (
              <label className="-mt-2 flex cursor-pointer items-center gap-2.5 text-[11.5px] text-gray-500">
                <input
                  type="checkbox"
                  name="clear_secret"
                  className="h-3.5 w-3.5 accent-[#2B50DC]"
                />
                Clear the stored value and fetch with no credential.
              </label>
            )}

            <Field
              label="Where clients manage billing"
              hint="Printed in the portal in place of the card management button. A feed can override it per subscription."
            >
              <input
                name="billing_manage_url"
                placeholder="https://example.com/account/billing"
                defaultValue={manageUrl ?? ""}
                disabled={!canWrite}
                className={inputClass}
              />
            </Field>

            <details className="border border-black/10 dark:border-white/10">
              <summary className="cursor-pointer px-4 py-2.5 font-grotesk text-[12px] font-semibold text-gray-900 dark:text-white">
                What the feed has to return
              </summary>
              <div className="border-t border-black/8 px-4 py-3.5 dark:border-white/8">
                <p className="mb-3 max-w-[74ch] text-[11.5px] leading-relaxed text-gray-500">
                  JSON, with either key optional. A subscription is matched to a
                  client by <code className="font-mono">client_email</code> or by{" "}
                  <code className="font-mono">org_id</code>, and only ever to a
                  client this site sold. <code className="font-mono">plan</code>{" "}
                  and <code className="font-mono">cycle</code> name the shared
                  catalogue; <code className="font-mono">amount</code> is cents per
                  cycle and is what the portal prints. Rows that cannot be matched
                  are listed below rather than dropped quietly.
                </p>
                <pre className="overflow-x-auto bg-black/[0.03] p-3 font-mono text-[11px] leading-relaxed text-gray-700 dark:bg-white/[0.04] dark:text-gray-300">
                  {SAMPLE}
                </pre>
              </div>
            </details>
          </div>
        )}

        {canWrite && (
          <div className="flex flex-wrap items-center gap-4">
            <button type="submit" disabled={saving} className={btnClass}>
              {saving ? "Saving" : "Save payments"}
            </button>
            {saved && (
              <p
                className={`text-[12.5px] ${
                  saved.ok
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {saved.ok ? saved.message : saved.error}
              </p>
            )}
          </div>
        )}
      </form>

      {collection === "external" && (
        <div className="mt-7 border-t border-black/8 pt-6 dark:border-white/8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="font-grotesk text-[13px] font-semibold text-gray-900 dark:text-white">
                Imports
              </h4>
              <p className="mt-0.5 max-w-[74ch] text-[11.5px] leading-relaxed text-gray-500">
                The last few attempts, newest first. The scheduler runs the same
                import this button does.
              </p>
            </div>
            {canWrite && (
              <form action={fetchNow}>
                <input type="hidden" name="site_id" value={siteId} />
                <input type="hidden" name="key" value={siteKey} />
                <button
                  type="submit"
                  disabled={fetching}
                  className="cursor-pointer border border-black/15 bg-transparent px-4 py-2 font-grotesk text-[12px] font-semibold text-gray-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/15 dark:text-white"
                >
                  {fetching ? "Fetching" : "Fetch now"}
                </button>
              </form>
            )}
          </div>

          {fetched && (
            <p
              className={`mb-4 text-[12.5px] ${
                fetched.ok
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400"
              }`}
            >
              {fetched.ok ? fetched.message : fetched.error}
            </p>
          )}

          {runs.length === 0 ? (
            <p className="text-[12.5px] text-gray-500">
              Nothing fetched yet. Press Fetch now to see what the feed answers.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {runs.map((run) => (
                <li key={run.id} className="border border-black/10 p-3.5 dark:border-white/10">
                  <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[12.5px]">
                    <span
                      className={`font-mono text-[10px] uppercase tracking-[0.1em] ${
                        run.ok === true
                          ? "text-emerald-700 dark:text-emerald-400"
                          : run.ok === false
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-amber-700 dark:text-amber-400"
                      }`}
                    >
                      {run.ok === true ? "ok" : run.ok === false ? "failed" : "running"}
                    </span>
                    <span className="text-gray-900 dark:text-white">
                      {run.subscriptions} subscriptions, {run.invoices} invoices
                      {run.skipped > 0 && `, ${run.skipped} skipped`}
                    </span>
                    <span className="ml-auto font-mono text-[10.5px] text-gray-500">
                      {run.kind === "operator" ? "by hand" : "scheduled"} at{" "}
                      {run.startedAt.slice(0, 16).replace("T", " ")}
                      {run.httpStatus ? `, http ${run.httpStatus}` : ""}
                    </span>
                  </div>

                  {run.error && (
                    <p className="mt-1.5 text-[12px] text-rose-600 dark:text-rose-400">{run.error}</p>
                  )}

                  {run.problems.length > 0 && (
                    <ul className="mt-2 flex flex-col gap-1">
                      {run.problems.map((problem, i) => (
                        <li key={i} className="text-[11.5px] leading-relaxed text-gray-500">
                          {problem}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Note>
        An imported subscription is a record, not a rail. Nothing here charges
        anybody, nothing cancels anybody, and a client billed this way sees their
        plan and their invoices as read-only facts with a link back to the site
        that bills them. The import also never deletes: a subscription that stops
        appearing in the feed is far more often a partial response than a
        cancellation, and cancellation is a status the feed states.
      </Note>
    </Panel>
  );
}
