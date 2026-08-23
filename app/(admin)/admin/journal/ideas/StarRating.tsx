"use client";

import { useState } from "react";

/**
 * Star rating. One star is a discard, not a low score, so it is styled and worded
 * differently from the rest and asks for confirmation before it removes the idea.
 */
export default function StarRating({
  ideaId,
  rating,
  action,
}: {
  ideaId: string;
  rating: number | null;
  action: (formData: FormData) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? rating ?? 0;

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={ideaId} />
      <div className="flex items-center" onMouseLeave={() => setHover(null)}>
        {[1, 2, 3, 4, 5].map((n) => {
          const isDiscard = n === 1;
          const lit = n <= shown;
          return (
            <button
              key={n}
              type="submit"
              name="rating"
              value={n}
              onMouseEnter={() => setHover(n)}
              title={isDiscard ? "One star discards this idea" : `Rate ${n}`}
              aria-label={isDiscard ? "One star, discards this idea" : `Rate ${n} of 5`}
              onClick={(e) => {
                if (isDiscard && !confirm("One star deletes this idea. Remove it?")) {
                  e.preventDefault();
                }
              }}
              className={`px-0.5 text-[17px] leading-none bg-transparent border-0 cursor-pointer transition-colors ${
                lit
                  ? hover === 1 && isDiscard
                    ? "text-rose-500"
                    : "text-[#2B50DC] dark:text-[#5B8DEF]"
                  : "text-gray-300 dark:text-gray-700 hover:text-gray-400"
              }`}
            >
              {lit ? "★" : "☆"}
            </button>
          );
        })}
      </div>
      <span className="font-mono text-[10px] text-gray-400 dark:text-gray-600 min-w-[64px]">
        {rating ? `${rating} of 5` : "unrated"}
      </span>
    </form>
  );
}
