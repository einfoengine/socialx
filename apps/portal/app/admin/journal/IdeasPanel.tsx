import { addIdea, rateIdea, setIdeaStatus, deleteIdea } from "./actions";
import { Card, Tag, Empty, Field, AddPanel, inputClass, btnClass } from "./ui";
import StarRating from "./StarRating";

type Idea = {
  id: string;
  title: string;
  detail: string | null;
  source: string;
  rating: number | null;
  status: string;
};

const STATUSES = ["open", "planned", "building", "shipped", "archived"];

export default function IdeasPanel({
  ideas,
  error,
}: {
  ideas: Idea[];
  error: boolean;
}) {

  const rated = ideas.filter((i) => i.rating !== null);
  const unrated = ideas.filter((i) => i.rating === null);

  return (
    <div>
      <AddPanel summary="Add an idea">
        <form action={addIdea} className="flex flex-col gap-4 pt-4 max-w-[680px]">
          <Field label="Idea">
            <input name="title" required placeholder="What could we do" className={inputClass} />
          </Field>
          <Field label="Detail">
            <textarea name="detail" rows={3} className={inputClass} />
          </Field>
          <button type="submit" className={`${btnClass} self-start`}>
            Add idea
          </button>
        </form>
      </AddPanel>

      <div className="border border-[#2B50DC]/30 bg-[#2B50DC]/5 dark:bg-[#5B8DEF]/8 p-4 mb-6 text-[13px] text-gray-700 dark:text-gray-300 max-w-[80ch]">
        <strong className="text-gray-900 dark:text-white">One star deletes.</strong> It is a
        discard rather than a low score, so an idea you have rejected never resurfaces.
        Two through five record how much you like it, and the list sorts by that.
      </div>

      {error && (
        <Empty>
          Could not load ideas. If the journal migration has not run yet, apply
          supabase/migrations/0009_journal.sql.
        </Empty>
      )}

      {!error && ideas.length === 0 && (
        <Empty>No ideas yet. Add one above, or I will add them as they come up.</Empty>
      )}

      {rated.length > 0 && (
        <section className="mb-10">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.13em] text-gray-400 dark:text-gray-600 mb-3">
            Rated
          </h2>
          <div className="flex flex-col gap-3">
            {rated.map((i) => (
              <IdeaCard key={i.id} idea={i} />
            ))}
          </div>
        </section>
      )}

      {unrated.length > 0 && (
        <section>
          <h2 className="font-mono text-[10px] uppercase tracking-[0.13em] text-gray-400 dark:text-gray-600 mb-3">
            Waiting on your call
          </h2>
          <div className="flex flex-col gap-3">
            {unrated.map((i) => (
              <IdeaCard key={i.id} idea={i} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function IdeaCard({ idea }: { idea: Idea }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-4 mb-2">
        <h3 className="font-grotesk text-[15px] font-semibold text-gray-900 dark:text-white">
          {idea.title}
        </h3>
        <div className="flex items-center gap-2 shrink-0">
          <Tag tone={idea.source === "shariful" ? "accent" : "muted"}>
            {idea.source === "shariful" ? "Shariful" : "Claude"}
          </Tag>
          <Tag>{idea.status}</Tag>
        </div>
      </div>

      {idea.detail && (
        <p className="text-[13.5px] text-gray-600 dark:text-gray-400 leading-relaxed max-w-[80ch] mb-4">
          {idea.detail}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-3 border-t border-black/8 dark:border-white/8">
        <StarRating ideaId={idea.id} rating={idea.rating} action={rateIdea} />

        <form action={setIdeaStatus} className="flex items-center gap-2">
          <input type="hidden" name="id" value={idea.id} />
          <select
            name="status"
            defaultValue={idea.status}
            className="bg-transparent border border-black/15 dark:border-white/15 px-2 py-1 text-[12px] text-gray-700 dark:text-gray-300 focus:outline-hidden focus:border-[#2B50DC]"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="font-mono text-[10px] uppercase tracking-[0.1em] text-gray-500 hover:text-[#2B50DC] dark:hover:text-white cursor-pointer bg-transparent border-0"
          >
            Set
          </button>
        </form>

        <form action={deleteIdea} className="ml-auto">
          <input type="hidden" name="id" value={idea.id} />
          <button
            type="submit"
            className="font-mono text-[10px] uppercase tracking-[0.1em] text-gray-400 hover:text-rose-500 cursor-pointer bg-transparent border-0"
          >
            Delete
          </button>
        </form>
      </div>
    </Card>
  );
}
