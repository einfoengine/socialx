import type { StaffRole } from "@/lib/types/db";

/**
 * The admin sections a staff role can be granted access to.
 *
 * This list is the app's, not the database's. staff_permissions stores rows keyed
 * by these strings; a row for a key that is not here is ignored, and a key with no
 * row reads as "none". That way renaming or retiring a screen is a code change
 * and never leaves a dangling foreign key.
 *
 * `group` matches the rail in app/(admin)/admin/layout.tsx so the matrix screen
 * and the navigation stay in the same order without either importing the other.
 */

export type AccessLevel = "none" | "view" | "full";
export const ACCESS_LEVELS: AccessLevel[] = ["none", "view", "full"];

export type SectionKey =
  | "today" | "journal"
  | "orders" | "subscriptions" | "clients" | "packages" | "coupons" | "links"
  | "batches" | "review" | "publishing"
  | "library"
  | "people" | "settings";

export type Section = {
  key: SectionKey;
  label: string;
  group: string;
  /** Longest-prefix matched, so /admin/library/features resolves to `library`. */
  href: string;
};

export const SECTIONS: Section[] = [
  { key: "today",         label: "Overview",     group: "",         href: "/admin" },
  { key: "orders",        label: "Orders",       group: "Money",    href: "/admin/orders" },
  { key: "subscriptions", label: "Subscriptions",group: "Money",    href: "/admin/subscriptions" },
  { key: "clients",       label: "Clients",      group: "Money",    href: "/admin/clients" },
  { key: "packages",      label: "Packages",     group: "Money",    href: "/admin/packages" },
  { key: "coupons",       label: "Coupons",      group: "Money",    href: "/admin/coupons" },
  { key: "links",         label: "Links",        group: "Money",    href: "/admin/links" },
  { key: "batches",       label: "Batches",      group: "Delivery", href: "/admin/batches" },
  { key: "review",        label: "Review queue", group: "Delivery", href: "/admin/review" },
  { key: "publishing",    label: "Publishing",   group: "Delivery", href: "/admin/publishing" },
  { key: "library",       label: "Library",      group: "Content",  href: "/admin/library" },
  { key: "journal",       label: "Plan & Context", group: "Account",  href: "/admin/journal" },
  { key: "people",        label: "People",       group: "Account",  href: "/admin/people" },
  { key: "settings",      label: "Settings",     group: "Account",  href: "/admin/settings" },
];

export const SECTION_KEYS = SECTIONS.map((s) => s.key);

export type PermissionMap = Record<SectionKey, AccessLevel>;

/** Every section at "none". The starting point a stored row overrides. */
export function emptyPermissions(): PermissionMap {
  return Object.fromEntries(SECTIONS.map((s) => [s.key, "none"])) as PermissionMap;
}

/** "full" satisfies a "view" requirement; "none" satisfies nothing. */
export function satisfies(held: AccessLevel, needed: Exclude<AccessLevel, "none">): boolean {
  if (held === "full") return true;
  return held === "view" && needed === "view";
}

/*
 * The owner role is the recovery path: it is the only role that can reach People
 * and Settings, so allowing it to be reduced would make the change unrepairable
 * from inside the product. The database enforces this too.
 */
export function isLockedRole(role: StaffRole): boolean {
  return role === "owner";
}

/** Longest prefix wins, so /admin/library/new resolves to library, not today. */
export function sectionForPath(pathname: string): Section | null {
  let best: Section | null = null;
  for (const s of SECTIONS) {
    if (pathname === s.href || pathname.startsWith(`${s.href}/`)) {
      if (!best || s.href.length > best.href.length) best = s;
    }
  }
  return best;
}
