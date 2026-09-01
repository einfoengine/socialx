import { requirePermission } from "@/lib/dal/permissions";
import { pageMeta } from "@/lib/page-meta";
import { createClient } from "@socialx/core/supabase/server";
import { rel } from "@/lib/rel";
import type { Scope } from "@/lib/api/scopes";
import ApiKeysView, { type KeyRow } from "./ApiKeysView";
import { Note, ReadOnlyNotice, SectionHead } from "../ui";

export const dynamic = "force-dynamic";

/**
 * API keys.
 *
 * The list is read through the caller's own session, so the staff_read policy on
 * api_keys is what admits it. token_hash is not selected, and that is not
 * caution about the hash itself, which is useless to anyone: it is that a column
 * nobody selects cannot end up rendered into a page by a later edit.
 *
 * Timestamps are cut to the minute rather than formatted with Intl. This screen
 * is read by socialX staff to answer "was this key used today", and a stable
 * sortable string answers that better than a localized one that shifts with
 * whoever is looking.
 */
export default async function ApiKeysPage() {
  const access = await requirePermission("settings");
  const canWrite = access.permissions.settings === "full";
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("api_keys")
    .select(
      "id, name, prefix, scopes, allowed_origins, note, created_at, last_used_at, last_used_origin, expires_at, revoked_at, profiles(email)"
    )
    .order("created_at", { ascending: false });

  /* 42P01 is undefined_table. The screen ships ahead of the migration, so it
     says what to run instead of failing. */
  if (error?.code === "42P01") {
    return (
      <div>
        <SectionHead {...pageMeta("/admin/settings/api-keys")} />
        <div className="max-w-[78ch] border border-amber-500/40 bg-amber-500/10 p-5 text-[13.5px] leading-relaxed text-gray-700 dark:text-gray-300">
          <strong className="text-gray-900 dark:text-white">One-time setup needed.</strong>{" "}
          The api_keys table does not exist yet. Run{" "}
          <code className="font-mono text-[12.5px]">pnpm db:migrate</code> from the repo
          root to apply migration 0024, then reload.
        </div>
      </div>
    );
  }

  const stamp = (v: string | null) => (v ? v.slice(0, 16).replace("T", " ") : null);

  const keys: KeyRow[] = (data ?? []).map((k) => ({
    id: k.id as string,
    name: k.name as string,
    prefix: k.prefix as string,
    scopes: ((k.scopes as string[] | null) ?? []) as Scope[],
    allowedOrigins: (k.allowed_origins as string[] | null) ?? [],
    note: (k.note as string | null) ?? "",
    createdBy: rel<{ email?: string }>(k.profiles)?.email ?? "unknown",
    createdAt: stamp(k.created_at as string) ?? "",
    lastUsedAt: stamp(k.last_used_at as string | null),
    lastUsedOrigin: (k.last_used_origin as string | null) ?? null,
    expiresAt: stamp(k.expires_at as string | null),
    revokedAt: stamp(k.revoked_at as string | null),
  }));

  return (
    <div>
      <SectionHead {...pageMeta("/admin/settings/api-keys")} />

      {!canWrite && <ReadOnlyNotice />}

      <ApiKeysView keys={keys} canWrite={canWrite} />

      <Note>
        A key is the whole credential. There is no second factor on the API and no
        IP allowlist, so the domain list is the thing standing between a key that
        leaks into a public bundle and somebody else using it from their own page.
        Put a key in browser code only when its origins are set, and prefer a
        server side key with no origins at all whenever the calling code has a
        server to make the request from.
      </Note>
    </div>
  );
}
