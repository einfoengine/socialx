import PageSkeleton from "@/components/PageSkeleton";

/**
 * Settings has its own rail, rendered by the layout above this. Once that layout
 * has resolved, this fills only the content column beside it, so moving between
 * settings sections keeps the rail on screen and swaps just the panel.
 *
 * Most settings screens are stacked panels rather than a table, which is what
 * the fallback shape says for any section not named in the map.
 */
export default function SettingsLoading() {
  return <PageSkeleton fallbackShape="panels" />;
}
