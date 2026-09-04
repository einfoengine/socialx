import type { Metadata } from "next";
import {
  CalendarDays, CheckSquare, CreditCard, Image as ImageIcon, LayoutDashboard,
  Palette, Users,
} from "lucide-react";
import Shell, { type NavGroup } from "@/components/Shell";
import { requireOrg } from "@/lib/dal/session";
import { portalSite } from "@/lib/sites/resolve";
import { NEUTRAL_BRAND, wordmarkOf } from "@/lib/core/sites";
import { exitClientPortal } from "@/app/view-as-actions";

/**
 * A neutral fallback title, and it stays neutral.
 *
 * Metadata is static, so it cannot ask which site this request is for; a brand
 * name here would be whichever customer happened to be first, printed in every
 * other customer's browser tab. Individual screens set their own titles.
 */
export const metadata: Metadata = {
  title: "Portal",
  robots: { index: false, follow: false },
};

export default async function PortalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  /* One round trip for the whole gate. The org name and the approvals badge come
     back with it, so the shell no longer waits on two further queries before it
     can paint. Page content streams in behind this. */
  const session = await requireOrg();
  const org = { name: session.orgName };
  const waiting = session.waitingCount;

  /* The brand this client's portal wears. Resolved from the host first and from
     their own organization second, so a site with its own portal domain looks
     like itself and a client on the shared host still sees whoever sold them. A
     site that cannot be resolved renders the neutral mark rather than borrowing
     one, because a portal wearing the wrong company's logo is worse than a
     portal wearing none. */
  const site = await portalSite(session.orgId);
  const brand = {
    wordmark: site ? wordmarkOf(site) : NEUTRAL_BRAND.wordmark,
    logoUrl: site?.brand.logoUrl ?? null,
    logoDarkUrl: site?.brand.logoDarkUrl ?? null,
    href: site?.primaryUrl ?? null,
  };

  /*
   * The client rail is short, and its groups default open. Collapsing a menu
   * whose sections are the product hides the product. The badge on Approvals is
   * the whole reason a client opens this at all.
   */
  const groups: NavGroup[] = [
    {
      title: "",
      items: [{ href: "/portal", label: "Overview", icon: <LayoutDashboard size={16} /> }],
    },
    {
      title: "Your content",
      defaultOpen: true,
      items: [
        {
          href: "/portal/approvals",
          label: "Approvals",
          icon: <CheckSquare size={16} />,
          badge: waiting ?? 0,
        },
        { href: "/portal/calendar", label: "Calendar", icon: <CalendarDays size={16} /> },
        {
          href: "/portal/assets",
          label: "Assets",
          icon: <ImageIcon size={16} />,
          disabled: true,
          disabledTip: "soon",
        },
      ],
    },
    {
      title: "Your account",
      defaultOpen: true,
      items: [
        { href: "/portal/onboarding", label: "Brand profile", icon: <Palette size={16} /> },
        { href: "/portal/billing", label: "Billing", icon: <CreditCard size={16} /> },
        { href: "/portal/team", label: "Team", icon: <Users size={16} /> },
      ],
    },
  ];

  return (
    <Shell
      area="Portal"
      brand={brand}
      groups={groups}
      storageKey="sx-client-rail"
      userEmail={session.email}
      userMeta={org?.name ?? null}
    >
      {/* Impossible to mistake for the client's own view, and one click out.
          A preview that looks identical to the real thing is how someone reads
          the wrong org's screens and does not notice. */}
      {session.viewingAs && (
        <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 border border-[#3D4AFF]/35 bg-[#3D4AFF]/[0.07] px-5 py-3">
          {/* The eyebrow is uppercased by CSS, so it must not carry a brand name.
              A site's casing is its own and this would flatten it. */}
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#3D4AFF] dark:text-[#00A3FF]">
            Client preview
          </span>
          <span className="font-grotesk text-[13.5px] text-gray-700 dark:text-gray-300">
            {org?.name ?? "this client"} sees this. Read only: nothing here can be
            approved or changed from a preview.
          </span>
          <form action={exitClientPortal} className="ml-auto">
            <button
              type="submit"
              className="border border-[#3D4AFF]/40 px-3 py-1.5 font-grotesk text-xs font-semibold text-[#3D4AFF] dark:text-[#00A3FF] hover:bg-[#3D4AFF]/10 transition-colors cursor-pointer"
            >
              Exit preview
            </button>
          </form>
        </div>
      )}
      {children}
    </Shell>
  );
}
