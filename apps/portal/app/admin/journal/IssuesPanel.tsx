import IssueRow, { type Issue } from "./IssueRow";

/* Open work first, in issue order. Closed items stay on the page rather than
   disappearing, because "we decided not to" is worth as much later as "we fixed
   it", and a list that hides its own history invites the same finding twice. */
export default function IssuesPanel({
  issues,
  canEdit,
}: {
  issues: Issue[];
  canEdit: boolean;
}) {
  const closed = (i: Issue) => i.status === "resolved" || i.status === "wont_fix";
  const openIssues = issues.filter((i) => !closed(i));
  const doneIssues = issues.filter(closed);
  const high = openIssues.filter((i) => i.severity === "high").length;

  return (
    <div className="flex flex-col gap-8">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        {openIssues.length} open, {high} of them high. Click a title for the detail.
        {!canEdit && " Your role can read this list but not change a status."}
      </p>

      <section>
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-gray-400 dark:text-gray-600 mb-3">
          Open
        </div>
        <div className="border border-black/10 dark:border-white/10 bg-white dark:bg-[#111118]">
          {openIssues.length === 0 ? (
            <p className="px-5 py-4 text-[13px] text-gray-500">Nothing open.</p>
          ) : (
            openIssues.map((i) => <IssueRow key={i.id} issue={i} canEdit={canEdit} />)
          )}
        </div>
      </section>

      {doneIssues.length > 0 && (
        <section>
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-gray-400 dark:text-gray-600 mb-3">
            Closed
          </div>
          <div className="border border-black/10 dark:border-white/10 bg-white dark:bg-[#111118]">
            {doneIssues.map((i) => (
              <IssueRow key={i.id} issue={i} canEdit={canEdit} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
