import type { Metadata } from "next";
import { requirePermission, can } from "@/lib/dal/permissions";
import { createClient } from "@socialx/core/supabase/server";
import JournalShell, { type TabKey } from "./JournalShell";
import JourneyPanel from "./JourneyPanel";
import IssuesPanel from "./IssuesPanel";
import BuildLogPanel from "./BuildLogPanel";
import DecisionsPanel from "./DecisionsPanel";
import IdeasPanel from "./IdeasPanel";
import GuidelinesPanel, { type Guideline } from "./GuidelinesPanel";
import type { Issue } from "./IssueRow";

export const metadata: Metadata = { title: "Plan & Context | socialX Admin" };

export const dynamic = "force-dynamic";

const TAB_KEYS: TabKey[] = [
  "journey", "issues", "guidelines", "build-log", "decisions", "ideas",
];

/**
 * The whole journal in one request.
 *
 * Four queries, issued together rather than one per route, then every panel is
 * server rendered and handed to the client shell. The four used to be four
 * separate page loads, each paying the full auth stack before it could read a
 * single row.
 */
export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requirePermission("journal");
  const [canEdit, params, supabase] = await Promise.all([
    can("journal", "full"),
    searchParams,
    createClient(),
  ]);

  const [issuesRes, guidelinesRes, buildLogRes, decisionsRes, ideasRes] = await Promise.all([
    supabase.from("issues").select("id, number, title, detail, area, severity, status").order("number"),
    supabase.from("guidelines").select("id, number, area, rule, why").order("number"),
    supabase
      .from("build_log_entries")
      .select("id, entry_date, release, title, body, author")
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("decisions")
      .select("id, decided_on, topic, decision, rationale, decided_by, status, supersedes_id")
      .order("decided_on", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("ideas")
      .select("id, title, detail, source, rating, status")
      .order("rating", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }),
  ]);

  const issues = (issuesRes.data ?? []) as Issue[];
  const openIssues = issues.filter(
    (i) => i.status !== "resolved" && i.status !== "wont_fix"
  ).length;

  const requested = params.tab as TabKey | undefined;
  const initial: TabKey = requested && TAB_KEYS.includes(requested) ? requested : "journey";

  return (
    <JournalShell
      initial={initial}
      counts={{ issues: openIssues, guidelines: (guidelinesRes.data ?? []).length }}
      panels={{
        journey: <JourneyPanel />,
        issues: <IssuesPanel issues={issues} canEdit={canEdit} />,
        guidelines: <GuidelinesPanel rules={(guidelinesRes.data ?? []) as Guideline[]} />,
        "build-log": (
          <BuildLogPanel entries={(buildLogRes.data ?? []) as never} error={!!buildLogRes.error} />
        ),
        decisions: (
          <DecisionsPanel all={(decisionsRes.data ?? []) as never} error={!!decisionsRes.error} />
        ),
        ideas: <IdeasPanel ideas={(ideasRes.data ?? []) as never} error={!!ideasRes.error} />,
      }}
    />
  );
}
