const rows = [
  { option: "DIY (Canva + scheduling yourself)", cost: "$0", posts: "5–10", quality: "mid", qualityLabel: "Amateur", hlFluent: true, time: "4–6 hrs/week", isSocialX: false },
  { option: "Fiverr designers + writers", cost: "~$200", posts: "15–30", quality: "mid", qualityLabel: "Variable", hlFluent: false, time: "2–3 hrs/week mgmt", isSocialX: false },
  { option: "socialX Starter", cost: "$197", posts: "8", quality: "yes", qualityLabel: "Pro", hlFluent: true, time: "Zero", isSocialX: true },
  { option: "Generic productized SMM tools", cost: "$200–$400", posts: "20–40 (AI-gen)", quality: "mid", qualityLabel: "OK", hlFluent: false, time: "Light mgmt", isSocialX: false },
  { option: "socialX Growth", cost: "$397", posts: "16 + 2 videos", quality: "yes", qualityLabel: "Pro", hlFluent: true, time: "Zero", isSocialX: true },
  { option: "Dedicated VA from Upwork", cost: "$600–$1,000", posts: "40+", quality: "mid", qualityLabel: "OK", hlFluent: false, time: "Heavy mgmt + training", isSocialX: false },
  { option: "socialX Scale", cost: "$597", posts: "30 + 4 videos", quality: "yes", qualityLabel: "Pro", hlFluent: true, time: "Zero", isSocialX: true },
  { option: "Custom SMM agency", cost: "$1,500–$3,000", posts: "25–40", quality: "yes", qualityLabel: "Pro", hlFluent: false, time: "Calls + reviews", isSocialX: false },
];

function QualityBadge({ quality, label }: { quality: string; label: string }) {
  if (quality === "yes") return <span className="text-blue-neon font-medium">{label}</span>;
  if (quality === "mid") return <span style={{ color: "rgba(217,119,6,0.9)" }}>{label}</span>;
  return <span style={{ color: "rgba(220,38,38,0.7)" }}>{label}</span>;
}

function YesNo({ value }: { value: boolean }) {
  return value ? (
    <span className="text-blue-neon font-semibold">✓</span>
  ) : (
    <span style={{ color: "rgba(220,38,38,0.6)" }}>✗</span>
  );
}

export default function Comparison() {
  return (
    <section
      className="py-32 md:py-40"
      style={{ background: "#F4F2EF" }}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="section-eyebrow">[ vs. The rest ]</div>
        <h2 className="section-title">
          Your real options.<br />
          What each one actually costs.
        </h2>
        <p className="section-sub mb-16">
          A reseller&apos;s typical alternatives. Look at the trade-offs honestly.
        </p>

        <div
          className="overflow-x-auto rounded-2xl"
          style={{
            background: "white",
            border: "1px solid rgba(0,0,0,0.08)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.05)",
          }}
        >
          <table className="w-full border-collapse text-[15px]" style={{ minWidth: "760px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
                {["Option", "Cost/month", "Posts/month", "Quality", "HL-fluent", "Your time"].map((h) => (
                  <th
                    key={h}
                    className="font-grotesk text-[12px] uppercase tracking-[1px] font-medium text-gray-400 text-left px-5 py-4.5"
                    style={{ background: "rgba(0,0,0,0.02)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.option}
                  style={{
                    background: row.isSocialX
                      ? "linear-gradient(90deg, rgba(43,80,220,0.06) 0%, rgba(43,80,220,0.02) 100%)"
                      : "transparent",
                    borderBottom: "1px solid rgba(0,0,0,0.04)",
                  }}
                >
                  <td
                    className="px-5 py-4.5 text-gray-800"
                    style={row.isSocialX ? { borderLeft: "3px solid #2B50DC", paddingLeft: "17px" } : {}}
                  >
                    {row.isSocialX ? <strong className="font-semibold text-gray-900">{row.option}</strong> : row.option}
                  </td>
                  <td className="px-5 py-4.5 text-gray-800">
                    {row.isSocialX ? <strong className="font-semibold text-gray-900">{row.cost}</strong> : row.cost}
                  </td>
                  <td className="px-5 py-4.5 text-gray-800">
                    {row.isSocialX ? <strong className="font-semibold text-gray-900">{row.posts}</strong> : row.posts}
                  </td>
                  <td className="px-5 py-4.5"><QualityBadge quality={row.quality} label={row.qualityLabel} /></td>
                  <td className="px-5 py-4.5"><YesNo value={row.hlFluent} /></td>
                  <td className="px-5 py-4.5 text-gray-800">
                    {row.isSocialX
                      ? <strong className="font-semibold text-blue-neon">{row.time}</strong>
                      : row.time}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
