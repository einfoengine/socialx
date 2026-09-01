import Link from "next/link";
import { pageMeta } from "@/lib/page-meta";
import { requirePermission } from "@/lib/dal/permissions";
import { createClient } from "@socialx/core/supabase/server";
import { portalUrl } from "@socialx/core/urls";
import { DEFINITIONS, readSettings } from "@/lib/settings";
import SettingsForm from "../SettingsForm";
import PublicEntries, { type ContentRow } from "./PublicEntries";
import { Note, Panel, ReadOnlyNotice, SectionHead } from "../ui";

export const dynamic = "force-dynamic";

/**
 * Public API.
 *
 * The question this screen exists to answer is "what can anyone on the internet
 * read", and it answers it as a list rather than as a description of route code.
 * Everything not on that list needs a key.
 *
 * Two controls sit above the list because they are the two ways the answer can
 * be narrowed without touching any entry: the master switch, and an origin list
 * that behaves the opposite way to a key's. That inversion is stated on the
 * field, because it is the one thing about this page somebody could reasonably
 * get backwards.
 */
export default async function PublicApiPage() {
  const access = await requirePermission("settings");
  const canWrite = access.permissions.settings === "full";

  const [settings, supabase] = await Promise.all([readSettings(), createClient()]);
  const { data, error } = await supabase
    .from("site_content")
    .select("key, description, is_public, updated_at")
    .order("key");

  const migrationMissing = error?.code === "42703" || error?.code === "42P01";

  const rows: ContentRow[] = (data ?? []).map((r) => ({
    key: r.key as string,
    description: (r.description as string | null) ?? "",
    isPublic: r.is_public === true,
    updatedAt: (r.updated_at as string).slice(0, 16).replace("T", " "),
  }));

  const base = portalUrl("/api/v1");
  const publicCount = rows.filter((r) => r.isPublic).length;
  const enabled = settings["api.public_enabled"] === true;

  return (
    <div>
      <SectionHead {...pageMeta("/admin/settings/public-api")} />

      {!canWrite && <ReadOnlyNotice />}

      {migrationMissing ? (
        <div className="max-w-[78ch] border border-amber-500/40 bg-amber-500/10 p-5 text-[13.5px] leading-relaxed text-gray-700 dark:text-gray-300">
          <strong className="text-gray-900 dark:text-white">One-time setup needed.</strong>{" "}
          Site content has no is_public column yet. Run{" "}
          <code className="font-mono text-[12.5px]">pnpm db:migrate</code> from the repo
          root to apply migration 0024, then reload.
        </div>
      ) : (
        <>
          <Panel
            title="Reach"
            sub="The switch is absolute: with it off, every request needs a key whatever is marked public below. The origin list narrows the public surface to named domains; leaving it empty allows any origin, which is the usual choice for content that is already public."
          >
            <SettingsForm
              group="API"
              fields={DEFINITIONS.filter((d) => d.group === "API")}
              values={settings}
              canWrite={canWrite}
              submitLabel="Save reach"
            />
          </Panel>

          <Panel
            title="What is public"
            sub={
              enabled
                ? `${publicCount} of ${rows.length} entries answer without a credential.`
                : "The public API is off, so none of these answer without a key right now."
            }
          >
            <PublicEntries rows={rows} canWrite={canWrite} />
          </Panel>
        </>
      )}

      <Panel title="Endpoints" sub={`Base URL: ${base}`}>
        <dl className="flex flex-col gap-4 text-[12.5px]">
          <Endpoint
            method="GET"
            path="/content"
            auth="public or content:read"
            what="Every entry this caller may read, without the bodies. A public caller sees only what is marked public."
          />
          <Endpoint
            method="GET"
            path="/content/{key}"
            auth="public or content:read"
            what="One entry, with its JSON. A private entry answers 404 to a caller with no key, never 403, so the set of unpublished keys stays unguessable."
          />
          <Endpoint
            method="PUT"
            path="/content/{key}"
            auth="content:write"
            what="Replaces an existing entry's JSON. Cannot create, delete, or change what is public."
          />
          <Endpoint
            method="GET"
            path="/me"
            auth="any"
            what="What the presented credential is and what it may do. The endpoint to point at when a key is not working."
          />
        </dl>

        <pre className="mt-5 overflow-x-auto border border-black/10 bg-black/[0.02] p-4 font-mono text-[12px] leading-relaxed text-gray-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300">
{`# public, no credential
curl ${base}/content

# with a key
curl ${base}/content/homepage-banner \\
  -H "Authorization: Bearer sx_live_..."`}
        </pre>
      </Panel>

      <Note>
        Entries themselves are written under Content, on{" "}
        <Link href="/admin/website" className="text-[#2B50DC] dark:text-[#5B8DEF]">
          Website
        </Link>
        . This screen only decides who may read them. Keys and their domain
        allowlists are on{" "}
        <Link href="/admin/settings/api-keys" className="text-[#2B50DC] dark:text-[#5B8DEF]">
          API keys
        </Link>
        .
      </Note>
    </div>
  );
}

function Endpoint({
  method,
  path,
  auth,
  what,
}: {
  method: string;
  path: string;
  auth: string;
  what: string;
}) {
  return (
    <div>
      <dt className="flex flex-wrap items-center gap-2">
        <span className="border border-[#2B50DC]/40 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[#2B50DC] dark:border-[#5B8DEF]/40 dark:text-[#5B8DEF]">
          {method}
        </span>
        <code className="font-mono text-[12.5px] font-semibold text-gray-900 dark:text-white">
          {path}
        </code>
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-gray-400 dark:text-gray-600">
          {auth}
        </span>
      </dt>
      <dd className="mt-1 max-w-[76ch] leading-relaxed text-gray-600 dark:text-gray-400">
        {what}
      </dd>
    </div>
  );
}
