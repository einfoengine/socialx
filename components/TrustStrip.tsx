export default function TrustStrip() {
  return (
    <div
      className="py-7"
      style={{
        background: "white",
        borderTop: "1px solid rgba(0,0,0,0.07)",
        borderBottom: "1px solid rgba(0,0,0,0.07)",
      }}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          <p className="font-grotesk text-sm text-gray-500 text-center">
            Built by the team behind{" "}
            <strong className="text-gray-800 font-medium">GHL Explainer</strong>,{" "}
            <strong className="text-gray-800 font-medium">GHL Animation Studios</strong>, and{" "}
            <strong className="text-gray-800 font-medium">GHL Video</strong>
          </p>
          <div className="w-px h-5 bg-gray-200 hidden sm:block" />
          <p className="font-grotesk text-sm text-gray-500 text-center">
            <strong className="text-gray-900 font-semibold">800+</strong>{" "}
            HL SaaS clients served since 2021
          </p>
        </div>
      </div>
    </div>
  );
}
