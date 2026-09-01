"use client";

import { useActionState, useState } from "react";
import { Check, Copy } from "lucide-react";
import { createKeyAction, revokeKeyAction, updateKeyAction, type CreateResult } from "./actions";
import Feedback from "../Feedback";
import type { ActionResult } from "../types";
import { Field, Note, Panel, btnClass, inputClass, quietBtnClass } from "../ui";
import { SCOPES, type Scope } from "@/lib/api/scopes";

export type KeyRow = {
  id: string;
  name: string;
  prefix: string;
  scopes: Scope[];
  allowedOrigins: string[];
  note: string;
  createdBy: string;
  createdAt: string;
  lastUsedAt: string | null;
  lastUsedOrigin: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
};

export default function ApiKeysView({
  keys,
  canWrite,
}: {
  keys: KeyRow[];
  canWrite: boolean;
}) {
  const [created, createFn, creating] = useActionState<CreateResult | null, FormData>(
    createKeyAction,
    null
  );
  const [open, setOpen] = useState<string | null>(null);

  const live = keys.filter((k) => !k.revokedAt);
  const retired = keys.filter((k) => k.revokedAt);

  return (
    <div>
      {/* The secret, once. Rendered above everything because it is the only
          moment it exists and scrolling past it loses it for good. */}
      {created?.ok && <NewKeyBanner token={created.token} />}

      {canWrite && (
        <Panel
          title="New key"
          sub="Name it after the thing that will hold it, not after a person. When somebody asks six months from now what a key is for, the name is the whole answer."
        >
          <form action={createFn} className="flex max-w-[620px] flex-col gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Name" hint="For example: growX CRM website.">
                <input name="name" required minLength={2} maxLength={80} className={inputClass} />
              </Field>
              <Field label="Environment" hint="Only the prefix differs. Both are real credentials.">
                <select name="environment" defaultValue="live" className={inputClass}>
                  <option value="live">live</option>
                  <option value="test">test</option>
                </select>
              </Field>
            </div>

            <ScopePicker />
            <OriginsField />

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Expires in days" hint="0 for no expiry. A key with an end date is one fewer thing to remember to turn off.">
                <input name="expires_days" type="number" min={0} max={3650} defaultValue={0} className={inputClass} />
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
        </Panel>
      )}

      <KeyList
        title="Active"
        rows={live}
        empty="No keys yet. Until one exists, the API answers only what is marked public."
        open={open}
        setOpen={setOpen}
        canWrite={canWrite}
      />

      {retired.length > 0 && (
        <KeyList
          title="Revoked"
          rows={retired}
          empty=""
          open={open}
          setOpen={setOpen}
          canWrite={false}
        />
      )}

      <Note>
        A key authenticates as <code className="font-mono text-[12px]">Authorization: Bearer sx_live_...</code>,
        or as <code className="font-mono text-[12px]">X-Api-Key</code> for tools that cannot set an
        Authorization scheme. Origins are enforced on this server, not only as CORS,
        so a request from a domain that is not listed is refused whether or not a
        browser was involved.
      </Note>
    </div>
  );
}

/* ---------------- the one-time secret ---------------- */

function NewKeyBanner({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Clipboard denied. The value is selectable on screen either way. */
    }
  }

  return (
    <div className="mb-6 border border-[#2B50DC]/40 bg-[#2B50DC]/[0.06] p-5">
      <p className="font-grotesk text-[13.5px] font-semibold text-gray-900 dark:text-white">
        Copy this now. It is not shown again.
      </p>
      <p className="mt-1 max-w-[74ch] text-[12.5px] leading-relaxed text-gray-600 dark:text-gray-400">
        Only a hash is stored, so there is no way to recover this later, for anyone.
        If it is lost, revoke the key and issue another.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <code className="min-w-0 flex-1 overflow-x-auto border border-black/12 bg-white px-3 py-2.5 font-mono text-[12.5px] whitespace-nowrap text-gray-900 dark:border-white/15 dark:bg-[#0C0C12] dark:text-white">
          {token}
        </code>
        <button
          type="button"
          onClick={copy}
          className="inline-flex shrink-0 cursor-pointer items-center gap-2 border border-black/12 bg-white px-3 py-2.5 font-grotesk text-[12.5px] font-semibold text-gray-800 transition-colors hover:border-[#2B50DC]/50 dark:border-white/15 dark:bg-[#0C0C12] dark:text-gray-200"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

/* ---------------- list ---------------- */

function KeyList({
  title,
  rows,
  empty,
  open,
  setOpen,
  canWrite,
}: {
  title: string;
  rows: KeyRow[];
  empty: string;
  open: string | null;
  setOpen: (id: string | null) => void;
  canWrite: boolean;
}) {
  return (
    <section className="mb-8">
      <h3 className="mb-3 font-mono text-[10px] uppercase tracking-[0.13em] text-gray-400 dark:text-gray-600">
        {title}
      </h3>
      <div className="border border-black/10 bg-white dark:border-white/10 dark:bg-[#111118]">
        {rows.length === 0 ? (
          <p className="p-5 text-[13.5px] text-gray-500 dark:text-gray-400">{empty}</p>
        ) : (
          rows.map((k) => (
            <KeyRowItem
              key={k.id}
              row={k}
              isOpen={open === k.id}
              onToggle={() => setOpen(open === k.id ? null : k.id)}
              canWrite={canWrite}
            />
          ))
        )}
      </div>
    </section>
  );
}

function KeyRowItem({
  row,
  isOpen,
  onToggle,
  canWrite,
}: {
  row: KeyRow;
  isOpen: boolean;
  onToggle: () => void;
  canWrite: boolean;
}) {
  const [saveState, saveFn, saving] = useActionState<ActionResult | null, FormData>(
    updateKeyAction,
    null
  );
  const [revokeState, revokeFn] = useActionState<ActionResult | null, FormData>(
    revokeKeyAction,
    null
  );

  const expired = row.expiresAt !== null && new Date(row.expiresAt) <= new Date();

  return (
    <div className="border-b border-black/8 last:border-b-0 dark:border-white/8">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={onToggle}
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3.5 text-left transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
      >
        <span className="font-mono text-[13px] font-semibold text-gray-900 dark:text-white">
          {row.prefix}
        </span>
        <span className="min-w-0 truncate text-[13px] text-gray-600 dark:text-gray-300">
          {row.name}
        </span>

        {row.revokedAt ? (
          <Pill tone="dead">revoked</Pill>
        ) : expired ? (
          <Pill tone="dead">expired</Pill>
        ) : row.allowedOrigins.length > 0 ? (
          <Pill tone="accent">
            {row.allowedOrigins.length === 1
              ? hostOf(row.allowedOrigins[0])
              : `${row.allowedOrigins.length} domains`}
          </Pill>
        ) : (
          <Pill tone="quiet">server side</Pill>
        )}

        <span className="ml-auto shrink-0 font-mono text-[10px] uppercase tracking-[0.1em] text-gray-400 dark:text-gray-500">
          {row.lastUsedAt ? `used ${row.lastUsedAt}` : "never used"}
        </span>
        <span aria-hidden="true" className={`shrink-0 text-gray-400 transition-transform ${isOpen ? "rotate-90" : ""}`}>
          &rsaquo;
        </span>
      </button>

      {isOpen && (
        <div className="px-5 pb-5">
          <dl className="mb-5 grid gap-x-8 gap-y-2 text-[12.5px] sm:grid-cols-2">
            <Meta label="Created">{row.createdAt} by {row.createdBy}</Meta>
            <Meta label="Expires">{row.expiresAt ?? "no expiry"}</Meta>
            <Meta label="Last used">
              {row.lastUsedAt
                ? `${row.lastUsedAt}${row.lastUsedOrigin ? ` from ${row.lastUsedOrigin}` : ""}`
                : "never"}
            </Meta>
            <Meta label="Revoked">{row.revokedAt ?? "no"}</Meta>
          </dl>

          {canWrite ? (
            <form action={saveFn} className="flex max-w-[620px] flex-col gap-5">
              <input type="hidden" name="id" value={row.id} />
              <Field label="Name">
                <input name="name" defaultValue={row.name} required className={inputClass} />
              </Field>
              <ScopePicker selected={row.scopes} />
              <OriginsField value={row.allowedOrigins} />
              <Field label="Note">
                <input name="note" defaultValue={row.note} maxLength={200} className={inputClass} />
              </Field>

              <div className="flex flex-wrap items-center gap-5">
                <button type="submit" disabled={saving} className={`${btnClass} px-5 py-2`}>
                  {saving ? "Saving" : "Save"}
                </button>
                <button
                  formAction={revokeFn}
                  onClick={(e) => {
                    if (!confirm(`Revoke "${row.name}"? Anything using it stops working immediately.`)) {
                      e.preventDefault();
                    }
                  }}
                  className={quietBtnClass}
                >
                  Revoke
                </button>
                <Feedback result={saveState ?? revokeState} />
              </div>
            </form>
          ) : (
            <div className="flex flex-col gap-3 text-[12.5px]">
              <Meta label="Scopes">{row.scopes.join(", ") || "none"}</Meta>
              <Meta label="Allowed origins">
                {row.allowedOrigins.join(", ") || "none, server side only"}
              </Meta>
              {row.note && <Meta label="Note">{row.note}</Meta>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------- fields ---------------- */

function ScopePicker({ selected = [] }: { selected?: Scope[] }) {
  return (
    <fieldset className="flex flex-col gap-2.5 border-0 p-0">
      <legend className="mb-1 font-grotesk text-[12.5px] font-semibold text-gray-900 dark:text-white">
        Scopes
      </legend>
      {SCOPES.map((s) => (
        <label key={s.key} className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            name="scopes"
            value={s.key}
            defaultChecked={selected.includes(s.key)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[#2B50DC]"
          />
          <span>
            <span className="block font-mono text-[12px] text-gray-900 dark:text-white">
              {s.key}
            </span>
            <span className="mt-0.5 block max-w-[68ch] text-[11.5px] leading-relaxed text-gray-500">
              {s.help}
            </span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

/**
 * The domain allowlist.
 *
 * The hint carries the rule because the empty state is the surprising one: an
 * empty box is the most restrictive setting for a browser, not the least. That
 * inverts what a blank field usually means, so it gets said in the place
 * somebody is looking when they leave it blank.
 */
function OriginsField({ value = [] }: { value?: string[] }) {
  return (
    <Field
      label="Allowed domains"
      hint="One per line. Only these origins may use this key from a browser, and a request from anywhere else is refused. Leave it empty for a server side key, which no browser can use at all."
    >
      <textarea
        name="origins"
        defaultValue={value.join("\n")}
        rows={3}
        spellCheck={false}
        placeholder="https://growxcrm.com"
        className={`${inputClass} font-mono text-[12.5px] leading-relaxed`}
      />
    </Field>
  );
}

/* ---------------- small parts ---------------- */

function Pill({ children, tone }: { children: React.ReactNode; tone: "accent" | "quiet" | "dead" }) {
  const tones = {
    accent: "border-[#2B50DC]/40 text-[#2B50DC] dark:border-[#5B8DEF]/40 dark:text-[#5B8DEF]",
    quiet: "border-black/12 text-gray-500 dark:border-white/15 dark:text-gray-400",
    dead: "border-rose-500/35 text-rose-600 dark:text-rose-400",
  };
  return (
    <span className={`shrink-0 border px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.12em] ${tones[tone]}`}>
      {children}
    </span>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-gray-400 dark:text-gray-600">
        {label}
      </dt>
      <dd className="min-w-0 text-gray-600 dark:text-gray-300">{children}</dd>
    </div>
  );
}

function hostOf(origin: string): string {
  try {
    return new URL(origin).host;
  } catch {
    return origin;
  }
}
