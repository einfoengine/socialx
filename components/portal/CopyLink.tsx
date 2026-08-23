"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/**
 * Copies an absolute URL built from a path.
 *
 * The origin is read in the browser rather than passed in, so the same component
 * yields a localhost link in development and the real domain in production
 * without anyone remembering to change a setting.
 */
export default function CopyLink({
  path,
  label = "Copy",
  full = false,
}: {
  path: string;
  label?: string;
  /** Show the URL beside the button, for a page whose job is the link itself. */
  full?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard is blocked outside a secure context; select-and-copy still works.
      window.prompt("Copy this link", url);
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <span className="inline-flex items-center gap-2 min-w-0">
      {full && (
        <code className="font-mono text-[11px] text-gray-500 dark:text-gray-400 truncate border border-black/10 dark:border-white/10 px-2 py-1 min-w-0">
          {path}
        </code>
      )}
      <button
        type="button"
        onClick={copy}
        className={`inline-flex items-center gap-1.5 border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] cursor-pointer bg-transparent transition-colors shrink-0 ${
          copied
            ? "border-emerald-600/50 text-emerald-700 dark:text-emerald-400"
            : "border-black/12 dark:border-white/15 text-gray-500 hover:border-[#2B50DC]/50 hover:text-[#2B50DC] dark:hover:text-[#5B8DEF]"
        }`}
      >
        {copied ? <Check size={11} /> : <Copy size={11} />}
        {copied ? "Copied" : label}
      </button>
    </span>
  );
}
