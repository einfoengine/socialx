import type { ReactNode } from "react";

/**
 * The pieces every settings page is built from.
 *
 * Kept here rather than in components/ because these carry a shape specific to
 * this section: a titled panel with an explanation, and a read-only variant of
 * every control for a role holding Settings at view. That second one is the
 * reason this file exists. Without it each page would grow its own way of saying
 * "you can see this and not change it", and they would say it differently.
 */

export function SectionHead({
  title,
  sub,
  action,
}: {
  title: string;
  sub?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="font-grotesk text-[19px] font-semibold tracking-[-0.3px] text-gray-900 dark:text-white">
          {title}
        </h2>
        {sub && (
          <p className="mt-1 max-w-[74ch] text-[13.5px] leading-relaxed text-gray-600 dark:text-gray-400">
            {sub}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

export function Panel({
  title,
  sub,
  children,
}: {
  title?: string;
  sub?: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-6 border border-black/10 bg-white dark:border-white/10 dark:bg-[#111118]">
      {title && (
        <div className="border-b border-black/8 px-5 py-4 dark:border-white/8">
          <h3 className="font-grotesk text-[14px] font-semibold text-gray-900 dark:text-white">
            {title}
          </h3>
          {sub && (
            <p className="mt-1 max-w-[80ch] text-[12.5px] leading-relaxed text-gray-500 dark:text-gray-400">
              {sub}
            </p>
          )}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

/** Shown at the top of a page a role may read but not change. */
export function ReadOnlyNotice() {
  return (
    <div className="mb-6 border border-black/10 bg-black/[0.02] px-5 py-3.5 text-[13px] leading-relaxed text-gray-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-400">
      Your role opens Settings but does not change them. Everything below is
      current; the controls are inert.
    </div>
  );
}

export const inputClass =
  "bg-transparent border border-black/15 dark:border-white/15 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-hidden focus:border-[#2B50DC] transition-colors w-full disabled:opacity-55 disabled:cursor-not-allowed";

export const btnClass =
  "btn btn-primary gradient-bg cursor-pointer border-0 px-6 py-2.5 font-grotesk text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45";

export const quietBtnClass =
  "cursor-pointer border-0 bg-transparent p-0 font-mono text-[10px] uppercase tracking-[0.1em] text-gray-400 transition-colors hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-50";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-grotesk text-[12.5px] font-semibold text-gray-900 dark:text-white">
        {label}
      </span>
      {hint && (
        <span className="-mt-1 max-w-[74ch] text-[11.5px] leading-relaxed text-gray-500">
          {hint}
        </span>
      )}
      {children}
    </label>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return (
    <p className="mt-4 max-w-[76ch] text-[12.5px] leading-relaxed text-gray-500 dark:text-gray-500">
      {children}
    </p>
  );
}

export function Mono({ children }: { children: ReactNode }) {
  return (
    <code className="font-mono text-[12px] text-gray-700 dark:text-gray-300">{children}</code>
  );
}
