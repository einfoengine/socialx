import { addBuildLogEntry } from "./actions";
import { Card, Tag, Empty, Field, AddPanel, inputClass, btnClass, fmtDate } from "./ui";

type Entry = {
  id: string;
  entry_date: string;
  release: string | null;
  title: string;
  body: string | null;
  author: string;
};

export default function BuildLogPanel({
  entries,
  error,
}: {
  entries: Entry[];
  error: boolean;
}) {

  // Group by day so the log reads as a diary rather than a flat feed.
  const byDate = new Map<string, Entry[]>();
  for (const e of entries) {
    const list = byDate.get(e.entry_date) ?? [];
    list.push(e);
    byDate.set(e.entry_date, list);
  }

  return (
    <div>
      <AddPanel summary="Add an entry">
        <form action={addBuildLogEntry} className="flex flex-col gap-4 pt-4 max-w-[680px]">
          <div className="grid sm:grid-cols-3 gap-4">
            <Field label="Date">
              <input type="date" name="entry_date" className={inputClass} />
            </Field>
            <Field label="Release">
              <input name="release" placeholder="R0" className={inputClass} />
            </Field>
            <Field label="Author">
              <input name="author" defaultValue="Shariful" className={inputClass} />
            </Field>
          </div>
          <Field label="Title">
            <input name="title" required placeholder="What happened" className={inputClass} />
          </Field>
          <Field label="Detail">
            <textarea name="body" rows={4} className={inputClass} />
          </Field>
          <button type="submit" className={`${btnClass} self-start`}>
            Add entry
          </button>
        </form>
      </AddPanel>

      {error && (
        <Empty>
          Could not load the build log. If the journal migration has not run yet, apply
          supabase/migrations/0009_journal.sql.
        </Empty>
      )}

      {!error && entries.length === 0 && (
        <Empty>Nothing logged yet. Entries appear here newest first, grouped by day.</Empty>
      )}

      <div className="flex flex-col gap-8">
        {[...byDate.entries()].map(([date, items]) => (
          <section key={date}>
            <div className="flex items-center gap-3 mb-3">
              <h2 className="font-grotesk text-[15px] font-semibold text-gray-900 dark:text-white">
                {fmtDate(date)}
              </h2>
              <div className="h-px flex-1 bg-black/10 dark:bg-white/10" />
              <span className="font-mono text-[10px] text-gray-400 dark:text-gray-600">
                {items.length} {items.length === 1 ? "entry" : "entries"}
              </span>
            </div>

            <div className="flex flex-col gap-3">
              {items.map((e) => (
                <Card key={e.id}>
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <h3 className="font-grotesk text-[15px] font-semibold text-gray-900 dark:text-white">
                      {e.title}
                    </h3>
                    <div className="flex items-center gap-2 shrink-0">
                      {e.release && <Tag tone="accent">{e.release}</Tag>}
                      <Tag tone="muted">{e.author}</Tag>
                    </div>
                  </div>
                  {e.body && (
                    <p className="text-[13.5px] text-gray-600 dark:text-gray-400 leading-relaxed max-w-[80ch] whitespace-pre-wrap">
                      {e.body}
                    </p>
                  )}
                </Card>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
