import { permanentRedirect } from "next/navigation";

/**
 * Where API keys used to live.
 *
 * They belong to a site now, so there is no longer a workspace-wide list to show:
 * every credential is issued against one website and reaches nothing outside it.
 * Managing them from a shared screen would mean choosing a site anyway, one row at
 * a time, which is the site record with extra steps.
 *
 * This stays as a redirect rather than a deletion because the path is in
 * bookmarks, in notes, and in a paragraph or two of the console's own copy. A 404
 * on a URL that worked last week is a support message; a redirect is not.
 */
export default function ApiKeysRedirect(): never {
  permanentRedirect("/admin/sites");
}
