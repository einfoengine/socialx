/**
 * The settings rail.
 *
 * Settings became a section rather than a screen, so it needs navigation of its
 * own. This list is that navigation, and it is separate from lib/sections.ts on
 * purpose: those keys are access boundaries the permission matrix grants, these
 * are pages behind one boundary. Everything here is reached with the `settings`
 * permission and nothing here subdivides it, so adding a page is a line in this
 * file and not a migration.
 *
 * Grouping follows who opens which. Workspace is anyone with Settings, Developer
 * is whoever is wiring something up to the API, and Delivery is the contract the
 * production side reads.
 */

export type SettingsItem = {
  href: string;
  label: string;
  help: string;
  /** Editable only by a role holding Settings at full. */
  writes?: boolean;
};

export type SettingsGroup = { title: string; items: SettingsItem[] };

export const SETTINGS_NAV: SettingsGroup[] = [
  {
    title: "Workspace",
    items: [
      {
        href: "/admin/settings",
        label: "General",
        help: "Brand name, support address, where checkout lives.",
        writes: true,
      },
      {
        href: "/admin/settings/access",
        label: "Access",
        help: "What each staff role can reach.",
        writes: true,
      },
    ],
  },
  {
    title: "Developer",
    items: [
      {
        href: "/admin/settings/api-keys",
        label: "API keys",
        help: "Issue and revoke credentials, and name the domains each may be used from.",
        writes: true,
      },
      {
        href: "/admin/settings/public-api",
        label: "Public API",
        help: "What the API serves with no credential at all.",
        writes: true,
      },
    ],
  },
  {
    title: "Delivery",
    items: [
      {
        href: "/admin/settings/plans",
        label: "Plans",
        help: "The tier contract the system enforces.",
        writes: true,
      },
      {
        href: "/admin/settings/rate-cards",
        label: "Rate cards",
        help: "Which pricing is live and for how long.",
        writes: true,
      },
      {
        href: "/admin/settings/pillars",
        label: "Content pillars",
        help: "The default monthly mix a batch is built to.",
        writes: true,
      },
    ],
  },
];

export const SETTINGS_ITEMS = SETTINGS_NAV.flatMap((g) => g.items);

/** Longest prefix wins, so /admin/settings/api-keys never resolves to General. */
export function settingsItemForPath(pathname: string): SettingsItem | null {
  let best: SettingsItem | null = null;
  for (const item of SETTINGS_ITEMS) {
    if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
      if (!best || item.href.length > best.href.length) best = item;
    }
  }
  return best;
}
