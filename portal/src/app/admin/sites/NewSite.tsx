"use client";

import { useActionState } from "react";
import { createSiteAction } from "./actions";
import { Field, Panel, btnClass, inputClass } from "../settings/ui";
import type { ActionResult } from "../settings/types";

/**
 * Registering a website.
 *
 * Two fields, and the second one is optional. Everything else about a site is
 * edited on its own record a moment later, and asking for it here would put a
 * fifteen-field form in front of the one decision being made, which is that this
 * website exists.
 *
 * A new site is created as a draft and its credentials are refused until somebody
 * activates it. That is stated on the button's own panel rather than discovered
 * later when a key returns 403.
 */
export default function NewSite() {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(
    createSiteAction,
    null
  );

  return (
    <Panel
      title="Register a website"
      sub="It starts as a draft. Add its domains, verify them and cut a key on the record that opens next; activate it when the integration is ready to serve."
    >
      <form action={action} className="flex max-w-[620px] flex-col gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Name" hint="What this website is called. Shown to its own customers.">
            <input name="name" required minLength={1} maxLength={80} className={inputClass} />
          </Field>
          <Field
            label="Key"
            hint="Optional. The handle used in URLs and in the X-Site-Key header. Left empty, it is made from the name."
          >
            <input name="key" maxLength={39} placeholder="example-co" className={inputClass} />
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" disabled={pending} className={btnClass}>
            {pending ? "Registering" : "Register site"}
          </button>
          {result && !result.ok && (
            <p className="text-[12.5px] text-rose-600 dark:text-rose-400">{result.error}</p>
          )}
        </div>
      </form>
    </Panel>
  );
}
