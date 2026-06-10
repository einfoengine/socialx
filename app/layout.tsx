import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import ScrollReveal from "@/components/ScrollReveal";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "socialX | Social media for HighLevel resellers",
  description:
    "Productized social media for HighLevel SaaS resellers. Custom posts from an HL-feature-targeted library, scheduled to your HL Social Planner. Plans from $197/month.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={spaceGrotesk.variable} suppressHydrationWarning>
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
      </head>
      <body>
        {children}
        <ScrollReveal />
      </body>
    </html>
  );
}
