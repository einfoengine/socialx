import type { Metadata } from "next";
import Link from "next/link";
import { requireOrg } from "@/lib/dal/session";
import { createClient } from "@socialx/core/supabase/server";

export const metadata: Metadata = { title: "Calendar | socialX" };

/**
 * Month view of everything scheduled.
 *
 * A real grid rather than a list, because the question a founder actually has is
 * "does my feed look consistent", and that is a shape question, not a count.
 */
export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const session = await requireOrg();
  const { m } = await searchParams;
  const supabase = await createClient();

  const month = m ?? (await currentMonth());
  const [year, mon] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, mon - 1, 1));
  const last = new Date(Date.UTC(year, mon, 0));

  const { data: posts } = await supabase
    .from("posts")
    .select("id, title, format, platforms, scheduled_for, status, batch_id")
    .eq("org_id", session.orgId)
    .gte("scheduled_for", first.toISOString())
    .lte("scheduled_for", new Date(Date.UTC(year, mon, 0, 23, 59, 59)).toISOString())
    .order("scheduled_for");

  const byDay = new Map<number, typeof posts>();
  for (const p of posts ?? []) {
    if (!p.scheduled_for) continue;
    const d = new Date(p.scheduled_for).getUTCDate();
    byDay.set(d, [...(byDay.get(d) ?? []), p]);
  }

  const leadIn = first.getUTCDay();
  const days = last.getUTCDate();
  const prev = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <h1 className="font-grotesk text-2xl font-semibold tracking-[-0.6px] text-gray-900 dark:text-white">
          {first.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}
        </h1>
        <div className="flex gap-1 ml-auto">
          <Nav href={`/portal/calendar?m=${prev}`}>previous</Nav>
          <Nav href={`/portal/calendar?m=${next}`}>next</Nav>
        </div>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
        {(posts ?? []).length} post{(posts ?? []).length === 1 ? "" : "s"} scheduled this month.
      </p>

      <div className="grid grid-cols-7 gap-px bg-black/10 dark:bg-white/10 border border-black/10 dark:border-white/10">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div
            key={d}
            className="bg-white dark:bg-[#111118] px-2 py-2 font-mono text-[9.5px] uppercase tracking-[0.1em] text-gray-400 text-center"
          >
            {d}
          </div>
        ))}

        {Array.from({ length: leadIn }).map((_, i) => (
          <div key={`lead-${i}`} className="bg-black/2 dark:bg-white/2 min-h-[92px]" />
        ))}

        {Array.from({ length: days }).map((_, i) => {
          const day = i + 1;
          const items = byDay.get(day) ?? [];
          return (
            <div key={day} className="bg-white dark:bg-[#111118] min-h-[92px] p-1.5">
              <div className="font-mono text-[10px] text-gray-400 mb-1">{day}</div>
              <div className="flex flex-col gap-1">
                {(items ?? []).map((p) => (
                  <Link
                    key={p.id}
                    href={`/portal/approvals/${p.batch_id}`}
                    title={p.title ?? ""}
                    className={`block px-1.5 py-1 text-[10.5px] leading-tight no-underline truncate border-l-2 ${
                      p.status === "published"
                        ? "border-emerald-600 bg-emerald-600/8 text-emerald-800 dark:text-emerald-300"
                        : p.status === "scheduled"
                        ? "border-[#2B50DC] bg-[#2B50DC]/8 text-[#2B50DC] dark:text-[#5B8DEF]"
                        : "border-gray-400 bg-black/4 dark:bg-white/5 text-gray-600 dark:text-gray-400"
                    }`}
                  >
                    {p.format === "motion" ? "video: " : ""}
                    {p.title}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-4 mt-4 text-[11.5px] text-gray-500">
        <Key className="border-gray-400">in review or approved</Key>
        <Key className="border-[#2B50DC]">scheduled in your Social Planner</Key>
        <Key className="border-emerald-600">published</Key>
      </div>
    </div>
  );
}

async function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function shiftMonth(month: string, by: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function Nav({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="font-mono text-[10px] uppercase tracking-[0.1em] border border-black/12 dark:border-white/15 px-2.5 py-1.5 text-gray-500 no-underline hover:text-[#2B50DC] hover:border-[#2B50DC]/40 transition-colors"
    >
      {children}
    </Link>
  );
}

function Key({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block w-3 h-3 border-l-2 ${className}`} />
      {children}
    </span>
  );
}
