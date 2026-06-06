export default function WhiteLabel() {
  return (
    <section id="gw-white-label" className="py-32 md:py-40 bg-white dark:bg-[#050508] transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div
          className="rounded-none p-14 flex flex-col md:flex-row items-center justify-between gap-10 bg-linear-to-br from-blue-600/[0.08] to-blue-sky/[0.04] dark:from-blue-600/[0.12] dark:to-blue-sky/[0.08] border border-blue-neon/15 dark:border-blue-neon/30 transition-colors duration-300"
        >
          <div className="flex-1">
            <div className="font-grotesk text-[12px] font-semibold text-blue-neon dark:text-blue-sky uppercase tracking-[1.5px] mb-3 transition-colors">
              Coming soon
            </div>
            <h2 className="font-grotesk text-[32px] font-semibold tracking-[-1px] leading-snug mb-3 text-gray-900 dark:text-white transition-colors duration-300">
              White-label SMM for your end clients.
            </h2>
            <p className="text-[17px] text-gray-500 dark:text-gray-400 leading-relaxed transition-colors duration-300">
              Add social media to your service line without hiring. We deliver full
              SMM to your clients, under your brand, badged as yours. Early access
              list opens soon.
            </p>
          </div>
          <a
            href="#"
            className="gradient-bg text-white px-7 py-4 rounded-[3px] font-grotesk font-semibold inline-flex items-center gap-2 whitespace-nowrap transition-transform hover:-translate-y-0.5 shrink-0"
          >
            Get on the list →
          </a>
        </div>
      </div>
    </section>
  );
}
