/**
 * Honest empty state for a module whose release has not landed yet.
 *
 * Deliberately not a fake dashboard. R0 exists to prove the shell, the session, and
 * the security model, so anything that would need R1 data says so rather than
 * rendering invented numbers that read as working software.
 */
export default function Placeholder({
  title,
  release,
  children,
}: {
  title: string;
  release: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="border border-dashed border-black/15 dark:border-white/15 p-8">
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#2B50DC] dark:text-[#5B8DEF] mb-2">
        Ships in {release}
      </div>
      <h2 className="font-grotesk text-lg font-semibold text-gray-900 dark:text-white mb-2">
        {title}
      </h2>
      <div className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed max-w-[62ch]">
        {children}
      </div>
    </div>
  );
}
