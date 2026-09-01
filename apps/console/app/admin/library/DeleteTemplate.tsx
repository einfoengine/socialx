"use client";

import { useActionState } from "react";
import { deleteTemplate, type DeleteResult } from "./actions";

/**
 * The delete affordance on a library card.
 *
 * A template that client posts were built from cannot be deleted at all; the
 * server refuses regardless, but disabling the button says so before the click
 * instead of after. The confirm covers the remaining case, an unused template,
 * because delete here is real deletion: versions and variants go with it.
 */
export default function DeleteTemplate({ id, code, inUse }: { id: string; code: string; inUse: number }) {
  const [state, formAction] = useActionState<DeleteResult | null, FormData>(deleteTemplate, null);

  if (inUse > 0) {
    return (
      <span
        title={`In use by ${inUse} client post${inUse === 1 ? "" : "s"}. Retire it from its detail page instead.`}
        className="cursor-not-allowed font-mono text-[10px] uppercase tracking-[0.1em] text-gray-300 dark:text-gray-600"
      >
        In use
      </span>
    );
  }

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="id" value={id} />
      <button
        onClick={(e) => {
          if (!confirm(`Delete ${code}? Its versions and variants go with it.`)) e.preventDefault();
        }}
        className="cursor-pointer border-0 bg-transparent p-0 font-mono text-[10px] uppercase tracking-[0.1em] text-gray-400 hover:text-rose-500"
      >
        Delete
      </button>
      {state && !state.ok && (
        <span className="max-w-[180px] text-right text-[10.5px] leading-snug text-rose-600 dark:text-rose-400">
          {state.error}
        </span>
      )}
    </form>
  );
}
