import Link from "next/link";
import SocialXLogo from "./SocialXLogo";

/*
 * The socialX logo for the portals, checkout and auth chrome.
 *
 * This used to render two PNGs swapped by the theme class, because the SVG in
 * public had fill="white" baked in and vanished on the cream canvas. That pair
 * of files is gone: the mark now lives inline in SocialXLogo, where the wordmark
 * takes currentColor and the X keeps its own gradient. One element covers both
 * themes, so there is no swap to get wrong and no second file to ship.
 *
 * Callers set the colour with a text class on any ancestor, the same way they
 * would for an icon.
 */

const RATIO = 489 / 104;

export function LogoMark({ className = "h-7" }: { className?: string }) {
  return <SocialXLogo className={`${className} w-auto`} />;
}

/** The logo as a link home. What the chrome uses. */
export default function Logo({
  className = "h-7",
  href = "/",
}: {
  className?: string;
  href?: string;
}) {
  return (
    <Link href={href} className="inline-flex shrink-0 items-center no-underline" aria-label="socialX">
      <LogoMark className={className} />
    </Link>
  );
}

export { RATIO as LOGO_RATIO };
