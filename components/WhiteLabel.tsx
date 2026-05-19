export default function WhiteLabel() {
  return (
    <section className="py-24" style={{ background: "white" }}>
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div
          className="rounded-3xl p-14 flex flex-col md:flex-row items-center justify-between gap-10"
          style={{
            background: "linear-gradient(135deg, rgba(43,80,220,0.07) 0%, rgba(91,141,239,0.04) 100%)",
            border: "1px solid rgba(43,80,220,0.15)",
          }}
        >
          <div className="flex-1">
            <div className="font-grotesk text-[12px] font-semibold text-blue-neon uppercase tracking-[1.5px] mb-3">
              Coming soon
            </div>
            <h2 className="font-grotesk text-[32px] font-semibold tracking-[-1px] leading-snug mb-3 text-gray-900">
              White-label SMM for your end clients.
            </h2>
            <p className="text-[17px] text-gray-500 leading-relaxed">
              Add social media to your service line without hiring. We deliver full
              SMM to your clients, under your brand, badged as yours. Early access
              list opens soon.
            </p>
          </div>
          <a
            href="#"
            className="gradient-bg text-white px-7 py-4 rounded-full font-grotesk font-semibold inline-flex items-center gap-2 whitespace-nowrap transition-transform hover:-translate-y-0.5 shrink-0"
          >
            Get on the list →
          </a>
        </div>
      </div>
    </section>
  );
}
