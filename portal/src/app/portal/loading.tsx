import PageSkeleton from "@/components/PageSkeleton";

/**
 * Shown the instant a portal route is navigated to.
 *
 * Draws the arriving screen's real heading rather than a grey bar where it would
 * go, from the same record the pages themselves read. Calendar and onboarding
 * take their title from data, so those get a skeleton line instead of the wrong
 * words held confidently.
 */
export default function PortalLoading() {
  return <PageSkeleton variant="portal" fallbackShape="panels" />;
}
