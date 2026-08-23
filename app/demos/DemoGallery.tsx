"use client";

import { useState } from "react";
import demos from "@/public/demos.json";

type Platform = "facebook" | "instagram" | "linkedin";

/* ---------- brand glyphs (tabs) ---------- */

function FacebookGlyph({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.5c-1.48 0-1.94.92-1.94 1.86v2.24h3.3l-.53 3.49h-2.77V24C19.61 23.1 24 18.1 24 12.07" />
    </svg>
  );
}

function InstagramGlyph({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.6" cy="6.4" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function LinkedInGlyph({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.63-1.85 3.36-1.85 3.59 0 4.25 2.36 4.25 5.44v6.3zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}

/* ---------- shared bits ---------- */

const ICON = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function Globe({ className = "w-3 h-3" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" {...ICON} className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18" />
    </svg>
  );
}

function Avatar({
  letter,
  bg,
  size,
  ring = false,
}: {
  letter: string;
  bg: string;
  size: number;
  ring?: boolean;
}) {
  const inner = (
    <div
      className={`${bg} flex items-center justify-center rounded-full font-semibold text-white ${
        ring ? "border-2 border-white dark:border-black" : ""
      }`}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {letter}
    </div>
  );
  if (!ring) return inner;
  // Instagram's story ring
  return (
    <div className="rounded-full p-[2px] bg-[linear-gradient(45deg,#F58529,#DD2A7B,#8134AF,#515BD4)]">
      {inner}
    </div>
  );
}

function Dots() {
  return (
    <span className="ml-auto select-none text-[18px] leading-none opacity-60" aria-hidden="true">
      &#8943;
    </span>
  );
}

/* ---------- Facebook ---------- */

function FacebookPost({ p }: { p: (typeof demos.facebook)[0] }) {
  return (
    <article className="rounded-lg overflow-hidden bg-white dark:bg-[#242526] shadow-[0_1px_2px_rgba(0,0,0,0.2)]">
      <header className="flex items-center gap-2.5 px-4 pt-3 pb-2">
        <Avatar letter={p.avatarLetter} bg={p.avatarBg} size={40} />
        <div className="min-w-0">
          <div className="text-[15px] font-semibold leading-tight text-[#050505] dark:text-[#E4E6EB]">
            {p.pageName}
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-[13px] text-[#65676B] dark:text-[#B0B3B8]">
            <span>{p.meta}</span>
            <span aria-hidden="true">·</span>
            <span>{p.time}</span>
            <span aria-hidden="true">·</span>
            <Globe />
          </div>
        </div>
        <Dots />
      </header>

      <p className="px-4 pb-3 text-[15px] leading-[1.35] text-[#050505] dark:text-[#E4E6EB]">
        {p.text}
      </p>

      <img
        src={p.image}
        alt={`${p.brand} — ${p.tag}`}
        width={p.imageW}
        height={p.imageH}
        loading="lazy"
        className="block h-auto w-full"
      />

      <div className="flex items-center justify-between px-4 py-2.5 text-[15px] text-[#65676B] dark:text-[#B0B3B8]">
        <span className="flex items-center gap-1.5">
          <span className="flex -space-x-1" aria-hidden="true">
            <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[#1877F2] text-[10px] text-white">
              &#128077;
            </span>
            <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[#F33E58] text-[9px] text-white">
              &#10084;
            </span>
          </span>
          {p.likes}
        </span>
        <span>
          {p.comments} comments · {p.shares} shares
        </span>
      </div>

      <div className="mx-4 border-t border-[#CED0D4] dark:border-[#3E4042]" />

      <div className="flex px-2 py-1">
        {[
          { label: "Like", d: "M7 10v11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h3Zm0 0 5-7a2.5 2.5 0 0 1 2.4 3.2L13.6 10h5a2 2 0 0 1 2 2.4l-1.3 6A2 2 0 0 1 17.3 20H7" },
          { label: "Comment", d: "M21 11.5a8 8 0 0 1-8 8 8.4 8.4 0 0 1-3.6-.8L3 21l2.3-5.9A8 8 0 1 1 21 11.5Z" },
          { label: "Share", d: "M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 3v13M8 7l4-4 4 4" },
        ].map((b) => (
          <button
            key={b.label}
            type="button"
            className="flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-[15px] font-semibold text-[#65676B] transition-colors hover:bg-black/5 dark:text-[#B0B3B8] dark:hover:bg-white/10"
          >
            <svg viewBox="0 0 24 24" {...ICON} className="h-[18px] w-[18px]" aria-hidden="true">
              <path d={b.d} />
            </svg>
            {b.label}
          </button>
        ))}
      </div>
    </article>
  );
}

/* ---------- Instagram ---------- */

/* Instagram is a profile GRID, not a single-column feed: 3 square thumbnails per
   row with hairline gutters, under a profile header and the POSTS/REELS/TAGGED
   strip. Rendering it as stacked feed cards was the wrong mental model — nobody
   browses a brand on Instagram one post at a time. */
function InstagramGrid({
  posts,
  exampleLabel,
}: {
  posts: typeof demos.instagram;
  exampleLabel: string;
}) {
  const username = "socialx.demos";
  const avatarLetter = "X";
  const avatarBg = "bg-[#2B50DC]";

  return (
    <div className="bg-white dark:bg-black">
      {/* Profile header */}
      <div className="flex items-center gap-6 px-5 py-6 sm:gap-10 sm:px-8">
        <Avatar letter={avatarLetter} bg={avatarBg} size={72} ring />
        <div className="min-w-0">
          <div className="text-[17px] font-normal text-[#262626] dark:text-[#FAFAFA]">
            {username}
          </div>
          <div className="mt-3 flex gap-6 text-[14px] text-[#262626] dark:text-[#FAFAFA]">
            <span>
              <span className="font-semibold">{posts.length}</span> posts
            </span>
          </div>
          <div className="mt-2 text-[14px] leading-snug text-[#262626] dark:text-[#FAFAFA]">
            <span className="font-semibold">socialX demo work</span>
            <br />
            <span className="text-[#737373]">{exampleLabel} · HighLevel SaaS</span>
          </div>
        </div>
      </div>

      {/* POSTS / REELS / TAGGED */}
      <div className="flex justify-center gap-10 border-t border-[#DBDBDB] text-[11px] font-semibold uppercase tracking-[1px] dark:border-[#262626]">
        <span className="-mt-px flex items-center gap-1.5 border-t border-[#262626] py-3.5 text-[#262626] dark:border-[#FAFAFA] dark:text-[#FAFAFA]">
          <svg viewBox="0 0 24 24" {...ICON} className="h-3 w-3" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" />
            <path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
          </svg>
          Posts
        </span>
        <span className="flex items-center gap-1.5 py-3.5 text-[#8E8E8E]">
          <svg viewBox="0 0 24 24" {...ICON} className="h-3 w-3" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" />
            <path d="m10 8.5 5 3.5-5 3.5v-7Z" />
          </svg>
          Reels
        </span>
        <span className="flex items-center gap-1.5 py-3.5 text-[#8E8E8E]">
          <svg viewBox="0 0 24 24" {...ICON} className="h-3 w-3" aria-hidden="true">
            <circle cx="12" cy="9" r="3.2" />
            <path d="M5 20c0-3.4 3-5.5 7-5.5s7 2.1 7 5.5" />
          </svg>
          Tagged
        </span>
      </div>

      {/* The grid itself */}
      <div className="grid grid-cols-3 gap-[2px] sm:gap-[3px]">
        {posts.map((p) => (
          <div key={p.id} className="group relative aspect-[4/5] overflow-hidden">
            <img
              src={p.image}
              alt={`${p.brand} — ${p.tag}`}
              loading="lazy"
              className="h-full w-full object-cover"
            />
            {/* Instagram's desktop hover: dim the tile, surface the counts */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-5 bg-black/40 text-[14px] font-semibold text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100">
              <span className="flex items-center gap-1.5">
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                  <path d="M12 20.5S3.5 15 3.5 9.2A4.7 4.7 0 0 1 12 6.6a4.7 4.7 0 0 1 8.5 2.6c0 5.8-8.5 11.3-8.5 11.3Z" />
                </svg>
                {p.likes.toLocaleString()}
              </span>
              <span className="flex items-center gap-1.5">
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                  <path d="M21 11.5a8 8 0 0 1-8 8 8.4 8.4 0 0 1-3.6-.8L3 21l2.3-5.9A8 8 0 1 1 21 11.5Z" />
                </svg>
                {p.comments}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Instagram's single-post view, for the feed toggle. The grid is how you browse
   a profile; this is how a post actually lands in someone's timeline. */
function InstagramFeedPost({ p }: { p: (typeof demos.instagram)[0] }) {
  return (
    <article className="rounded-sm border border-[#DBDBDB] bg-white dark:border-[#262626] dark:bg-black">
      <header className="flex items-center gap-3 px-3 py-2.5">
        <Avatar letter={p.avatarLetter} bg={p.avatarBg} size={32} ring />
        <div className="min-w-0 leading-tight">
          <div className="text-[14px] font-semibold text-[#262626] dark:text-[#FAFAFA]">
            {p.username}
          </div>
          <div className="text-[12px] text-[#737373]">{p.location}</div>
        </div>
        <Dots />
      </header>

      {/* The creative is 4:5 (608x760), Instagram's portrait format. Forcing a
          square crop here cut 20% off it. Rendering at intrinsic size lets each
          post keep its own ratio; width/height also reserve space so the feed
          doesn't jump as images load. */}
      <img
        src={p.image}
        alt={`${p.brand} — ${p.tag}`}
        width={p.imageW}
        height={p.imageH}
        loading="lazy"
        className="block h-auto w-full"
      />

      <div className="flex items-center gap-4 px-3 pt-3 text-[#262626] dark:text-[#FAFAFA]">
        <svg viewBox="0 0 24 24" {...ICON} strokeWidth={1.8} className="h-6 w-6" aria-label="Like">
          <path d="M12 20.5S3.5 15 3.5 9.2A4.7 4.7 0 0 1 12 6.6a4.7 4.7 0 0 1 8.5 2.6c0 5.8-8.5 11.3-8.5 11.3Z" />
        </svg>
        <svg viewBox="0 0 24 24" {...ICON} strokeWidth={1.8} className="h-6 w-6" aria-label="Comment">
          <path d="M21 11.5a8 8 0 0 1-8 8 8.4 8.4 0 0 1-3.6-.8L3 21l2.3-5.9A8 8 0 1 1 21 11.5Z" />
        </svg>
        <svg viewBox="0 0 24 24" {...ICON} strokeWidth={1.8} className="h-6 w-6" aria-label="Share">
          <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" />
        </svg>
        <svg viewBox="0 0 24 24" {...ICON} strokeWidth={1.8} className="ml-auto h-6 w-6" aria-label="Save">
          <path d="M6 3h12v18l-6-4.5L6 21V3Z" />
        </svg>
      </div>

      <div className="px-3 pt-2 text-[14px] font-semibold text-[#262626] dark:text-[#FAFAFA]">
        {p.likes.toLocaleString()} likes
      </div>
      <p className="px-3 pt-1 text-[14px] leading-[1.4] text-[#262626] dark:text-[#FAFAFA]">
        <span className="font-semibold">{p.username}</span> {p.caption}{" "}
        <span className="text-[#00376B] dark:text-[#E0F1FF]">{p.hashtags}</span>
      </p>
      <div className="px-3 pt-1.5 text-[14px] text-[#737373]">
        View all {p.comments} comments
      </div>
      <div className="px-3 pb-3 pt-1.5 text-[10px] uppercase tracking-[0.2px] text-[#737373]">
        {p.time}
      </div>
    </article>
  );
}

/* ---------- LinkedIn ---------- */

function LinkedInPost({ p }: { p: (typeof demos.linkedin)[0] }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = p.text.length > 240;
  const shown = expanded || !isLong ? p.text : p.text.slice(0, 240).trimEnd();

  return (
    <article className="rounded-lg border border-black/10 bg-white dark:border-white/10 dark:bg-[#1D2226]">
      <header className="flex items-start gap-2 px-4 pt-3">
        <Avatar letter={p.avatarLetter} bg={p.avatarBg} size={48} />
        <div className="min-w-0 leading-tight">
          <div className="text-[14px] font-semibold text-[rgba(0,0,0,0.9)] dark:text-[rgba(255,255,255,0.9)]">
            {p.brand}
          </div>
          <div className="text-[12px] text-[rgba(0,0,0,0.6)] dark:text-[rgba(255,255,255,0.6)]">
            {p.headline}
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-[12px] text-[rgba(0,0,0,0.6)] dark:text-[rgba(255,255,255,0.6)]">
            <span>{p.time}</span>
            <span aria-hidden="true">·</span>
            <Globe />
          </div>
        </div>
        <Dots />
      </header>

      <p className="whitespace-pre-line px-4 py-3 text-[14px] leading-[1.45] text-[rgba(0,0,0,0.9)] dark:text-[rgba(255,255,255,0.9)]">
        {shown}
        {isLong && !expanded && (
          <>
            {"… "}
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="text-[rgba(0,0,0,0.6)] hover:text-[#0A66C2] hover:underline dark:text-[rgba(255,255,255,0.6)]"
            >
              see more
            </button>
          </>
        )}
      </p>

      <img
        src={p.image}
        alt={`${p.brand} — ${p.tag}`}
        width={p.imageW}
        height={p.imageH}
        loading="lazy"
        className="block h-auto w-full"
      />

      <div className="flex items-center justify-between px-4 py-2 text-[12px] text-[rgba(0,0,0,0.6)] dark:text-[rgba(255,255,255,0.6)]">
        <span className="flex items-center gap-1.5">
          <span className="flex -space-x-1" aria-hidden="true">
            <span className="flex h-[16px] w-[16px] items-center justify-center rounded-full bg-[#378FE9] text-[9px] text-white">
              &#128077;
            </span>
            <span className="flex h-[16px] w-[16px] items-center justify-center rounded-full bg-[#F5BB5C] text-[9px] text-white">
              &#128161;
            </span>
          </span>
          {p.likes}
        </span>
        <span>
          {p.comments} comments · {p.reposts} reposts
        </span>
      </div>

      <div className="mx-4 border-t border-black/10 dark:border-white/10" />

      <div className="grid grid-cols-4 px-2 py-1">
        {[
          { label: "Like", d: "M7 10v11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h3Zm0 0 5-7a2.5 2.5 0 0 1 2.4 3.2L13.6 10h5a2 2 0 0 1 2 2.4l-1.3 6A2 2 0 0 1 17.3 20H7" },
          { label: "Comment", d: "M21 11.5a8 8 0 0 1-8 8 8.4 8.4 0 0 1-3.6-.8L3 21l2.3-5.9A8 8 0 1 1 21 11.5Z" },
          { label: "Repost", d: "M17 2l4 4-4 4M21 6H7a4 4 0 0 0-4 4v1M7 22l-4-4 4-4M3 18h14a4 4 0 0 0 4-4v-1" },
          { label: "Send", d: "M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" },
        ].map((b) => (
          <button
            key={b.label}
            type="button"
            className="flex items-center justify-center gap-1.5 rounded-md py-2.5 text-[14px] font-semibold text-[rgba(0,0,0,0.6)] transition-colors hover:bg-black/5 dark:text-[rgba(255,255,255,0.6)] dark:hover:bg-white/10"
          >
            <svg viewBox="0 0 24 24" {...ICON} className="h-5 w-5" aria-hidden="true">
              <path d={b.d} />
            </svg>
            <span className="hidden sm:inline">{b.label}</span>
          </button>
        ))}
      </div>
    </article>
  );
}

/* ---------- gallery ---------- */

const TABS: {
  key: Platform;
  label: string;
  Glyph: (props: { className?: string }) => React.ReactElement;
  /* Selected-state accents. The row adopts the platform's own colour, so the
     control panel itself tells you which network you are looking at — including
     Instagram's four-stop gradient, run vertically for the accent bar. */
  text: string;
  hoverText: string;
  fill: string;
  bar: string;
  tint: string;
}[] = [
  {
    key: "facebook",
    label: "Facebook",
    Glyph: FacebookGlyph,
    text: "text-[#1877F2]",
    hoverText: "group-hover:text-[#1877F2]",
    fill: "bg-[#1877F2]",
    bar: "bg-[#1877F2]",
    tint: "bg-[#1877F2]/10 dark:bg-[#1877F2]/20",
  },
  {
    key: "instagram",
    label: "Instagram",
    Glyph: InstagramGlyph,
    text: "text-[#DD2A7B]",
    hoverText: "group-hover:text-[#DD2A7B]",
    fill: "bg-[linear-gradient(45deg,#F58529,#DD2A7B,#8134AF,#515BD4)]",
    bar: "bg-[linear-gradient(180deg,#F58529,#DD2A7B,#8134AF,#515BD4)]",
    tint: "bg-[#DD2A7B]/10 dark:bg-[#DD2A7B]/20",
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    Glyph: LinkedInGlyph,
    text: "text-[#0A66C2]",
    hoverText: "group-hover:text-[#0A66C2]",
    fill: "bg-[#0A66C2]",
    bar: "bg-[#0A66C2]",
    tint: "bg-[#0A66C2]/10 dark:bg-[#0A66C2]/20",
  },
];

/* Each feed carries the platform's own surface colour, column width and spacing
   — that framing does as much work as the cards themselves in making the tab
   read as "this is Facebook" rather than "these are cards". */
const FRAME: Record<Platform, string> = {
  facebook: "bg-[#F0F2F5] dark:bg-[#18191A]",
  instagram: "bg-white dark:bg-black",
  linkedin: "bg-[#F4F2EE] dark:bg-[#1B1F23]",
};

const COLUMN: Record<Platform, string> = {
  facebook: "space-y-4",
  instagram: "space-y-6",
  linkedin: "space-y-2",
};

/* The feed frame takes the platform's own column width. Previously the frame
   filled the whole grid track (~1000px) while the posts sat at 470-555px inside
   it, leaving a wide empty border box around a narrow strip of content. */
const FRAME_W: Record<Platform, string> = {
  facebook: "max-w-[560px]",
  instagram: "max-w-[640px]",
  linkedin: "max-w-[580px]",
};

/* Customization tiers, mirroring the pricing ladder: a library post as-is,
   through to something built from scratch. `default` is the landing state. */
const EXAMPLES: { key: string; label: string; dot: string }[] = [
  { key: "default", label: "Default", dot: "bg-gray-400" },
  { key: "light", label: "Light customization", dot: "bg-blue-sky" },
  { key: "heavy", label: "Heavy customization", dot: "bg-blue-neon" },
  { key: "custom", label: "Custom build", dot: "bg-linear-to-br from-blue-neon to-blue-sky" },
];

export default function DemoGallery() {
  const [active, setActive] = useState<Platform>("facebook");
  const [example, setExample] = useState<string>("default");
  /* Instagram alone has two legitimate readings: the profile grid and the feed.
     Kept separate from `active` so the choice survives switching networks. */
  const [igView, setIgView] = useState<"profile" | "feed">("profile");

  const keep = <T extends { example: string }>(list: T[]) =>
    list.filter((p) => p.example === example);

  const countExample = (key: string) => {
    const list = demos[active] as { example: string }[];
    return list.filter((p) => p.example === key).length;
  };

  const total =
    demos.facebook.length + demos.instagram.length + demos.linkedin.length;
  const visibleCount = countExample(example);
  const activeTab = TABS.find((t) => t.key === active)!;
  const activeExample = EXAMPLES.find((e) => e.key === example)!;

  const isGrid = active === "instagram" && igView === "profile";
  const frameW =
    active === "instagram"
      ? isGrid
        ? "max-w-[640px]"
        : "max-w-[500px]"
      : FRAME_W[active];

  return (
    <section className="py-16 md:py-24 bg-[#F4F2EF] dark:bg-[#050508] transition-colors duration-300">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* ---- Dashboard header ---- */}
        <header className="mb-10 flex flex-col gap-6 border-b border-black/10 pb-8 dark:border-white/10 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-3 font-grotesk text-[13px] font-medium uppercase tracking-[1.5px] text-[#2B50DC] dark:text-[#5B8DEF]">
              [ Demo posts ]
            </div>
            <h1 className="font-grotesk text-[32px] font-semibold leading-[1.08] tracking-[-1.4px] text-gray-900 dark:text-white md:text-[42px]">
              Real posts, <span className="gradient-text">in the real feed</span>.
            </h1>
            <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-gray-500 dark:text-gray-400 md:text-[16px]">
              Work we have produced for HighLevel SaaS brands, shown exactly the way
              a prospect would see it.
            </p>
          </div>

          <dl className="flex shrink-0 gap-8">
            {[
              { n: total, l: "Posts" },
              { n: EXAMPLES.length, l: "Examples" },
              { n: TABS.length, l: "Networks" },
            ].map((s) => (
              <div key={s.l}>
                <dt className="font-grotesk text-[10px] font-semibold uppercase tracking-[1.2px] text-gray-400 dark:text-gray-500">
                  {s.l}
                </dt>
                <dd className="font-grotesk text-[28px] font-semibold leading-none tracking-[-1px] text-gray-900 dark:text-white">
                  {s.n}
                </dd>
              </div>
            ))}
          </dl>
        </header>

        <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
          {/* ---- Control rail ---- */}
          <aside className="w-full lg:sticky lg:top-24 lg:w-[264px] lg:shrink-0 lg:self-start">
            <div className="border border-black/10 bg-white dark:border-white/10 dark:bg-white/[0.03]">
              {/* Network — icons only */}
              <div className="p-5">
                <div className="mb-4 font-grotesk text-[11px] font-semibold uppercase tracking-[1.2px] text-gray-500 dark:text-gray-400">
                  Network
                </div>
                <div role="tablist" aria-label="Choose a platform" className="flex gap-2.5">
                  {TABS.map((t) => {
                    const selected = active === t.key;
                    return (
                      <button
                        key={t.key}
                        role="tab"
                        type="button"
                        id={`tab-${t.key}`}
                        aria-selected={selected}
                        aria-controls={`panel-${t.key}`}
                        aria-label={t.label}
                        title={t.label}
                        onClick={() => setActive(t.key)}
                        className={`group flex h-14 flex-1 items-center justify-center border transition-all duration-200 ${
                          selected
                            ? `${t.fill} border-transparent text-white shadow-[0_6px_16px_rgba(0,0,0,0.18)]`
                            : `border-black/10 bg-black/[0.02] text-gray-400 hover:bg-black/[0.04] dark:border-white/10 dark:bg-white/[0.02] dark:hover:bg-white/[0.06] ${t.hoverText}`
                        }`}
                      >
                        <t.Glyph className="h-[22px] w-[22px]" />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-black/10 dark:border-white/10" />

              {/* Examples */}
              <div className="p-5">
                <div className="mb-4 font-grotesk text-[11px] font-semibold uppercase tracking-[1.2px] text-gray-500 dark:text-gray-400">
                  Examples
                </div>
                <div className="flex flex-col gap-1">
                  {EXAMPLES.map((e) => {
                    const selected = example === e.key;
                    const n = countExample(e.key);
                    return (
                      <button
                        key={e.key}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setExample(e.key)}
                        className={`relative flex w-full items-center gap-2.5 py-2.5 pl-3 pr-3 text-left font-grotesk text-sm transition-colors ${
                          selected
                            ? "bg-[#2B50DC]/10 font-semibold text-[#2B50DC] dark:bg-[#2B50DC]/20 dark:text-[#5B8DEF]"
                            : "text-gray-600 hover:bg-black/[0.03] hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white"
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`absolute left-0 top-0 h-full w-[3px] ${
                            selected ? "bg-[#2B50DC]" : "bg-transparent"
                          }`}
                        />
                        <span aria-hidden="true" className={`h-2 w-2 shrink-0 ${e.dot}`} />
                        <span className="truncate">{e.label}</span>
                        <span
                          className={`ml-auto text-xs tabular-nums ${
                            selected ? "opacity-70" : "text-gray-400 dark:text-gray-500"
                          }`}
                        >
                          {n}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </aside>

          {/* ---- Preview canvas ---- */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-4 border border-b-0 border-black/10 bg-white px-5 py-3 dark:border-white/10 dark:bg-white/[0.03]">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className={activeTab.text}>
                  <activeTab.Glyph className="h-4 w-4" />
                </span>
                <span className="font-grotesk text-sm font-semibold text-gray-900 dark:text-white">
                  {activeTab.label}
                </span>
                <span className="text-gray-300 dark:text-gray-600">/</span>
                <span className="truncate font-grotesk text-sm text-gray-500 dark:text-gray-400">
                  {activeExample.label}
                </span>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                {/* Profile / feed switch — Instagram only */}
                {active === "instagram" && (
                  <div
                    role="group"
                    aria-label="Instagram view"
                    className="flex border border-black/10 dark:border-white/10"
                  >
                    {([
                      {
                        key: "profile" as const,
                        label: "Profile view",
                        path: (
                          <>
                            <rect x="3" y="3" width="18" height="18" />
                            <path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
                          </>
                        ),
                      },
                      {
                        key: "feed" as const,
                        label: "Feed view",
                        path: (
                          <>
                            <rect x="4" y="3" width="16" height="8" />
                            <rect x="4" y="13" width="16" height="8" />
                          </>
                        ),
                      },
                    ]).map((v) => {
                      const on = igView === v.key;
                      return (
                        <button
                          key={v.key}
                          type="button"
                          aria-pressed={on}
                          aria-label={v.label}
                          title={v.label}
                          onClick={() => setIgView(v.key)}
                          className={`flex h-7 w-8 items-center justify-center transition-colors ${
                            on
                              ? "bg-[#DD2A7B] text-white"
                              : "text-gray-400 hover:bg-black/[0.04] hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-gray-200"
                          }`}
                        >
                          <svg viewBox="0 0 24 24" {...ICON} className="h-3.5 w-3.5" aria-hidden="true">
                            {v.path}
                          </svg>
                        </button>
                      );
                    })}
                  </div>
                )}

                <span className="font-grotesk text-[11px] uppercase tracking-[1.2px] text-gray-500 dark:text-gray-400">
                  {visibleCount} of {total}
                </span>
              </div>
            </div>

            <div className="border border-black/10 bg-[#EDEDF0] px-4 py-8 dark:border-white/10 dark:bg-[#0B0B10] sm:px-8 sm:py-12">
              <div className={`mx-auto w-full ${frameW}`}>
                <div
                  role="tabpanel"
                  id={`panel-${active}`}
                  aria-labelledby={`tab-${active}`}
                  className={`native-ui border border-black/10 shadow-[0_12px_40px_rgba(0,0,0,0.12)] dark:border-white/10 dark:shadow-[0_12px_40px_rgba(0,0,0,0.5)] ${FRAME[active]}`}
                >
                  {visibleCount === 0 ? (
                    <p className="px-6 py-20 text-center text-sm text-gray-500 dark:text-gray-400">
                      No {activeTab.label} posts at this level yet.
                    </p>
                  ) : isGrid ? (
                    <InstagramGrid
                      posts={keep(demos.instagram)}
                      exampleLabel={activeExample.label}
                    />
                  ) : (
                    <div className={`px-3 py-6 sm:px-5 sm:py-7 ${COLUMN[active]}`}>
                      {active === "facebook" &&
                        keep(demos.facebook).map((p) => <FacebookPost key={p.id} p={p} />)}
                      {active === "instagram" &&
                        keep(demos.instagram).map((p) => (
                          <InstagramFeedPost key={p.id} p={p} />
                        ))}
                      {active === "linkedin" &&
                        keep(demos.linkedin).map((p) => <LinkedInPost key={p.id} p={p} />)}
                    </div>
                  )}
                </div>

                <p className="mt-6 text-center text-xs text-gray-500 dark:text-gray-500">
                  Mock-ups for illustration. Engagement figures are indicative.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
