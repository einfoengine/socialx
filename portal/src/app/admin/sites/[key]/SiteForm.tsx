"use client";

import { useActionState } from "react";
import type { Site } from "@/lib/core/sites";
import { updateSiteAction } from "../actions";
import { Field, Note, Panel, btnClass, inputClass } from "../../settings/ui";
import type { ActionResult } from "../../settings/types";

/**
 * Identity, reach and skin.
 *
 * Three groups in one form because they are saved together and because a site
 * that has a name and no portal host is half configured in a way worth seeing at
 * a glance rather than across three screens.
 *
 * The status control is at the top and not buried at the bottom, since it is the
 * only field here that changes whether anything works. Everything else is
 * cosmetic or a link; this one refuses every credential the site holds.
 */
export default function SiteForm({ site, canWrite }: { site: Site; canWrite: boolean }) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(
    updateSiteAction,
    null
  );

  return (
    <Panel
      title="The site"
      sub="Who this website is, where it lives, and what its portal looks like. Read at request time, so a change here is live on the next page load."
    >
      <form action={action} className="flex max-w-[720px] flex-col gap-5">
        <input type="hidden" name="id" value={site.id} />
        <input type="hidden" name="key" value={site.key} />

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Name" hint="What this website is called.">
            <input
              name="name"
              required
              maxLength={80}
              defaultValue={site.name}
              disabled={!canWrite}
              className={inputClass}
            />
          </Field>
          <Field
            label="Status"
            hint="Only an active site authenticates. Draft and suspended both refuse every key it holds, immediately."
          >
            <select
              name="status"
              defaultValue={site.status}
              disabled={!canWrite}
              className={inputClass}
            >
              <option value="draft">draft</option>
              <option value="active">active</option>
              <option value="suspended">suspended</option>
            </select>
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Legal name" hint="Optional. The entity behind the brand, for invoices and terms.">
            <input
              name="legal_name"
              maxLength={120}
              defaultValue={site.legalName ?? ""}
              disabled={!canWrite}
              className={inputClass}
            />
          </Field>
          <Field label="Support address" hint="Where this site's customers are told to write.">
            <input
              name="support_email"
              type="email"
              defaultValue={site.supportEmail ?? ""}
              disabled={!canWrite}
              className={inputClass}
            />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Website address" hint="Their own site. The portal links back to it.">
            <input
              name="primary_url"
              placeholder="https://example.com"
              defaultValue={site.primaryUrl ?? ""}
              disabled={!canWrite}
              className={inputClass}
            />
          </Field>
          <Field label="Checkout address" hint="Where a buyer is sent to subscribe.">
            <input
              name="checkout_url"
              placeholder="https://order.example.com"
              defaultValue={site.checkoutUrl ?? ""}
              disabled={!canWrite}
              className={inputClass}
            />
          </Field>
        </div>

        <Field
          label="Portal host"
          hint="The hostname that serves this site's portal. A request arriving here is resolved to this site before any page renders, so it must point at this platform in DNS."
        >
          <input
            name="portal_host"
            placeholder="portal.example.com"
            defaultValue={site.portalHost ?? ""}
            disabled={!canWrite}
            className={inputClass}
          />
        </Field>

        <div className="border-t border-black/8 pt-5 dark:border-white/8">
          <p className="mb-4 font-grotesk text-[12.5px] font-semibold text-gray-900 dark:text-white">
            Brand
          </p>

          <div className="flex flex-col gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Wordmark" hint="Printed where no logo is set. Falls back to the name above.">
                <input
                  name="brand_wordmark"
                  maxLength={40}
                  defaultValue={site.brand.wordmark ?? ""}
                  disabled={!canWrite}
                  className={inputClass}
                />
              </Field>
              <Field label="Favicon URL" hint="https only.">
                <input
                  name="brand_faviconUrl"
                  defaultValue={site.brand.faviconUrl ?? ""}
                  disabled={!canWrite}
                  className={inputClass}
                />
              </Field>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Logo URL" hint="https only. Used on light surfaces.">
                <input
                  name="brand_logoUrl"
                  defaultValue={site.brand.logoUrl ?? ""}
                  disabled={!canWrite}
                  className={inputClass}
                />
              </Field>
              <Field label="Logo URL, dark" hint="Optional. Left empty, the light logo serves both.">
                <input
                  name="brand_logoDarkUrl"
                  defaultValue={site.brand.logoDarkUrl ?? ""}
                  disabled={!canWrite}
                  className={inputClass}
                />
              </Field>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Accent" hint="Hex, like #2B50DC. Links, focus rings, the active nav item.">
                <input
                  name="brand_accent"
                  placeholder="#2B50DC"
                  defaultValue={site.brand.accent ?? ""}
                  disabled={!canWrite}
                  className={inputClass}
                />
              </Field>
              <Field
                label="Accent, dark"
                hint="The same role on a dark surface, where a light accent often fails contrast."
              >
                <input
                  name="brand_accentDark"
                  placeholder="#5B8DEF"
                  defaultValue={site.brand.accentDark ?? ""}
                  disabled={!canWrite}
                  className={inputClass}
                />
              </Field>
            </div>
          </div>
        </div>

        <Field label="Note" hint="Optional. Who owns this integration, what it is for.">
          <input
            name="note"
            maxLength={300}
            defaultValue={site.note ?? ""}
            disabled={!canWrite}
            className={inputClass}
          />
        </Field>

        {canWrite && (
          <div className="flex flex-wrap items-center gap-4">
            <button type="submit" disabled={pending} className={btnClass}>
              {pending ? "Saving" : "Save site"}
            </button>
            {result && (
              <p
                className={`text-[12.5px] ${
                  result.ok
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {result.ok ? result.message : result.error}
              </p>
            )}
          </div>
        )}
      </form>

      <Note>
        Saving here sends a site.updated event to this site&apos;s endpoints, because
        these are exactly the fields another system caches: the support address it
        prints, the checkout it links to, the colors it renders.
      </Note>
    </Panel>
  );
}
