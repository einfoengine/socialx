import type { Metadata } from "next";
import {
  BookOpen, CalendarRange, CreditCard, LayoutDashboard, Library, Link2,
  MessageSquareWarning, Package, Send, Settings, ShoppingBag, Ticket, Users,
} from "lucide-react";
import Shell, { type NavGroup, type NavItem } from "@/components/portal/Shell";
import { requireStaff } from "@/lib/dal/session";

export const metadata: Metadata = {
  title: "Admin | socialX",
  robots: { index: false, follow: false },
};

/*
 * The admin rail, grouped by what a person is actually doing rather than by
 * which table a screen reads. Money, Delivery, and Content are three different
 * jobs on three different days.
 *
 * The first group carries no title, so Today and Journal never collapse: they
 * are the two screens opened without a reason.
 */
const GROUPS: NavGroup[] = [
  {
    title: "",
    items: [
      { href: "/admin", label: "Today", icon: <LayoutDashboard size={16} /> },
      { href: "/admin/journal", label: "Journal", icon: <BookOpen size={16} /> },
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
    items: [{ href: "/admin/library", label: "Library", icon: <Library size={16} /> }],
  },
];

/* Settings sits on the rail's floor. It is reached deliberately, not browsed. */
const BOTTOM: NavItem[] = [
  { href: "/admin/settings", label: "Settings", icon: <Settings size={16} /> },
];

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  /* Authorization happens here, not in proxy.ts. This runs on every admin render. */
  const session = await requireStaff();

  return (
    <Shell
      area="Admin"
      groups={GROUPS}
      bottom={BOTTOM}
      storageKey="sx-admin-rail"
      userEmail={session.email}
      userMeta={`socialX ${session.staffRole}`}
    >
      {children}
    </Shell>
  );
}
