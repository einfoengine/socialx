"use client";

import type { ActionResult } from "./types";

/** One place a server action's answer is rendered, so success and failure never
    end up styled differently on two screens. */
export default function Feedback({
  result,
  className = "",
}: {
  result: ActionResult | null;
  className?: string;
}) {
  if (!result) return null;
  return (
    <p
      role="status"
      className={`text-[12.5px] ${
        result.ok
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-rose-600 dark:text-rose-400"
      } ${className}`}
    >
      {result.ok ? result.message : result.error}
    </p>
  );
}
