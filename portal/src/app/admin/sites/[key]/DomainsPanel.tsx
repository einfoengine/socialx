"use client";

import { useActionState, useState } from "react";
import { Check, Copy } from "lucide-react";
import { VERIFICATION_PATH } from "@/lib/core/sites";
import { addDomainAction, removeDomainAction, verifyDomainAction } from "../actions";
import { Field, Note, Panel, btnClass, inputClass, quietBtnClass } from "../../settings/ui";
import type { ActionResult } from "../../settings/types";

export type DomainRow = {
  id: string;
  origin: string;
  purpose: "browser" | "portal";
  token: string;
  verifiedAt: string | null;
  lastCheckedAt: string | null;
  lastError: string | null;
};

/**
 * The domains this site has proved it controls.
 *
 * Verification is the gate everything else on this page hangs off. A key cannot
 * name an origin that is not verified here, and a host cannot serve this site's
 * portal unless it is. That ordering is the reason this panel sits above
 * credentials rather than below them.
 *
 * The instruction is rendered with the actual token in it rather than as a
 * description of what to do, because the failure mode of a verification flow is
 * always somebody publishing nearly the right thing.
 */
export default function DomainsPanel({
  siteId,
  siteKey,
  domains,
  canWrite,
}: {
  siteId: string;
  siteKey: string;
  domains: DomainRow[];
  canWrite: boolean;
}) {
  const [added, addFn, adding] = useActionState<ActionResult | null, FormData>(
    addDomainAction,
    null
  );

  return (
    <Panel
      title="Domains"
      sub="An origin is a claim until it is proved. Publish the token at the address shown, then verify: the platform fetches it from that exact origin, follows no redirect, and compares the whole file."
    >
      {canWrite && (
        <form action={addFn} className="mb-6 flex max-w-[620px] flex-col gap-5">
          <input type="hidden" name="site_id" value={siteId} />
          <input type="hidden" name="key" value={siteKey} />

          <div className="grid gap-5 sm:grid-cols-[1fr_auto]">
            <Field label="Origin" hint="Scheme and host, no path. https everywhere except localhost.">
              <input
                name="origin"
                required
                placeholder="https://example.com"
                className={inputClass}
              />
            </Field>
            <Field label="Used for" hint="Browser calls, or serving the portal.">
              <select name="purpose" defaultValue="browser" className={inputClass}>
                <option value="browser">Browser API</option>
                <option value="portal">Portal</option>
              </select>
            </Field>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <button type="submit" disabled={adding} className={btnClass}>
              {adding ? "Adding" : "Add domain"}
            </button>
            {added && (
              <p
                className={`text-[12.5px] ${
                  added.ok
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {added.ok ? added.message : added.error}
              </p>
            )}
          </div>
        </form>
      )}

      {domains.length === 0 ? (
        <p className="text-[13px] text-gray-500">
          No domains yet. Until one is verified this site cannot be called from a
          browser and cannot serve a portal of its own.
        </p>
      ) : (
        <ul className="flex flex-col">
          {domains.map((domain) => (
            <DomainItem key={domain.id} domain={domain} siteKey={siteKey} canWrite={canWrite} />
          ))}
        </ul>
      )}

      <Note>
        Verification proves control of an origin rather than ownership of a domain,
        which is the narrower thing that actually matters here: a browser sends
        scheme, host and port, and only serving a file at that exact address proves
        anything about it. Clearing a verification cuts browser access everywhere at
        once, with no keys to go and edit.
      </Note>
    </Panel>
  );
}

function DomainItem({
  domain,
  siteKey,
  canWrite,
}: {
  domain: DomainRow;
  siteKey: string;
  canWrite: boolean;
}) {
  const [verified, verifyFn, verifying] = useActionState<ActionResult | null, FormData>(
    verifyDomainAction,
    null
  );
  const [, removeFn, removing] = useActionState<ActionResult | null, FormData>(
    removeDomainAction,
    null
  );
  const [copied, setCopied] = useState(false);

  const isVerified = Boolean(domain.verifiedAt);

  return (
    <li className="border-b border-black/8 py-4 last:border-0 dark:border-white/8">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <code className="font-mono text-[13px] text-gray-900 dark:text-white">{domain.origin}</code>
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-gray-400">
          {domain.purpose === "portal" ? "portal" : "browser"}
        </span>
        <span
          className={`border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] ${
            isVerified
              ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
              : "border-amber-500/40 text-amber-600 dark:text-amber-400"
          }`}
        >
          {isVerified ? "verified" : "unproven"}
        </span>
      </div>

      {isVerified ? (
        <p className="mt-1.5 text-[12.5px] text-gray-500">Verified {domain.verifiedAt}.</p>
      ) : (
        <div className="mt-3 max-w-[70ch] border border-black/10 bg-black/[0.02] p-4 dark:border-white/10 dark:bg-white/[0.03]">
          <p className="text-[12.5px] leading-relaxed text-gray-600 dark:text-gray-400">
            Serve this file, containing exactly this token and nothing else:
          </p>
          <p className="mt-2 font-mono text-[11.5px] break-all text-gray-500">
            {domain.origin}
            {VERIFICATION_PATH}
          </p>
          <div className="mt-2 flex items-center gap-3">
            <code className="font-mono text-[12px] break-all text-gray-900 dark:text-white">
              {domain.token}
            </code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(domain.token);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="shrink-0 cursor-pointer border-0 bg-transparent p-0 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              aria-label="Copy token"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
        </div>
      )}

      {domain.lastError && !isVerified && (
        <p className="mt-2 max-w-[70ch] text-[12.5px] text-rose-600 dark:text-rose-400">
          Last check {domain.lastCheckedAt}: {domain.lastError}
        </p>
      )}

      {verified && (
        <p
          className={`mt-2 text-[12.5px] ${
            verified.ok
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-rose-600 dark:text-rose-400"
          }`}
        >
          {verified.ok ? verified.message : verified.error}
        </p>
      )}

      {canWrite && (
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <form action={verifyFn}>
            <input type="hidden" name="id" value={domain.id} />
            <input type="hidden" name="key" value={siteKey} />
            <button
              type="submit"
              disabled={verifying}
              className="cursor-pointer border border-black/15 bg-transparent px-3 py-1.5 font-grotesk text-[12px] font-semibold text-gray-700 transition-colors hover:bg-black/[0.04] disabled:opacity-50 dark:border-white/15 dark:text-gray-200 dark:hover:bg-white/[0.06]"
            >
              {verifying ? "Checking" : isVerified ? "Re-check" : "Verify"}
            </button>
          </form>

          <form action={removeFn}>
            <input type="hidden" name="id" value={domain.id} />
            <input type="hidden" name="key" value={siteKey} />
            <button type="submit" disabled={removing} className={quietBtnClass}>
              {removing ? "Removing" : "Remove"}
            </button>
          </form>
        </div>
      )}
    </li>
  );
}
