import type { Metadata } from "next";
import {
  CalendarDays, CheckSquare, CreditCard, Image as ImageIcon, LayoutDashboard,
  Palette, Users,
} from "lucide-react";
import Shell, { type NavGroup } from "@/components/portal/Shell";
import { requireOrg } from "@/lib/dal/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Portal | socialX",
  robots: { index: false, follow: false },
};

export default async function PortalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await requireOrg();
  const supabase = await createClient();

  const [{ data: org }, { count: waiting }] = await Promise.all([
    supabase.from("organizations").select("name").eq("id", session.orgId).single(),
    supabase
      .from("batches")
      .select("*", { count: "exact", head: true })
      .eq("org_id", session.orgId)
      .eq("status", "in_review"),
  ]);

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
      groups={groups}
      storageKey="sx-client-rail"
      userEmail={session.email}
      userMeta={org?.name ?? null}
    >
      {children}
    </Shell>
  );
}
