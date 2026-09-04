import {
  ActionPlaceholder,
  LibraryHeader,
  PillarMixSkeleton,
  SectionLabel,
  TemplateCardsSkeleton,
} from "./LibraryShell";

/**
 * Shown the instant the library is navigated to, before the server has said
 * anything at all.
 *
 * It is not a grey rectangle of the page. It is the page, with its real title,
 * its real subtitle and its real section labels already in place, and grey only
 * where a query genuinely has to come back. Next prefetches this fallback, so on
 * a click those words are on screen before the request has left the browser.
 */
export default function LibraryLoading() {
  return (
    <div>
      <LibraryHeader action={<ActionPlaceholder />} />
      <SectionLabel>Pillar mix against target</SectionLabel>
      <PillarMixSkeleton />
      <SectionLabel>Templates</SectionLabel>
      <TemplateCardsSkeleton />
    </div>
  );
}
