import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import "./globals.css";
import Script from "next/script";
import ScrollReveal from "@/components/ScrollReveal";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "socialX | Social media for HighLevel resellers",
  description:
    "Productized social media for HighLevel SaaS resellers. Custom posts from an HL-feature-targeted library, scheduled to your HL Social Planner. Plans from $197/month.",
  icons: {
    icon: [
      {
        url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAQAElEQVR4AUyZe4wkV3XGv6rpqu6q6qqe9e52z9remVnvEmzHxoQkhEdMwAgwxpiYGAUlBiLIQ5GiJFL+IUiREoEQUv5IIpQIFAkIsRJMImwrIZFMeMQ2NtgONgSwFzA7M+tH94x3p9+Pqp6u/M7t2cDs3u6qe0+de+453/nuudX+2bNny25vv9w5v+Nat7tfWt90Oi23d7bL/f2L5QXaDteT2diNdbsXy52dnfI8z3Qvyc9mh/L75UXk7dnpbIr80+U+Mjvnt0trdm36Z4fyFxnb3993z86c/FNl1/Qjv03rMv70D54uJ4xtYYPJX9y/4ORNv99sNTUejVWrRa6NuG42m+p0OorjWOPxRNPJVFEcabezJ5Mf0RdFNVVrNY1GI5l8u9NGPtFoPER+zHWsducFNVstdIwVIRtFkZur2TzGmMnH3A81nph8pHYbeeY2/WZPhE2mr9VsMXdHCTZMxiONp9ND/R35/cFAQRgoL2auhdVQ/WFfaZoqz2eqhCuqBBUVeaG0nmjQHyjkPi9yFbQwrGqIjqxeV4G83VcqIde5snqmAWOVwPTP0VcwV0XD4cjpymc5uqoKKoznudK0wdwj+kLlRaH5vFAQVNUfYA/6c2wI0B2uII+9WVqX78mTaPZp36VK+ZJKjyvr9Fa4kxZ8er6NLFSavOfxSaeNIOt5Hv2ir5R8mvjzRN9CTEI/99yVyC1K+vm2Hhu0S2aTCXklg+gTrTy8Ro3sOdkQwqXTv5zPX3o6Z9WBqkGI5wo8LXnIdakaZa53+87mVkxV5HPFYShzHMNvDrD0wFRsFZMc2VEd4hXQ6Jdz集中1eTzVLMipwvxrNmMUWWyznP9CPmpeZ1tZI1V/1CeH+lzXtbVzTusm3+f5NFGCvl6/q5MbVwpGQmfDIcNsNHu2d3bk75qH8MDURQCPc21RaRo7EQHzUAR7TA5XvLe7p6geaYL8iIhFeLSz11GzdRyvLZ+PYvPgSE0YxXQlRGyMrLFZnNSJMPJ4dITOmOjGRGjMXBaVXRCRJLHGMNOEPovG3u6Lif6HLZGvxTVFpo8xYye/bpgj440JgkoIfg2jddijD8YDMJ5rDIafn1f05O5Ezy4iff/iXD+eVHRusqLOmByo40nYKQhD5OeaG4bJmQF5lDGWcx+A2QrN8J0SzT7yvYMVfa87d+3cNNATpv+gph93C/mVKnlZkT2bwECG9yAMsG/u+kKuLcdcPov0Lkl1j8x3VCB66OC/jAkKsv8z21W949HL9OYHGnrbw0d0y0OruuXrq/rQ91J1Cx8CQQF6PNd8PhdoERzFwzCHXRnD2Lgxzn5e6k++XdOtjxzRrHd94oole95mY6YXZkZHdBIsKcjThThThThThThThTq3L7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7Z/d3f3d//Zz//u//u//7v//d/93/3d/93/3d/93/3d/d39/wf+u9v6D+f/x/1/+b7X+Y/x+m0Hn+XnFf7n1R3aY457x//+d/tXfF/c11/5gZt07Y0367Z3vVu/cf+L6t/yU/H//wH++eC5L687/QAAAABJRU5ErkJggg==",
        type: "image/png",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        <script
          id="theme-initializer"
          dangerouslySetInnerHTML={{
            __html: `
              // Mark JS as available so scroll-reveal can safely hide content
              // before it animates in (no-JS users always see everything).
              document.documentElement.classList.add('js');
              try {
                // Light is the default theme; only use dark when explicitly chosen.
                const theme = localStorage.getItem('theme');
                if (theme === 'dark') {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch (_) {}
            `,
          }}
        />
        {/* Google Tag Manager */}
        <Script id="gtm-base" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-M28GQ8WJ');`}
        </Script>
        {/* End Google Tag Manager */}
      </head>
      <body>
        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-M28GQ8WJ"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        {/* End Google Tag Manager (noscript) */}
        {children}
        <ScrollReveal />
      </body>
    </html>
  );
}
