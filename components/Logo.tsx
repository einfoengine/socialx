import Image from "next/image";
import Link from "next/link";

/*
 * The socialX logo.
 *
 * Two files rather than one, swapped by the theme class. The SVG in public is
 * drawn with fill="white" baked in, so it disappears on the cream canvas, and the
 * portals default to light. Swapping in CSS rather than in JavaScript means the
 * right mark is painted on the first frame, with no flash of the wrong one and
 * nothing to go wrong during hydration.
 *
 * The dark-ink version carries the alt text and the white one is hidden from
 * assistive tech, so the name is announced once rather than twice.
 */

const RATIO = 983 / 208;

export function LogoMark({ className = "h-7" }: { className?: string }) {
  return (
    <>
      <Image
        src="/socialX-logo-dark.png"
        alt="socialX"
        width={983}
        height={208}
        /* The mark renders around 130px wide. Without this hint Next builds the
           srcset from device widths and ships a 2048px file for a logo. */
        sizes="160px"
        priority
        className={`${className} w-auto object-contain dark:hidden`}
      />
      <Image
        src="/socialX-logo-white.png"
        alt=""
        aria-hidden="true"
        width={529}
        height={112}
        sizes="160px"
        priority
        className={`${className} w-auto object-contain hidden dark:block`}
      />
    </>
  );
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
