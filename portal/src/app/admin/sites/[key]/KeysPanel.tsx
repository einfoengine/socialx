"use client";

import { useActionState, useState } from "react";
import { Check, Copy } from "lucide-react";
import { createKeyAction, revokeKeyAction, type CreateKeyResult } from "../actions";
import { Field, Note, Panel, btnClass, inputClass, quietBtnClass } from "../../settings/ui";
import type { ActionResult } from "../../settings/types";
import { SCOPES, type Scope } from "@/lib/api/scopes";

export type KeyRow = {
  id: string;
  name: string;
  prefix: string;
  scopes: Scope[];
  allowedOrigins: string[];
  note: string;
  createdAt: string;
  lastUsedAt: string | null;
  lastUsedOrigin: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
};

/**
 * Credentials, bounded to this site.
 *
 * The origin control is a list of checkboxes over the site's verified domains
 * rather than a free-text box, and that is the one design decision here worth
 * defending. Typing an origin invites a typo that fails at request time on
 * somebody else's website; and since a key can only ever be used from a verified
 * domain anyway, a free-text field would be offering settings that cannot work.
 * No boxes ticked is a server-side key, which is the safer default and the one
 * most integrations should use.
 */
export default function KeysPanel({
  siteId,
  siteKey,
  keys,
  verifiedOrigins,
  canWrite,
}: {
  siteId: string;
  siteKey: string;
  keys: KeyRow[];
  verifiedOrigins: string[];
  canWrite: boolean;
}) {
  const [created, createFn, creating] = useActionState<CreateKeyResult | null, FormData>(
    createKeyAction,
    null
  );

  const live = keys.filter((k) => !k.revokedAt);
  const retired = keys.filter((k) => k.revokedAt);

  return (
    <Panel
      title="API keys"
      sub="Each key speaks for this site and reaches nothing outside it. The secret is shown once, when it is created, and is never recoverable afterwards."
    >
      {created?.ok && <NewKeyBanner token={created.token} />}

      {canWrite && (
        <form action={createFn} className="mb-6 flex max-w-[620px] flex-col gap-5">
          <input type="hidden" name="site_id" value={siteId} />
          <input type="hidden" name="key" value={siteKey} />

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Name" hint="Name the thing that will hold it, not a person.">
              <input name="name" required minLength={2} maxLength={80} className={inputClass} />
            </Field>
            <Field label="Environment" hint="Only the prefix differs. Both are real credentials.">
              <select name="environment" defaultValue="live" className={inputClass}>
                <option value="live">live</option>
                <option value="test">test</option>
              </select>
            </Field>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 font-grotesk text-[12.5px] font-semibold text-gray-900 dark:text-white">
              Scopes
            </legend>
            {SCOPES.map((scope) => (
              <label key={scope.key} className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  name="scopes"
                  value={scope.key}
                  className="mt-1 accent-[#3D4AFF]"
                />
                <span>
                  <span className="font-grotesk text-[13px] text-gray-900 dark:text-white">
                    {scope.label}
                  </span>
                  <span className="ml-2 font-mono text-[11px] text-gray-400">{scope.key}</span>
                  <span className="block max-w-[70ch] text-[12px] leading-relaxed text-gray-500">
                    {scope.help}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 font-grotesk text-[12.5px] font-semibold text-gray-900 dark:text-white">
              Browser origins
            </legend>
            {verifiedOrigins.length === 0 ? (
              <p className="max-w-[70ch] text-[12px] leading-relaxed text-gray-500">
                This site has no verified browser domain, so this key will be server
                side only. That is the right answer whenever the calling code has a
                server to make the request from. Verify a domain above to allow
                browser use.
              </p>
            ) : (
              <>
                <p className="mb-1 max-w-[70ch] text-[12px] leading-relaxed text-gray-500">
                  Leave every box clear for a server-side key. A request carrying an
                  Origin header is refused unless that origin is ticked here and still
                  verified.
                </p>
                {verifiedOrigins.map((origin) => (
                  <label key={origin} className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      name="origins"
                      value={origin}
                      className="accent-[#3D4AFF]"
                    />
                    <code className="font-mono text-[12px] text-gray-700 dark:text-gray-300">
                      {origin}
                    </code>
                  </label>
                ))}
              </>
            )}
          </fieldset>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Expires in days"
              hint="0 for no expiry. A key with an end date is one fewer thing to remember to turn off."
            >
              <input
                name="expires_days"
                type="number"
                min={0}
                max={3650}
                defaultValue={0}
                className={inputClass}
              />
            </Field>
            <Field label="Note" hint="Optional. Where it is configured, who to ask.">
              <input name="note" maxLength={200} className={inputClass} />
            </Field>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <button type="submit" disabled={creating} className={btnClass}>
              {creating ? "Creating" : "Create key"}
            </button>
            {created && !created.ok && (
              <p className="text-[12.5px] text-rose-600 dark:text-rose-400">{created.error}</p>
            )}
          </div>
        </form>
      )}

      <KeyList
        title="Active"
        rows={live}
        empty="No keys yet. Until one exists, this site's API answers only what it has marked public."
        siteKey={siteKey}
        canWrite={canWrite}
      />

      {retired.length > 0 && (
        <KeyList title="Revoked" rows={retired} empty="" siteKey={siteKey} canWrite={false} />
      )}

      <Note>
        A key is the whole credential. There is no second factor on the API and no IP
        allowlist, so the origin list is the thing standing between a key that leaks
        into a public bundle and somebody else using it from their own page. Prefer a
        server-side key with no origins whenever the calling code has a server.
      </Note>
    </Panel>
  );
}

function KeyList({
  title,
  rows,
  empty,
  siteKey,
  canWrite,
}: {
  title: string;
  rows: KeyRow[];
  empty: string;
  siteKey: string;
  canWrite: boolean;
}) {
  if (rows.length === 0) {
    return empty ? <p className="text-[13px] text-gray-500">{empty}</p> : null;
  }

  return (
    <div className="mt-2">
      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-gray-400">
        {title}
      </p>
      <ul className="flex flex-col">
        {rows.map((row) => (
          <KeyItem key={row.id} row={row} siteKey={siteKey} canWrite={canWrite} />
        ))}
      </ul>
    </div>
  );
}

function KeyItem({
  row,
  siteKey,
  canWrite,
}: {
  row: KeyRow;
  siteKey: string;
  canWrite: boolean;
}) {
  const [, revokeFn, revoking] = useActionState<ActionResult | null, FormData>(
    revokeKeyAction,
    null
  );

  return (
    <li className="border-b border-black/8 py-3.5 last:border-0 dark:border-white/8">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-grotesk text-[13.5px] font-semibold text-gray-900 dark:text-white">
          {row.name}
        </span>
        <code className="font-mono text-[11.5px] text-gray-400">{row.prefix}</code>
        {row.revokedAt && (
          <span className="border border-rose-500/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-rose-600 dark:text-rose-400">
            revoked
          </span>
        )}
      </div>

      <p className="mt-1 text-[12.5px] text-gray-500">
        {row.scopes.length ? row.scopes.join(", ") : "no scopes"}
        {" · "}
        {row.allowedOrigins.length
          ? `${row.allowedOrigins.length} ${row.allowedOrigins.length === 1 ? "origin" : "origins"}`
          : "server side only"}
        {row.expiresAt ? ` · expires ${row.expiresAt}` : ""}
      </p>

      <p className="mt-0.5 text-[12px] text-gray-400">
        {row.lastUsedAt
          ? `Last used ${row.lastUsedAt}${row.lastUsedOrigin ? ` from ${row.lastUsedOrigin}` : ""}`
          : "Never used"}
        {" · created "}
        {row.createdAt}
      </p>

      {row.note && <p className="mt-1 text-[12px] text-gray-500">{row.note}</p>}

      {canWrite && !row.revokedAt && (
        <form action={revokeFn} className="mt-2">
          <input type="hidden" name="id" value={row.id} />
          <input type="hidden" name="key" value={siteKey} />
          <button type="submit" disabled={revoking} className={quietBtnClass}>
            {revoking ? "Revoking" : "Revoke"}
          </button>
        </form>
      )}
    </li>
  );
}

/**
 * The secret, once.
 *
 * Rendered above everything because this is the only moment it exists, and
 * scrolling past it loses it for good.
 */
function NewKeyBanner({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="mb-6 border border-emerald-500/40 bg-emerald-500/[0.07] p-4">
      <p className="font-grotesk text-[13px] font-semibold text-gray-900 dark:text-white">
        Copy this now. It is not shown again.
      </p>
      <div className="mt-2 flex items-center gap-3">
        <code className="font-mono text-[12.5px] break-all text-gray-900 dark:text-white">
          {token}
        </code>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(token);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="shrink-0 cursor-pointer border-0 bg-transparent p-0 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          aria-label="Copy key"
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
        </button>
      </div>
    </div>
  );
}
