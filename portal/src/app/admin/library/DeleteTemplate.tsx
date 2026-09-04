"use client";

import { useActionState } from "react";
import { deleteTemplate, type DeleteResult } from "./actions";

/**
 * The delete affordance on a library card. Every card gets one, in use or not.
 *
 * Delete here is real deletion, versions and variants included. For a template
 * client posts were built from, the confirm says exactly what that costs: the
 * posts keep their content, since a post copies its copy at build time, and
 * lose only the link recording which template they came from.
 */
export default function DeleteTemplate({ id, code, inUse }: { id: string; code: string; inUse: number }) {
  const [state, formAction] = useActionState<DeleteResult | null, FormData>(deleteTemplate, null);

  const warning =
    inUse > 0
      ? `Delete ${code}? It is in use by ${inUse} client post${inUse === 1 ? "" : "s"}. ` +
        `${inUse === 1 ? "That post keeps" : "Those posts keep"} their content but lose the link to this template.`
      : `Delete ${code}? Its versions and variants go with it.`;

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="id" value={id} />
      <button
        onClick={(e) => {
          if (!confirm(warning)) e.preventDefault();
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
