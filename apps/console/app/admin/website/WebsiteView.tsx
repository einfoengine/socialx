"use client";

import { useActionState, useState } from "react";
import {
  createEntryAction,
  updateEntryAction,
  deleteEntryAction,
  type ActionResult,
} from "./actions";

export type Entry = {
  key: string;
  description: string;
  json: string;
  updatedAt: string;
  updatedBy: string;
};

const INPUT =
  "bg-transparent border border-black/15 dark:border-white/15 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-hidden focus:border-[#2B50DC] transition-colors w-full";

const TEXTAREA = `${INPUT} min-h-[220px] font-mono text-[12.5px] leading-relaxed`;

/**
 * One screen: create an entry, and an accordion of existing entries that open
 * into an editor in place. Only one editor is open at a time, because two open
 * JSON blobs on one screen is how the wrong one gets saved.
 *
 * Formatting runs the same JSON.parse the server runs, so "Format" doubles as a
 * validity check before the round trip. A parse failure never blocks typing,
 * only saving.
 */
export default function WebsiteView({
  entries,
  canWrite,
}: {
  entries: Entry[];
  canWrite: boolean;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [createState, createFn, creating] = useActionState<ActionResult | null, FormData>(
    createEntryAction,
    null
  );
  const [saveState, saveFn, saving] = useActionState<ActionResult | null, FormData>(
    updateEntryAction,
    null
  );
  const [delState, delFn] = useActionState<ActionResult | null, FormData>(
    deleteEntryAction,
    null
  );
  const rowResult = saveState ?? delState;

  return (
    <div>
      {canWrite && (
        <section className="mb-8 border border-black/10 bg-white dark:border-white/10 dark:bg-[#111118]">
          <div className="border-b border-black/8 px-5 py-4 dark:border-white/8">
            <h2 className="font-grotesk text-[14px] font-semibold text-gray-900 dark:text-white">
              New entry
            </h2>
            <p className="mt-1 max-w-[80ch] text-[12.5px] leading-relaxed text-gray-500 dark:text-gray-400">
              The key is what the site fetches by. Keep it stable once the site reads
              it; deleting or renaming a key sends that part of the site back to its
              built-in default.
            </p>
          </div>
          <form action={createFn} className="flex max-w-[760px] flex-col gap-4 px-5 pb-5 pt-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <F label="Key" hint="Lowercase letters, digits, hyphens. This is the fetch handle.">
                <input name="key" required placeholder="homepage-banner" pattern="[a-z0-9][a-z0-9-]{1,62}" className={INPUT} />
              </F>
              <F label="Description" hint="For the next person. Optional.">
                <input name="description" placeholder="Copy for the launch banner" className={INPUT} />
              </F>
            </div>
            <JsonField name="data" defaultValue={'{\n  \n}'} />
            {createState && <Result r={createState} />}
            <div>
              <button
                type="submit"
                disabled={creating}
                className="btn btn-primary gradient-bg cursor-pointer px-6 py-2.5 font-grotesk text-[13px] font-semibold text-white disabled:opacity-60"
              >
                {creating ? "Creating" : "Create entry"}
              </button>
            </div>
          </form>
        </section>
      )}

      {rowResult && <Result r={rowResult} className="mb-4" />}

      <div className="border border-black/10 bg-white dark:border-white/10 dark:bg-[#111118]">
        {entries.length === 0 ? (
          <p className="p-5 text-[13.5px] text-gray-500 dark:text-gray-400">
            Nothing yet. The site keeps rendering its built-in defaults until an entry
            it looks for exists here.
          </p>
        ) : (
          entries.map((e) => {
            const isOpen = open === e.key;
            return (
              <div key={e.key} className="border-b border-black/8 last:border-b-0 dark:border-white/8">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : e.key)}
                  className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                >
                  <span className="font-mono text-[13px] font-semibold text-gray-900 dark:text-white">
                    {e.key}
                  </span>
                  <span className="min-w-0 truncate text-[12.5px] text-gray-500 dark:text-gray-400">
                    {e.description}
                  </span>
                  <span className="ml-auto shrink-0 font-grotesk text-[11px] uppercase tracking-[0.8px] text-gray-400 dark:text-gray-500">
                    {e.updatedAt} by {e.updatedBy}
                  </span>
                  <span aria-hidden="true" className={`text-gray-400 transition-transform ${isOpen ? "rotate-90" : ""}`}>
                    ›
                  </span>
                </button>

                {isOpen && (
                  <div className="px-5 pb-5">
                    {canWrite ? (
                      <form action={saveFn} className="flex flex-col gap-3">
                        <input type="hidden" name="key" value={e.key} />
                        <F label="Description">
                          <input name="description" defaultValue={e.description} className={INPUT} />
                        </F>
                        <JsonField name="data" defaultValue={e.json} />
                        <div className="flex items-center gap-4">
                          <button
                            type="submit"
                            disabled={saving}
                            className="btn btn-primary gradient-bg cursor-pointer px-5 py-2 font-grotesk text-[12.5px] font-semibold text-white disabled:opacity-60"
                          >
                            {saving ? "Saving" : "Save"}
                          </button>
                          {/* Delete posts through its own action so it cannot be
                              mistaken for save; formAction swaps the target. */}
                          <button
                            formAction={delFn}
                            onClick={(ev) => {
                              if (!confirm(`Delete "${e.key}"? The site falls back to its default.`)) {
                                ev.preventDefault();
                              }
                            }}
                            className="cursor-pointer border-0 bg-transparent p-0 font-mono text-[10px] uppercase tracking-[0.1em] text-gray-400 hover:text-rose-500"
                          >
                            Delete
                          </button>
                        </div>
                      </form>
                    ) : (
                      <pre className="overflow-x-auto border border-black/10 bg-black/[0.02] p-4 font-mono text-[12.5px] leading-relaxed text-gray-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300">
                        {e.json}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/** Textarea plus a Format button that pretty-prints, or says why it cannot. */
function JsonField({ name, defaultValue }: { name: string; defaultValue: string }) {
  const [text, setText] = useState(defaultValue);
  const [problem, setProblem] = useState<string | null>(null);

  function format() {
    try {
      setText(JSON.stringify(JSON.parse(text), null, 2));
      setProblem(null);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "Not valid JSON.");
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="font-grotesk text-[12.5px] font-semibold text-gray-900 dark:text-white">
          JSON
        </span>
        <button
          type="button"
          onClick={format}
          className="cursor-pointer border-0 bg-transparent p-0 font-mono text-[10px] uppercase tracking-[0.1em] text-gray-500 hover:text-[#2B50DC]"
        >
          Format
        </button>
      </div>
      <textarea
        name={name}
        value={text}
        onChange={(ev) => { setText(ev.target.value); setProblem(null); }}
        spellCheck={false}
        className={TEXTAREA}
      />
      {problem && <p className="text-xs text-rose-600 dark:text-rose-400">{problem}</p>}
    </div>
  );
}

function Result({ r, className = "" }: { r: ActionResult; className?: string }) {
  return (
    <p
      className={`text-xs ${
        r.ok ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
      } ${className}`}
    >
      {r.ok ? r.message : r.error}
    </p>
  );
}

function F({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-grotesk text-[12.5px] font-semibold text-gray-900 dark:text-white">
        {label}
      </span>
      {hint && <span className="-mt-1 text-[11.5px] text-gray-500">{hint}</span>}
      {children}
    </label>
  );
}
