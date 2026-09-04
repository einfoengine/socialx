/**
 * Every admin screen's heading, in one place.
 *
 * A page's title and its one line of description depend on nothing. They are the
 * same words before a query runs and after it returns, so they have no business
 * waiting on a database 260ms away, and no business being drawn as grey bars in
 * the meantime.
 *
 * They live here rather than inline in each page because two files need them:
 * the page itself, and the loading fallback that stands in front of it. If those
 * two disagreed by so much as a word, the heading would visibly rewrite itself
 * the moment the data landed, which is the exact flicker this is meant to
 * remove. One record, both readers, no drift possible.
 *
 * `shape` tells the fallback what the body below the heading looks like, so the
 * skeleton it draws is the right height. A placeholder of the wrong height is
 * worse than none: the page reflows when the real content arrives and the reader
 * loses their place at the moment they started to read.
 *
 * Three admin screens are deliberately absent. Client, Template and Package take
 * their heading from the record being viewed, so there is no static title to
 * promise; those keep a skeleton line for the heading alone.
 */

export type PageShape = "table" | "cards" | "panels" | "form";

export type PageMeta = {
  title: string;
  sub?: string;
  shape?: PageShape;
  /* The table's column headings, for shape "table".
     Same reasoning as title and sub, one level down. A table's headings depend on
     nothing either: they are the same words before the query and after it, so the
     fallback can draw the real header row and grey only the cells beneath it. The
     page reads them from here too, so the header cannot shift when the rows land. */
  columns?: string[];
};

export const PAGE_META = {
  "/admin/orders": {
    title: "Orders",
    sub: "Accounts that have paid but have not finished onboarding. Each one is waiting on either the client or us.",
    shape: "table",
    columns: ["Client", "Plan", "Billing", "Onboarding", "Status", "Paid"],
  },
  "/admin/subscriptions": {
    title: "Subscriptions",
    sub: "Every subscription, what it bills, and when it renews.",
    shape: "table",
    columns: ["Client", "Plan", "Cycle", "Billing", "Renews", "Status"],
  },
  "/admin/clients": {
    title: "Clients",
    sub: "Every organization, whatever state it is in.",
    shape: "table",
    columns: ["Client", "Plan", "HL location", "Status", "Since"],
  },
  "/admin/packages": {
    title: "Packages",
    sub: "The three tiers as they are sold. Name, what a client gets, and the four billing options behind each one.",
    shape: "panels",
  },
  "/admin/links": {
    title: "Links",
    sub: "Direct checkout links. Paste one into an email, a DM or a proposal and it goes straight to payment with the right package, cycle and discount already applied.",
    shape: "panels",
  },
  "/admin/journal": {
    title: "Plan & Context",
    sub: "Build context, locked decisions, and ideas worth keeping. This is the memory the project carries between sessions.",
    shape: "panels",
  },
  /* Both coupon tabs are the same screen with a different filter, so they carry
     the same heading. Two entries rather than a prefix match, because
     metaForPath is exact on purpose. */
  "/admin/coupons/regular": {
    title: "Coupons",
    sub: "Discounts applied at checkout. The buyer sees the list price struck through and what they are saving, which a pre-discounted price cannot show.",
    shape: "table",
  },
  "/admin/coupons/launch": {
    title: "Coupons",
    sub: "Discounts applied at checkout. The buyer sees the list price struck through and what they are saving, which a pre-discounted price cannot show.",
    shape: "table",
  },
  "/admin/batches": {
    title: "Batches",
    sub: "The monthly cycle for every client. This is what replaces the ClickUp board.",
    shape: "table",
    columns: ["Client", "Month", "Filled", "Revisions", "Due", "Status"],
  },
  "/admin/review": {
    title: "Review queue",
    sub: "Open change requests across every client, oldest first. Each one is a revision round the client has already paid for.",
    shape: "table",
    columns: ["Client", "Month", "Round", "What they want", "Waiting", "Action"],
  },
  "/admin/publishing": {
    title: "Publishing",
    sub: "Approved posts waiting to be loaded into the client's HL Social Planner. Automated in R4; a human does it today and marks it here.",
    shape: "table",
  },
  "/admin/library/features": {
    title: "HighLevel features",
    sub: "The tagging axis that crosses every pillar. Mark one changed when HighLevel ships an update and every template built on it surfaces for review.",
    shape: "table",
  },
  "/admin/library/new": {
    title: "New template",
    sub: "Niche neutral by default. Niche enters at customization, never in the base library.",
    shape: "form",
  },
  "/admin/website": {
    title: "Website",
    sub: "Named JSON a website renders. Change a value here and that site picks it up without a deploy.",
    shape: "panels",
  },
  "/admin/sites": {
    title: "Sites",
    sub: "Every website integrated with this platform. Each one owns its own brand, domains, credentials, content and clients, and reaches nothing belonging to another.",
    shape: "panels",
  },
  "/admin/people": {
    title: "People",
    sub: "Everyone who can sign in, staff and clients together. Checkout creates client accounts on its own; this is the manual way in.",
    shape: "table",
  },
  "/admin/settings": {
    title: "General",
    sub: "Platform-wide configuration. Anything that belongs to one website lives on that site's record instead, under Sites.",
    shape: "panels",
  },
  "/admin/settings/access": {
    title: "Access",
    sub: "What each staff role can reach. Roles are assigned per person on People; this is what a role means.",
    shape: "table",
  },
  "/admin/settings/api-keys": {
    title: "API keys",
    sub: "Credentials belong to the site they speak for. Issue and revoke them on that site's record.",
    shape: "panels",
  },
  "/admin/settings/ordering": {
    title: "Ordering",
    sub: "The four ways an order can reach this platform, and what it takes on trust. Which of them one website may use lives on that site's record.",
    shape: "panels",
  },
  "/admin/settings/billing": {
    title: "Payments",
    sub: "Whether a site collects its own money instead of this platform, and how old imported billing may get before the portal says so. Which sites do it lives on each site's record.",
    shape: "panels",
  },
  "/admin/settings/public-api": {
    title: "Public API",
    sub: "What the API serves with no credential at all. Everything else needs a key.",
    shape: "panels",
  },
  "/admin/settings/plans": {
    title: "Plans",
    sub: "The tier contract the system enforces. Quotas, revision allowances and the promised first batch.",
    shape: "panels",
  },
  "/admin/settings/rate-cards": {
    title: "Rate cards",
    sub: "Which pricing is live, and until when. Checkout takes the highest sorted active card whose window covers today.",
    shape: "panels",
  },
  "/admin/settings/pillars": {
    title: "Content pillars",
    sub: "The default monthly mix a batch is assembled to. Per-client plans can depart from it; this is where they start.",
    shape: "table",
  },

  /* The client portal. Four of its five screens already rendered their heading
     before any await, which is where the admin pattern came from; what they
     lacked was a fallback that knew the same words. Calendar and onboarding are
     absent on purpose: one is titled by the month being viewed and the other
     changes wording once the brand profile is complete. */
  "/portal": {
    title: "Overview",
    sub: "Your plan, your batch, and anything waiting on you.",
    shape: "panels",
  },
  "/portal/approvals": {
    title: "Approvals",
    sub: "Nothing publishes until you approve it. Review a month, approve the whole batch, or send back the pieces you want changed.",
    shape: "table",
  },
  "/portal/billing": {
    title: "Billing",
    sub: "Your plan, your invoices, and your card. Month to month, cancel anytime.",
    shape: "panels",
  },
  "/portal/team": {
    title: "Team",
    sub: "Who can see and approve content on this workspace.",
    shape: "table",
  },
} as const satisfies Record<string, PageMeta>;

export type PageRoute = keyof typeof PAGE_META;

/**
 * The heading for a page, by route.
 *
 * Typed against the map, so a route that does not exist is a compile error
 * rather than a heading that silently renders as undefined.
 */
export function pageMeta(route: PageRoute): PageMeta {
  return PAGE_META[route];
}

/**
 * The heading for a live pathname, for the loading fallback.
 *
 * Exact match only. A prefix match would give /admin/clients/<uuid> the Clients
 * heading, and promising "Clients" on the way into one organization is worse
 * than promising nothing: the wrong words would be on screen, confidently, until
 * the record arrived and replaced them.
 */
/** The column headings for a table screen, read by the page and its fallback. */
export function pageColumns(route: PageRoute): string[] {
  return (PAGE_META[route] as PageMeta).columns ?? [];
}

export function metaForPath(pathname: string): PageMeta | null {
  const clean = pathname.replace(/\/+$/, "") || "/admin";
  return (PAGE_META as Record<string, PageMeta>)[clean] ?? null;
}
