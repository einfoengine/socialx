import type { Metadata } from "next";
import {
  BookOpen, CalendarRange, Globe, CreditCard, LayoutDashboard, Library, Link2,
  MessageSquareWarning, Package, Send, Settings, ShoppingBag, Ticket, UserCog, Users,
} from "lucide-react";
import SiteBar from "@/components/SiteBar";
import { adminSiteContext } from "@/lib/sites/admin";
import Shell, { type NavGroup, type NavItem } from "@/components/Shell";
import { getStaffAccess } from "@/lib/dal/permissions";
import { sectionForPath } from "@/lib/sections";
import ViewAsSwitcher, { type ViewOption } from "./ViewAsSwitcher";

export const metadata: Metadata = {
  title: "Admin | Portal",
  robots: { index: false, follow: false },
};

/*
 * The admin rail, grouped by what a person is actually doing rather than by
 * which table a screen reads. Money, Delivery, and Content are three different
 * jobs on three different days.
 *
 * The first group carries no title, so Overview never collapses: it is the one
 * screen opened without a reason. Plan & Context sits on the floor with People
 * and Settings, because it is reference material rather than a daily job.
 */
const GROUPS: NavGroup[] = [
  {
    title: "",
    items: [
      { href: "/admin", label: "Overview", icon: <LayoutDashboard size={16} /> },
    ],
  },
  {
    title: "Money",
    defaultOpen: true,
    items: [
      { href: "/admin/orders", label: "Orders", icon: <ShoppingBag size={16} /> },
      { href: "/admin/subscriptions", label: "Subscriptions", icon: <CreditCard size={16} /> },
      { href: "/admin/clients", label: "Clients", icon: <Users size={16} /> },
      /* What is sold, what it costs, and how a buyer reaches it. These used to sit
         under Settings, which read as configuration rather than as the offer. */
      { href: "/admin/packages", label: "Packages", icon: <Package size={16} /> },
      { href: "/admin/coupons", label: "Coupons", icon: <Ticket size={16} /> },
      { href: "/admin/links", label: "Links", icon: <Link2 size={16} /> },
    ],
  },
  {
    title: "Delivery",
    defaultOpen: true,
    items: [
      { href: "/admin/batches", label: "Batches", icon: <CalendarRange size={16} /> },
      { href: "/admin/review", label: "Review queue", icon: <MessageSquareWarning size={16} /> },
      { href: "/admin/publishing", label: "Publishing", icon: <Send size={16} /> },
    ],
  },
  {
    title: "Content",
    items: [
      { href: "/admin/library", label: "Library", icon: <Library size={16} /> },
      /* Website is a site's own copy, not the client content library:
         named JSON the site renders, edited here so a copy change is not a
         deploy. */
      { href: "/admin/website", label: "Website", icon: <Globe size={16} /> },
    ],
  },
];

/* Settings sits on the rail's floor. It is reached deliberately, not browsed, and
   People is the same kind of screen: opened to do one specific job. Note that
   People is not Clients. Clients, under Money, is the organizations that pay.
   People is the accounts that can sign in, staff included. */
const BOTTOM: NavItem[] = [
  { href: "/admin/journal", label: "Plan & Context", icon: <BookOpen size={16} /> },
  { href: "/admin/people", label: "People", icon: <UserCog size={16} /> },
  { href: "/admin/settings", label: "Settings", icon: <Settings size={16} /> },
];

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  /* Authorization happens here, not in proxy.ts. This runs on every admin render. */
  /*
   * Both in one pass. The site context is what every tenant screen filters on,
   * and putting it in the layout means the switcher is on screen everywhere
   * rather than repeated on eight pages and missing from the ninth. cache()
   * makes the page below this read the same result rather than query again.
   */
  const [access, siteCtx] = await Promise.all([getStaffAccess(), adminSiteContext()]);

  /* The rail shows what this role can open. Hiding a link is presentation, not
     protection: every page and every server action re-checks for itself, because
     a hidden link is still a reachable URL. */
  const visible = (href: string) => {
    const section = sectionForPath(href);
    return section ? access.permissions[section.key] !== "none" : true;
  };

  const groups = GROUPS
    .map((g) => ({ ...g, items: g.items.filter((i) => visible(i.href)) }))
    .filter((g) => g.items.length > 0);

  /* The switcher belongs to the owner alone. Everyone else has exactly one
     vantage point and a control offering others would only mislead. */
  const isOwner = access.realRole === "owner";
  const options: ViewOption[] = isOwner
    ? [
        { value: "self", label: "Platform owner, yourself", group: "Admin" },
        { value: "role:ops", label: "Staff: ops", group: "Staff role" },
        { value: "role:content", label: "Staff: content", group: "Staff role" },
        { value: "role:finance", label: "Staff: finance", group: "Staff role" },
        // Arrived with the permission map, so this costs nothing extra.
        ...access.orgs.map((o) => ({
          value: `org:${o.id}`,
          label: o.name,
          group: "Client portal",
        })),
      ]
    : [];

  return (
    <Shell
      area="Admin"
      groups={groups}
      bottom={BOTTOM.filter((i) => visible(i.href))}
      storageKey="sx-admin-rail"
      userEmail={access.email}
      userMeta={`Platform ${access.staffRole}`}
      headerSlot={
        <>
          {/* Which site, before who you are looking as. The site decides what the
              rows are; the role only decides what you may do with them. */}
          {access.permissions.sites !== "none" && (
            <SiteBar
              sites={siteCtx.sites}
              current={siteCtx.site}
              unassigned={siteCtx.unassigned}
              showingUnassigned={siteCtx.showingUnassigned}
              fellBack={siteCtx.fellBack}
            />
          )}
          {isOwner && (
            <ViewAsSwitcher
              options={options}
              current={access.viewingAsRole ? `role:${access.staffRole}` : "self"}
              previewing={access.viewingAsRole}
            />
          )}
        </>
      }
    >
      {/* The control moved to the top bar, so the reminder stays behind to say
          what the highlighted selector means. */}
      {access.viewingAsRole && (
        <div className="mb-6 border border-[#3D4AFF]/35 bg-[#3D4AFF]/[0.07] px-5 py-3 font-grotesk text-[13px] text-gray-700 dark:text-gray-300">
          Everything below is what {access.staffRole} reaches. Pick yourself in the top
          bar to come back.
        </div>
      )}
      {children}
    </Shell>
  );
}
