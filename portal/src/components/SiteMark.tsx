import Link from "next/link";

/**
 * A site's mark in the chrome.
 *
 * The portal wears the brand of the site whose client is signed in, so the
 * wordmark cannot be a component with one company baked into it. This renders
 * whatever that site provided and degrades honestly when it provided nothing: a
 * logo if there is one, the wordmark text if not, and the site's name if neither.
 *
 * Two images rather than one swapped in JavaScript, hidden by the theme class.
 * The theme is applied on the document before paint by the initializer in the
 * root layout, so a CSS swap is correct on the very first frame; deciding in
 * JavaScript would flash the wrong logo on every load. When a site sets only one
 * logo, that single image serves both themes and only one element is rendered.
 *
 * Plain <img>, not next/image. These are arbitrary https URLs on hosts this
 * platform does not know at build time, and the optimizer needs each one
 * configured in next.config. A logo in a top bar is a few kilobytes; a
 * configuration step that has to be repeated for every new customer is a
 * permanent cost.
 */
export type SiteMarkBrand = {
  wordmark: string;
  logoUrl: string | null;
  logoDarkUrl: string | null;
  /** Where clicking it goes. The site's own website, when it has one. */
  href: string | null;
};

export default function SiteMark({
  brand,
  className = "h-[26px]",
}: {
  brand: SiteMarkBrand;
  className?: string;
}) {
  const { logoUrl, logoDarkUrl } = brand;
  const bothThemes = Boolean(logoUrl && logoDarkUrl && logoUrl !== logoDarkUrl);

  const inner = logoUrl ? (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logoUrl}
        alt={brand.wordmark}
        className={`${className} w-auto ${bothThemes ? "dark:hidden" : ""}`}
      />
      {bothThemes && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoDarkUrl!}
          alt={brand.wordmark}
          className={`${className} hidden w-auto dark:block`}
        />
      )}
    </>
  ) : (
    <span className="font-grotesk text-[15px] font-semibold tracking-[-0.3px] text-gray-900 dark:text-white">
      {brand.wordmark}
    </span>
  );

  if (!brand.href) {
    return (
      <span className="inline-flex shrink-0 items-center" aria-label={brand.wordmark}>
        {inner}
      </span>
    );
  }

  return (
    <Link
      href={brand.href}
      className="inline-flex shrink-0 items-center no-underline"
      aria-label={brand.wordmark}
    >
      {inner}
    </Link>
  );
}
