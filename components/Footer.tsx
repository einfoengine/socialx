const productLinks = [
  { label: "How it works", href: "#gw-how" },
  { label: "Pricing", href: "#gw-pricing" },
  { label: "FAQ", href: "#gw-faq" },
  { label: "Library", href: "#" },
];
const companyLinks = [
  { label: "About", href: "#" },
  { label: "growX (parent)", href: "https://growx.studio" },
  { label: "GHL Video", href: "https://ghlvideo.com" },
  { label: "Contact", href: "#" },
];
const legalLinks = [
  { label: "Terms", href: "#" },
  { label: "Privacy", href: "#" },
  { label: "Cookies", href: "#" },
];

export default function Footer() {
  return (
    <footer className="pt-14 pb-10" style={{ background: "#111118" }}>
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="col-span-2 lg:col-span-1">
            <a href="#" className="flex items-baseline gap-0.5 no-underline">
              <span className="font-grotesk text-[26px] font-medium text-white">social</span>
              <span className="font-grotesk text-[30px] font-bold gradient-text leading-none">X</span>
            </a>
            <p className="mt-4 text-sm text-white/45 leading-relaxed max-w-xs">
              Productized social media for HighLevel SaaS resellers. 800+ HL clients served since 2021.
            </p>
          </div>

          {[
            { title: "Product", links: productLinks },
            { title: "Company", links: companyLinks },
            { title: "Legal", links: legalLinks },
          ].map((col) => (
            <div key={col.title}>
              <h4 className="font-grotesk text-[13px] font-medium text-white/60 uppercase tracking-[1.2px] mb-5">
                {col.title}
              </h4>
              <ul className="space-y-3">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      className="text-sm text-white/40 hover:text-white/80 transition-colors"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div
          className="pt-8 flex flex-wrap justify-between items-center gap-4"
          style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
        >
          <p className="font-grotesk text-[13px] text-white/25">
            © 2026 socialX. A growX company. Not affiliated with or endorsed by HighLevel.
          </p>
          <p className="font-grotesk text-[13px] text-white/25">
            socialx.studio · hi@socialx.studio
          </p>
        </div>
      </div>
    </footer>
  );
}
