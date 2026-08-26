"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore,
  type ReactNode, type RefObject,
} from "react";
import { railStore, themeStore } from "./prefs";
import { ChevronDown, LogOut, Menu, Moon, Sun, X } from "lucide-react";
import Logo, { LogoMark } from "@/components/Logo";

/*
 * The shared chrome for both portals: one top bar, one grouped sidebar, one
 * theme switch.
 *
 * Structure follows the GHL Video portal, which solved these problems already.
 * The skin is entirely socialX: the wordmark, the blue gradient, and square
 * corners throughout, because globals.css zeroes every radius on purpose and a
 * rounded rail here would be the one place the design language breaks.
 */

/* ---------------- types ---------------- */

export type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  badge?: number;
  /*
   * Shown but locked. The third state between visible and hidden: hidden says
   * this does not exist, disabled says it exists and you do not have it yet,
   * which is a doorway rather than a wall.
   */
  disabled?: boolean;
  disabledTip?: string;
};

export type NavGroup = {
  /* Empty title means always-visible top level items, never collapsed. */
  title: string;
  items: NavItem[];
  defaultOpen?: boolean;
};

/* ---------------- shared bits ---------------- */

/** Close a popover on outside click or Escape, returning focus to the trigger. */
function useDismiss(ref: RefObject<HTMLDivElement | null>, open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        ref.current?.querySelector("button")?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [ref, open, onClose]);
}

/** A person in the chrome: initials on the brand gradient. Square, like everything else. */
export function PortalAvatar({
  name,
  email,
  size = "sm",
}: {
  name?: string | null;
  email: string;
  size?: "sm" | "lg";
}) {
  const cls = size === "lg" ? "h-11 w-11 text-[15px]" : "h-8 w-8 text-[11.5px]";
  const initials = (name?.trim() || email)
    .split(/[\s@.]+/)
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <span
      aria-hidden="true"
      className={`${cls} grid shrink-0 place-items-center gradient-bg font-grotesk font-bold text-white`}
    >
      {initials}
    </span>
  );
}

/** Square top-bar icon button with an optional count badge. */
function TopIconButton({
  label,
  onClick,
  badge,
  children,
}: {
  label: string;
  onClick: () => void;
  badge?: number;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={badge ? `${label}, ${badge} unread` : label}
      title={label}
      className="relative grid h-9 w-9 place-items-center border border-black/12 dark:border-white/15 text-gray-500 dark:text-gray-400 hover:border-[#2B50DC]/50 hover:text-[#2B50DC] dark:hover:text-[#5B8DEF] transition-colors cursor-pointer bg-transparent"
    >
      {children}
      {badge ? (
        <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center gradient-bg px-1 font-mono text-[10px] font-bold leading-none text-white">
          {badge > 9 ? "9+" : badge}
        </span>
      ) : null}
    </button>
  );
}

function ThemeToggle() {
  const dark = useSyncExternalStore(
    themeStore.subscribe,
    themeStore.getSnapshot,
    themeStore.getServerSnapshot
  );

  return (
    <TopIconButton
      label={dark ? "Switch to light" : "Switch to dark"}
      onClick={() => themeStore.toggle(!dark)}
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </TopIconButton>
  );
}

function ProfileMenu({
  email,
  name,
  meta,
}: {
  email: string | null;
  name?: string | null;
  meta?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, () => setOpen(false));

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 border border-black/12 dark:border-white/15 p-1 pr-2 hover:border-[#2B50DC]/50 transition-colors cursor-pointer bg-transparent"
      >
        <PortalAvatar email={email ?? "?"} name={name} />
        <ChevronDown size={14} className="text-gray-400 shrink-0" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1.5 w-[248px] border border-black/12 dark:border-white/15 bg-white dark:bg-[#111118] shadow-[0_12px_32px_rgba(0,0,0,0.12)] z-50"
        >
          <div className="flex items-center gap-3 p-4 border-b border-black/8 dark:border-white/8">
            <PortalAvatar email={email ?? "?"} name={name} size="lg" />
            <div className="min-w-0">
              {name && (
                <div className="font-grotesk text-[13.5px] font-semibold text-gray-900 dark:text-white truncate">
                  {name}
                </div>
              )}
              <div className="text-[12px] text-gray-500 truncate">{email}</div>
              {meta && (
                <div className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-gray-400 mt-1">
                  {meta}
                </div>
              )}
            </div>
          </div>
          <form action="/logout" method="post">
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-[13px] text-gray-700 dark:text-gray-300 hover:bg-black/4 dark:hover:bg-white/5 transition-colors cursor-pointer bg-transparent border-0"
            >
              <LogOut size={15} className="text-gray-400" aria-hidden="true" />
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

/* ---------------- top bar ---------------- */

function Topbar({
  area,
  email,
  name,
  meta,
  slot,
}: {
  area: string;
  email: string | null;
  name?: string | null;
  meta?: string | null;
  /** Optional control sitting just before the theme toggle. */
  slot?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-black/10 dark:border-white/10 bg-white/85 dark:bg-[#0C0C12]/85 backdrop-blur-md px-4 md:px-6 h-[57px]">
      <div className="flex min-w-0 items-center gap-2.5">
        <Logo className="h-[26px]" />
        <span className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-gray-400 dark:text-gray-600">
          / {area}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2.5">
        {slot}
        <ThemeToggle />
        <ProfileMenu email={email} name={name} meta={meta} />
      </div>
    </header>
  );
}

/* ---------------- sidebar ---------------- */

/**
 * One nav row.
 *
 * At module scope on purpose. Declared inside Sidebar it would be a new
 * component type on every render, so React would unmount and remount every row
 * rather than update it.
 */
function NavRow({
  it,
  active,
  onNavigate,
}: {
  it: NavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  if (it.disabled) {
    return (
      <span
        aria-disabled="true"
        className="flex w-full cursor-not-allowed items-center gap-2.5 border-l-2 border-transparent px-3 py-2 text-left text-[13px] text-gray-400 dark:text-gray-600 opacity-70"
        title={it.disabledTip ? `${it.label}: ${it.disabledTip}` : undefined}
      >
        <span className="grid h-5 w-5 shrink-0 place-items-center">{it.icon}</span>
        <span className="min-w-0 flex-1 truncate">{it.label}</span>
        {it.disabledTip && (
          <span className="font-mono text-[9px] uppercase tracking-[0.1em] border border-black/10 dark:border-white/12 px-1 py-0.5 shrink-0">
            {it.disabledTip}
          </span>
        )}
      </span>
    );
  }

  return (
    <Link
      href={it.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`group flex w-full items-center gap-2.5 border-l-2 px-3 py-2 text-left text-[13px] no-underline transition-colors ${
        active
          ? "border-[#2B50DC] bg-[#2B50DC]/8 font-semibold text-[#2B50DC] dark:border-[#5B8DEF] dark:text-[#5B8DEF]"
          : "border-transparent text-gray-600 dark:text-gray-400 hover:bg-black/4 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white"
      }`}
    >
      <span
        className={`grid h-5 w-5 shrink-0 place-items-center ${
          active
            ? "text-[#2B50DC] dark:text-[#5B8DEF]"
            : "text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300"
        }`}
      >
        {it.icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{it.label}</span>
      {it.badge ? (
        <span className="gradient-bg px-1.5 py-0.5 font-mono text-[10px] font-bold leading-none text-white shrink-0">
          {it.badge}
        </span>
      ) : null}
    </Link>
  );
}

function GroupList({
  groups,
  isActive,
  isOpen,
  onToggle,
  onNavigate,
  forceOpen = false,
}: {
  groups: NavGroup[];
  isActive: (href: string) => boolean;
  isOpen: (title: string) => boolean;
  onToggle: (title: string) => void;
  onNavigate?: () => void;
  /* The mobile sheet shows everything: there is no room to hunt for a chevron. */
  forceOpen?: boolean;
}) {
  return (
    <>
      {groups.map((g) => {
        if (!g.title) {
          return (
            <ul key="top" className="flex flex-col gap-0.5 mb-3">
              {g.items.map((it) => (
                <li key={it.href}>
                  <NavRow it={it} active={isActive(it.href)} onNavigate={onNavigate} />
                </li>
              ))}
            </ul>
          );
        }

        const open = forceOpen || isOpen(g.title);
        /*
         * A closed group must not swallow its items' badges. An unread count
         * hiding is worse than a busy rail, so the sum bubbles up to the header.
         */
        const closedBadge = open ? 0 : g.items.reduce((sum, it) => sum + (it.badge ?? 0), 0);

        return (
          <div key={g.title} className="mb-2">
            {forceOpen ? (
              <p className="px-3 pb-1.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.13em] text-gray-400 dark:text-gray-600">
                {g.title}
              </p>
            ) : (
              <button
                type="button"
                onClick={() => onToggle(g.title)}
                aria-expanded={open}
                className="flex w-full items-center gap-2 px-3 py-1.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.13em] text-gray-400 dark:text-gray-600 hover:text-gray-700 dark:hover:text-gray-300 transition-colors cursor-pointer bg-transparent border-0"
              >
                <ChevronDown
                  size={12}
                  className={`shrink-0 transition-transform ${open ? "" : "-rotate-90"}`}
                  aria-hidden="true"
                />
                <span className="flex-1 text-left">{g.title}</span>
                {closedBadge > 0 && (
                  <span className="gradient-bg px-1.5 py-0.5 font-mono text-[9.5px] font-bold leading-none text-white">
                    {closedBadge}
                  </span>
                )}
              </button>
            )}
            {open && (
              <ul className="flex flex-col gap-0.5">
                {g.items.map((it) => (
                  <li key={it.href}>
                    <NavRow it={it} active={isActive(it.href)} onNavigate={onNavigate} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </>
  );
}

function Sidebar({
  groups,
  bottom,
  storageKey,
}: {
  groups: NavGroup[];
  bottom?: NavItem[];
  storageKey: string;
}) {
  const pathname = usePathname();
  const [sheet, setSheet] = useState(false);

  const stored = useSyncExternalStore(
    railStore.subscribe,
    useCallback(() => railStore.getSnapshot(storageKey), [storageKey]),
    railStore.getServerSnapshot
  );

  const allItems = useMemo(
    () => groups.flatMap((g) => g.items).concat(bottom ?? []),
    [groups, bottom]
  );

  /*
   * Exactly one row is current, and it is the deepest match.
   *
   * A plain prefix test made every admin screen light up Overview, because its
   * href is /admin and that prefixes all of them. Resolving the longest matching
   * href first and then comparing against it keeps a parent from claiming its
   * children.
   */
  const activeHref = useMemo(() => {
    let best: string | null = null;
    for (const it of allItems) {
      if (pathname === it.href || pathname.startsWith(it.href + "/")) {
        if (best === null || it.href.length > best.length) best = it.href;
      }
    }
    return best;
  }, [allItems, pathname]);

  const isActive = useCallback((href: string) => href === activeHref, [activeHref]);

  /*
   * Whether a group is open, resolved rather than stored.
   *
   * Precedence: the group holding the active item is always open, because
   * hiding where you are is never a choice anyone made. Then the visitor's own
   * stored choice. Then the group's default.
   *
   * Reading it this way, instead of copying localStorage into state on mount,
   * means a group added since somebody's last visit still gets its default
   * rather than arriving collapsed because no stored entry said otherwise.
   */
  const isOpen = useCallback(
    (title: string) => {
      const group = groups.find((g) => g.title === title);
      if (group?.items.some((it) => isActive(it.href))) return true;
      if (title in stored) return stored[title];
      return group?.defaultOpen ?? false;
    },
    [groups, stored, isActive]
  );

  const onToggle = useCallback(
    (title: string) => {
      railStore.set(storageKey, { ...stored, [title]: !isOpen(title) });
    },
    [storageKey, stored, isOpen]
  );

  const activeLabel = allItems.find((it) => isActive(it.href))?.label ?? "Menu";
  const totalBadge = allItems.reduce((sum, it) => sum + (it.badge ?? 0), 0);

  /* A sheet over the page must not leave the page scrolling behind it. */
  useEffect(() => {
    if (!sheet) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSheet(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [sheet]);

  const closeSheet = useCallback(() => setSheet(false), []);

  return (
    <nav className="border-b border-black/10 dark:border-white/10 bg-white dark:bg-[#0C0C12] md:w-[236px] md:shrink-0 md:border-b-0 md:border-r">
      <div className="p-3 md:sticky md:top-[57px] md:flex md:h-[calc(100vh-57px)] md:flex-col">
        {/*
          Mobile: a button that says what needs you, opening a real menu.
          The portal exists to answer one question, is anything waiting on me, so
          that count sits on the bar itself rather than inside a control nobody
          opens unless they already know to.
        */}
        <div className="md:hidden">
          <button
            type="button"
            onClick={() => setSheet(true)}
            aria-expanded={sheet}
            className="flex w-full items-center justify-between border border-black/12 dark:border-white/15 bg-black/3 dark:bg-white/4 px-3 py-2.5 text-left hover:border-[#2B50DC]/50 transition-colors cursor-pointer"
          >
            <span className="inline-flex min-w-0 items-center gap-2">
              <Menu size={16} className="shrink-0 text-gray-400" aria-hidden="true" />
              <span className="truncate text-[14px] text-gray-900 dark:text-white">{activeLabel}</span>
            </span>
            {totalBadge > 0 ? (
              <span className="ml-2 shrink-0 gradient-bg px-2 py-0.5 font-mono text-[10px] font-bold leading-none text-white">
                {totalBadge} needs you
              </span>
            ) : (
              <ChevronDown size={15} className="shrink-0 text-gray-400" aria-hidden="true" />
            )}
          </button>
        </div>

        {sheet && (
          <div className="fixed inset-0 z-50 md:hidden">
            <button
              type="button"
              aria-label="Close the menu"
              onClick={closeSheet}
              className="absolute inset-0 bg-[#050508]/70 cursor-pointer border-0"
            />
            <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto border-t border-black/12 dark:border-white/15 bg-white dark:bg-[#0C0C12] p-4 pb-8">
              <div className="flex items-center justify-between mb-4">
                <LogoMark className="h-6" />
                <button
                  type="button"
                  onClick={closeSheet}
                  aria-label="Close"
                  className="grid h-8 w-8 place-items-center border border-black/12 dark:border-white/15 text-gray-500 cursor-pointer bg-transparent"
                >
                  <X size={15} />
                </button>
              </div>
              <GroupList
                groups={groups}
                isActive={isActive}
                isOpen={isOpen}
                onToggle={onToggle}
                onNavigate={closeSheet}
                forceOpen
              />
              {bottom && bottom.length > 0 && (
                <ul className="flex flex-col gap-0.5 border-t border-black/8 dark:border-white/8 pt-3 mt-3">
                  {bottom.map((it) => (
                    <li key={it.href}>
                      <NavRow it={it} active={isActive(it.href)} onNavigate={closeSheet} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        <div className="hidden flex-col gap-0.5 md:flex md:min-h-0 md:flex-1 md:overflow-y-auto">
          <GroupList groups={groups} isActive={isActive} isOpen={isOpen} onToggle={onToggle} />
        </div>

        {bottom && bottom.length > 0 && (
          <ul className="hidden md:flex flex-col gap-0.5 border-t border-black/8 dark:border-white/8 pt-2 mt-2 shrink-0">
            {bottom.map((it) => (
              <li key={it.href}>
                <NavRow it={it} active={isActive(it.href)} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </nav>
  );
}

/* ---------------- the shell ---------------- */

export default function Shell({
  area,
  groups,
  bottom,
  storageKey,
  userEmail,
  userName,
  userMeta,
  headerSlot,
  children,
}: {
  /** What sits after the wordmark in the top bar: "Admin" or "Portal". */
  area: string;
  groups: NavGroup[];
  bottom?: NavItem[];
  /** Per-portal key, so admin and client rails remember their own groups. */
  storageKey: string;
  userEmail: string | null;
  userName?: string | null;
  userMeta?: string | null;
  /** Rendered in the top bar, immediately before the theme toggle. */
  headerSlot?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#F4F2EF] dark:bg-[#050508] transition-colors duration-300">
      <a
        href="#portal-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[110] focus:gradient-bg focus:px-4 focus:py-2.5 focus:text-white focus:font-semibold focus:text-sm"
      >
        Skip to content
      </a>

      <Topbar area={area} email={userEmail} name={userName} meta={userMeta} slot={headerSlot} />

      <div className="flex min-h-[calc(100vh-57px)] flex-col md:flex-row">
        <Sidebar groups={groups} bottom={bottom} storageKey={storageKey} />
        <main id="portal-main" className="min-w-0 flex-1 p-5 lg:p-8">
          <div className="max-w-[1180px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
