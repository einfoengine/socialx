import PageSkeleton from "@/components/PageSkeleton";

/**
 * Shown the instant any admin route is navigated to.
 *
 * It draws the arriving page's real title and description, not a grey bar where
 * they would go, because neither of them depends on a query. See
 * components/PageSkeleton and lib/page-meta for how it knows them.
 *
 * Routes with a distinctive body ship their own fallback next to their page and
 * that one wins; this is the floor every other admin screen gets for free.
 */
export default function AdminLoading() {
  return <PageSkeleton />;
}
