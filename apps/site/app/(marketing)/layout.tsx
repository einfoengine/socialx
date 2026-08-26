import Script from "next/script";
import ScrollReveal from "@/components/ScrollReveal";

/**
 * Marketing layout. Everything here is for prospects, not customers:
 * Google Tag Manager, the LeadConnector sales chat widget, and the scroll-reveal
 * observer the landing sections rely on.
 *
 * Keeping these out of the root layout means the portals stay clean. A logged-in
 * client does not need a "book a call" bubble, and portal pageviews should not
 * pollute marketing analytics.
 */
export default function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      {/* Google Tag Manager */}
      <Script id="gtm-base" strategy="afterInteractive">
        {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-M28GQ8WJ');`}
      </Script>
      <noscript>
        <iframe
          src="https://www.googletagmanager.com/ns.html?id=GTM-M28GQ8WJ"
          height="0"
          width="0"
          style={{ display: "none", visibility: "hidden" }}
        />
      </noscript>
      {/* End Google Tag Manager */}

      {children}

      <ScrollReveal />

      {/* LeadConnector chat widget */}
      <Script
        src="https://widgets.leadconnectorhq.com/loader.js"
        data-resources-url="https://widgets.leadconnectorhq.com/chat-widget/loader.js"
        data-widget-id="6a30391307e0e2e0e1fa80aa"
        strategy="afterInteractive"
      />
    </>
  );
}
