import type { Metadata } from "next";
import { requirePermission } from "@/lib/dal/permissions";
import { createClient } from "@/lib/supabase/server";
import { addDecision, supersedeDecision } from "../actions";
import { Card, Tag, Empty, Field, AddPanel, inputClass, btnClass, fmtDate } from "../ui";

export const metadata: Metadata = { title: "Decisions | socialX Admin" };

type Decision = {
  id: string;
  decided_on: string;
  topic: string;
  decision: string;
  rationale: string | null;
  decided_by: string;
  status: string;
  supersedes_id: string | null;
};

export default async function DecisionsPage() {
  await requirePermission("journal");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("decisions")
    .select("id, decided_on, topic, decision, rationale, decided_by, status, supersedes_id")
    .order("decided_on", { ascending: false })
    .order("created_at", { ascending: false });

  const all = (data ?? []) as Decision[];
  const active = all.filter((d) => d.status === "active");
  const superseded = all.filter((d) => d.status !== "active");

  return (
    <div>
      <AddPanel summary="Record a decision">
        <form action={addDecision} className="flex flex-col gap-4 pt-4 max-w-[680px]">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Topic">
              <input name="topic" required placeholder="Payments" className={inputClass} />
            </Field>
            <Field label="Decided on">
              <input type="date" name="decided_on" className={inputClass} />
            </Field>
          </div>
          <Field label="The decision">
            <textarea
              name="decision"
              required
              rows={3}
              placeholder="State it plainly, the way it should be remembered."
              className={inputClass}
            />
          </Field>
          <Field label="Why">
            <textarea name="rationale" rows={3} className={inputClass} />
          </Field>
          <button type="submit" className={`${btnClass} self-start`}>
            Lock it in
          </button>
        </form>
      </AddPanel>

      {error && (
        <Empty>
          Could not load decisions. If the journal migration has not run yet, apply
          supabase/migrations/0009_journal.sql.
        </Empty>
      )}

      {!error && all.length === 0 && <Empty>No decisions recorded yet.</Empty>}

      <div className="flex flex-col gap-3">
        {active.map((d) => (
          <Card key={d.id}>
            <div className="flex items-start justify-between gap-4 mb-2">
              <div className="flex items-center gap-2.5">
                <span className="font-grotesk text-[15px] font-semibold text-gray-900 dark:text-white">
                  {d.topic}
                </span>
                {d.supersedes_id && <Tag tone="muted">revised</Tag>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Tag tone="muted">{fmtDate(d.decided_on)}</Tag>
                <Tag>{d.decided_by}</Tag>
              </div>
            </div>

            <p className="text-[14px] text-gray-900 dark:text-white leading-relaxed max-w-[80ch]">
              {d.decision}
            </p>

            {d.rationale && (
              <p className="text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed max-w-[80ch] mt-2 pl-3 border-l-2 border-black/10 dark:border-white/10">
                {d.rationale}
              </p>
            )}

            <details className="mt-3">
              <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.12em] text-gray-400 dark:text-gray-600 select-none">
                Change this decision
              </summary>
              <form action={supersedeDecision} className="flex flex-col gap-3 mt-3 max-w-[620px]">
                <input type="hidden" name="id" value={d.id} />
                <input type="hidden" name="topic" value={d.topic} />
                <Field label="New decision">
                  <textarea name="decision" required rows={2} className={inputClass} />
                </Field>
                <Field label="Why it changed">
                  <textarea name="rationale" rows={2} className={inputClass} />
                </Field>
                <button type="submit" className={`${btnClass} self-start`}>
                  Supersede
                </button>
                <p className="text-[11.5px] text-gray-500 dark:text-gray-500">
                  The old decision is kept and marked superseded, so the history of why it
                  changed stays readable.
                </p>
              </form>
            </details>
          </Card>
        ))}
      </div>

      {superseded.length > 0 && (
        <div className="mt-10">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.13em] text-gray-400 dark:text-gray-600 mb-3">
            Superseded
          </h2>
          <div className="flex flex-col gap-2">
            {superseded.map((d) => (
              <div
                key={d.id}
                className="border border-black/8 dark:border-white/8 p-4 opacity-60"
              >
                <div className="flex items-center justify-between gap-3 mb-1">
                  <span className="font-grotesk text-[13.5px] font-semibold text-gray-700 dark:text-gray-300 line-through">
                    {d.topic}
                  </span>
                  <Tag tone="muted">{fmtDate(d.decided_on)}</Tag>
                </div>
                <p className="text-[13px] text-gray-500 dark:text-gray-500 leading-relaxed">
                  {d.decision}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
