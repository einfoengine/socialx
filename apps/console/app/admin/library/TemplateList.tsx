"use client";

import { useState, useActionState } from "react";
import Link from "next/link";
import { Status } from "@/components/DataTable";
import DeleteTemplate from "./DeleteTemplate";
import { bulkTemplates, type DeleteResult } from "./actions";

/**
 * The template cards, client side because bulk actions are selection, and
 * selection is state shared across every card. The page keeps all the data
 * assembly; what arrives here is already plain values.
 *
 * The bulk bar offers publish, retire, delete. Delete follows the same rule as
 * the per-card button, applied per template on the server: used templates
 * survive and the result message counts both halves. Selection clears after a
 * successful action because the rows it referred to just changed under it.
 */
export type TemplateItem = {
  id: string;
  code: string;
  title: string;
  pillar: string;
  format: string;
  status: string;
  features: string[];
  beats: { hook: string | null; middle: string | null; outcome: string | null };
  platforms: string[];
  version: number;
  imageUrl: string | null;
  inUse: number;
};

export default function TemplateList({
  items,
  canWrite,
}: {
  items: TemplateItem[];
  canWrite: boolean;
}) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [state, bulkFn, busy] = useActionState<DeleteResult | null, FormData>(bulkTemplates, null);

  /* Selection clears when a bulk action succeeds, because the rows it referred
     to just changed underneath it. Done during render against the last handled
     result, the React pattern for deriving state from a changed input, rather
     than in an effect. */
  const [handled, setHandled] = useState<DeleteResult | null>(null);
  if (state !== handled) {
    setHandled(state);
    if (state?.ok && sel.size) setSel(new Set());
  }

  const toggle = (id: string) =>
    setSel((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allSelected = sel.size === items.length && items.length > 0;

  return (
    <div>
      {canWrite && (
        <div className="mb-3 flex min-h-[34px] flex-wrap items-center gap-4">
          <label className="flex cursor-pointer items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => setSel(allSelected ? new Set() : new Set(items.map((i) => i.id)))}
              className="h-3.5 w-3.5 accent-[#2B50DC]"
            />
            Select all
          </label>

          {sel.size > 0 && (
            <form action={bulkFn} className="flex flex-wrap items-center gap-3">
              {[...sel].map((id) => (
                <input key={id} type="hidden" name="ids" value={id} />
              ))}
              <span className="font-grotesk text-[12.5px] font-semibold text-gray-900 dark:text-white">
                {sel.size} selected
              </span>
              <BulkButton op="publish" busy={busy}>Publish</BulkButton>
              <BulkButton op="retire" busy={busy}>Retire</BulkButton>
              <BulkButton
                op="delete"
                busy={busy}
                danger
                onClick={(e) => {
                  if (!confirm(`Delete ${sel.size} template${sel.size === 1 ? "" : "s"}? Templates in use by client posts are kept.`)) {
                    e.preventDefault();
                  }
                }}
              >
                Delete
              </BulkButton>
              <button
                type="button"
                onClick={() => setSel(new Set())}
                className="cursor-pointer border-0 bg-transparent p-0 font-mono text-[10px] uppercase tracking-[0.1em] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                Clear
              </button>
            </form>
          )}

          {state && (
            <span className={`text-xs ${state.ok ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
              {state.ok ? state.message : state.error}
            </span>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {items.map((t) => (
          <article
            key={t.id}
            className={`flex gap-4 border bg-white p-4 dark:bg-[#111118] ${
              sel.has(t.id)
                ? "border-[#2B50DC]/50 dark:border-[#5B8DEF]/50"
                : "border-black/10 dark:border-white/10"
            }`}
          >
            {canWrite && (
              <input
                type="checkbox"
                checked={sel.has(t.id)}
                onChange={() => toggle(t.id)}
                aria-label={`Select ${t.code}`}
                className="mt-1 h-3.5 w-3.5 shrink-0 accent-[#2B50DC]"
              />
            )}
            {t.imageUrl && (
              /* eslint-disable-next-line @next/next/no-img-element -- arbitrary remote host */
              <img
                src={t.imageUrl}
                alt=""
                loading="lazy"
                className="h-[92px] w-[92px] shrink-0 border border-black/10 object-cover dark:border-white/10"
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <span className="font-mono text-[10.5px] text-gray-400">{t.code}</span>
                <Link
                  href={`/admin/library/${t.id}`}
                  className="font-grotesk text-[15px] font-semibold text-gray-900 no-underline hover:text-[#2B50DC] dark:text-white dark:hover:text-[#5B8DEF]"
                >
                  {t.title}
                </Link>
                <Status value={t.status} />
                <Tag>{t.pillar.replace(/_/g, " ")}</Tag>
                {t.format === "motion" && <Tag accent>motion</Tag>}
                {t.features.map((f) => (
                  <Tag key={f}>{f}</Tag>
                ))}
              </div>

              {/* The copy law as columns, so a draft that leads with the product
                  is visible at a glance rather than buried in one body field. */}
              <dl className="mt-2 grid gap-x-5 gap-y-1 sm:grid-cols-3">
                {(
                  [
                    ["Hook", t.beats.hook],
                    ["HL feature", t.beats.middle],
                    ["Outcome", t.beats.outcome],
                  ] as const
                )
                  .filter(([, val]) => val)
                  .map(([k, val]) => (
                    <div key={k}>
                      <dt className="mb-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-gray-400">
                        {k}
                      </dt>
                      <dd className="text-[12.5px] leading-snug text-gray-600 dark:text-gray-400">
                        {val}
                      </dd>
                    </div>
                  ))}
              </dl>

              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {t.platforms.map((x) => (
                  <span key={x} className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-gray-400">
                    {x}
                  </span>
                ))}
                <span className="ml-auto font-mono text-[9.5px] uppercase tracking-[0.1em] text-gray-400">
                  v{t.version}
                </span>
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-end justify-between gap-2">
              <Link
                href={`/admin/library/${t.id}`}
                className="font-mono text-[10px] uppercase tracking-[0.1em] text-gray-500 no-underline hover:text-[#2B50DC]"
              >
                {canWrite ? "Edit" : "Open"}
              </Link>
              {canWrite && <DeleteTemplate id={t.id} code={t.code} inUse={t.inUse} />}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function BulkButton({
  op,
  busy,
  danger,
  onClick,
  children,
}: {
  op: string;
  busy: boolean;
  danger?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      name="op"
      value={op}
      disabled={busy}
      onClick={onClick}
      className={`cursor-pointer border px-3 py-1.5 font-grotesk text-[12px] font-semibold transition-colors disabled:opacity-50 ${
        danger
          ? "border-rose-500/40 text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
          : "border-black/15 text-gray-700 hover:bg-black/[0.04] dark:border-white/15 dark:text-gray-300 dark:hover:bg-white/[0.06]"
      }`}
    >
      {children}
    </button>
  );
}

function Tag({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span
      className={`border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.11em] ${
        accent
          ? "border-[#2B50DC]/40 text-[#2B50DC] dark:text-[#5B8DEF]"
          : "border-black/12 text-gray-500 dark:border-white/15"
      }`}
    >
      {children}
    </span>
  );
}
