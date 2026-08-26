import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import "./globals.css";

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

/**
 * The portal is signed-in software, so the default here is noindex rather than the
 * marketing description the site serves. Individual screens still set their own
 * titles; this is only the fallback.
 */
export const metadata: Metadata = {
  title: "socialX",
  robots: { index: false, follow: false },
};

/**
 * Root layout for the portal application.
 *
 * Deliberately thin, and deliberately without the marketing layout's analytics or
 * sales chat widget: a signed-in client does not need a "book a call" bubble, and
 * portal pageviews should not pollute marketing analytics. Fonts and the theme
 * initializer are the only things shared with the site, and they are duplicated
 * here rather than imported because a root layout belongs to its own application.
 */
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${inter.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          id="theme-initializer"
          dangerouslySetInnerHTML={{
            __html: `
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
      </head>
      <body>{children}</body>
    </html>
  );
}
