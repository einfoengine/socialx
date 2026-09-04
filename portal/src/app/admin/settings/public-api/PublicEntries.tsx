"use client";

import { useActionState } from "react";
import { setPublicAction } from "./actions";
import Feedback from "../Feedback";
import type { ActionResult } from "../types";

export type ContentRow = {
  key: string;
  description: string;
  isPublic: boolean;
  updatedAt: string;
};

/**
 * Which entries answer without a credential.
 *
 * The toggle is a form button rather than a checkbox that saves on change. An
 * accidental brush against a checkbox would publish something, and there is no
 * undo that unpublishes it from whatever already fetched it.
 */
export default function PublicEntries({
  siteId,
  rows,
  canWrite,
}: {
  siteId: string;
  rows: ContentRow[];
  canWrite: boolean;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    setPublicAction,
    null
  );

  if (rows.length === 0) {
    return (
      <p className="text-[13.5px] text-gray-500 dark:text-gray-400">
        There is no site content yet. Entries are created under Content, on Website.
      </p>
    );
  }

  return (
    <div>
      <ul className="border border-black/10 bg-white dark:border-white/10 dark:bg-[#111118]">
        {rows.map((row) => (
          <li
            key={row.key}
            className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-black/8 px-5 py-3.5 last:border-b-0 dark:border-white/8"
          >
            <span className="font-mono text-[13px] font-semibold text-gray-900 dark:text-white">
              {row.key}
            </span>
            <span className="min-w-0 flex-1 truncate text-[12.5px] text-gray-500 dark:text-gray-400">
              {row.description}
            </span>

            <span
              className={`shrink-0 border px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.12em] ${
                row.isPublic
                  ? "border-[#2B50DC]/40 text-[#2B50DC] dark:border-[#5B8DEF]/40 dark:text-[#5B8DEF]"
                  : "border-black/12 text-gray-500 dark:border-white/15 dark:text-gray-400"
              }`}
            >
              {row.isPublic ? "public" : "key only"}
            </span>

            {canWrite && (
              <form action={action} className="shrink-0">
                <input type="hidden" name="site_id" value={siteId} />
                <input type="hidden" name="key" value={row.key} />
                <input type="hidden" name="next" value={row.isPublic ? "false" : "true"} />
                <button
                  type="submit"
                  disabled={pending}
                  onClick={(e) => {
                    if (
                      !row.isPublic &&
                      !confirm(
                        `Publish "${row.key}"? Anyone on the internet will be able to read it with no credential.`
                      )
                    ) {
                      e.preventDefault();
                    }
                  }}
                  className="cursor-pointer border-0 bg-transparent p-0 font-mono text-[10px] uppercase tracking-[0.1em] text-gray-400 transition-colors hover:text-[#2B50DC] disabled:cursor-not-allowed disabled:opacity-50 dark:hover:text-[#5B8DEF]"
                >
                  {row.isPublic ? "Make private" : "Make public"}
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>
      <Feedback result={state} className="mt-3" />
    </div>
  );
}
