"use client";

import { useActionState, useState } from "react";
import { Table, Row, Cell, EmptyRow } from "@/components/DataTable";
import type { AccountRow } from "@/lib/dal/accounts";
import {
  createAccountAction,
  setPasswordAction,
  deleteAccountAction,
  type ActionResult,
} from "./actions";

const INPUT =
  "bg-transparent border border-black/15 dark:border-white/15 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-hidden focus:border-[#2B50DC] transition-colors w-full";

const STAFF_ROLES = ["owner", "ops", "content", "finance"] as const;
const MEMBER_ROLES = ["owner", "manager", "viewer"] as const;

export type Org = { id: string; name: string };

/**
 * One screen for who can sign in.
 *
 * The row actions share a single useActionState each, rather than one per row.
 * Every form posts the same action and carries its own user_id, so the hook only
 * has to hold the last result.
 */
export default function PeopleView({
  accounts,
  orgs,
  currentUserId,
}: {
  accounts: AccountRow[];
  orgs: Org[];
  currentUserId: string;
}) {
  const [kind, setKind] = useState<"staff" | "client">("staff");
  const [createState, createFn, creating] = useActionState<ActionResult | null, FormData>(
    createAccountAction,
    null
  );
  const [pwState, pwFn] = useActionState<ActionResult | null, FormData>(setPasswordAction, null);
  const [delState, delFn] = useActionState<ActionResult | null, FormData>(
    deleteAccountAction,
    null
  );

  const rowResult = pwState ?? delState;

  return (
    <div>
      <section className="border border-black/10 dark:border-white/10 bg-white dark:bg-[#111118] mb-8">
        <div className="px-5 py-4 border-b border-black/8 dark:border-white/8">
          <h2 className="font-grotesk text-[14px] font-semibold text-gray-900 dark:text-white">
            Create an account
          </h2>
          <p className="text-[12.5px] text-gray-500 dark:text-gray-400 mt-1 max-w-[80ch] leading-relaxed">
            A purchase creates a client account on its own. This is for the ones that do not
            come through checkout: staff, and any client set up by hand.
          </p>
        </div>

        <form action={createFn} className="px-5 pb-5 pt-4 flex flex-col gap-4 max-w-[640px]">
          <input type="hidden" name="kind" value={kind} />

          {/* Staff and client are different shapes of account, not a role setting:
              one gets a staff_roles row, the other an org membership. */}
          <div className="flex gap-2">
            {(["staff", "client"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                aria-pressed={kind === k}
                className={`px-4 py-2 font-grotesk text-[12.5px] font-semibold border transition-colors cursor-pointer ${
                  kind === k
                    ? "border-[#2B50DC] text-[#2B50DC] dark:border-[#5B8DEF] dark:text-[#5B8DEF]"
                    : "border-black/15 dark:border-white/15 text-gray-500 dark:text-gray-400"
                }`}
              >
                {k === "staff" ? "socialX staff" : "Client"}
              </button>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <F label="Email">
              <input name="email" type="email" required placeholder="name@socialx.studio" className={INPUT} />
            </F>
            <F label="Full name" hint="Optional.">
              <input name="full_name" placeholder="Nathan Cole" className={INPUT} />
            </F>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {kind === "staff" ? (
              <F label="Staff role" hint="Recorded on the account. It does not restrict the admin panel yet.">
                <select name="staff_role" defaultValue="ops" className={INPUT}>
                  {STAFF_ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </F>
            ) : (
              <>
                <F label="Organization" hint="Which client this person belongs to.">
                  <select name="org_id" required defaultValue="" className={INPUT}>
                    <option value="" disabled>Pick an organization</option>
                    {orgs.map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </F>
                <F label="Member role">
                  <select name="member_role" defaultValue="owner" className={INPUT}>
                    {MEMBER_ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </F>
              </>
            )}

            <F label="Password" hint="Leave empty and they sign in by emailed link instead.">
              <input name="password" type="text" autoComplete="off" placeholder="At least 10 characters" className={INPUT} />
            </F>
          </div>

          {createState && (
            <p className={`text-xs ${createState.ok ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
              {createState.ok ? createState.message : createState.error}
            </p>
          )}

          <div>
            <button
              type="submit"
              disabled={creating}
              className="btn btn-primary gradient-bg text-white px-6 py-2.5 font-grotesk font-semibold text-[13px] disabled:opacity-60 cursor-pointer"
            >
              {creating ? "Creating" : "Create account"}
            </button>
          </div>
        </form>
      </section>

      {rowResult && (
        <p className={`mb-4 text-xs ${rowResult.ok ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
          {rowResult.ok ? rowResult.message : rowResult.error}
        </p>
      )}

      <Table head={["Email", "Name", "Access", "Password", "Last sign in", ""]}>
        {accounts.length === 0 ? (
          <EmptyRow cols={6}>Nobody has an account yet.</EmptyRow>
        ) : (
          accounts.map((a) => (
            <Row key={a.userId}>
              <Cell strong>
                {a.email}
                {a.userId === currentUserId && (
                  <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.1em] text-gray-400">you</span>
                )}
              </Cell>
              <Cell>{a.fullName ?? "-"}</Cell>
              <Cell>
                {a.isStaff
                  ? `Staff, ${a.staffRole ?? "no role"}`
                  : a.orgs.length
                    ? a.orgs.map((o) => `${o.name} (${o.role})`).join(", ")
                    : "No access"}
              </Cell>
              <Cell>
                {/* Set or replace in place. There is no reveal, because nothing
                    stores the plaintext to reveal.

                    The placeholder reads "Set / replace" until migration 0017 is
                    applied: before that nothing can tell whether a password
                    exists, and a field that guessed "Set one" at an account that
                    already has one would be worse than saying nothing. */}
                <form action={pwFn} className="flex items-center gap-2">
                  <input type="hidden" name="user_id" value={a.userId} />
                  <input
                    name="password"
                    type="text"
                    autoComplete="off"
                    placeholder={
                      a.hasPassword === null
                        ? "Set / replace"
                        : a.hasPassword
                          ? "Replace"
                          : "Set one"
                    }
                    className="bg-transparent border border-black/15 dark:border-white/15 px-2 py-1 text-[12px] w-[140px] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-hidden focus:border-[#2B50DC]"
                  />
                  <button className="font-mono text-[10px] uppercase tracking-[0.1em] text-gray-500 hover:text-[#2B50DC] cursor-pointer bg-transparent border-0 p-0">
                    Save
                  </button>
                </form>
              </Cell>
              <Cell>{a.lastSignInAt ? a.lastSignInAt.slice(0, 10) : "never"}</Cell>
              <Cell>
                {a.userId !== currentUserId && (
                  <form action={delFn}>
                    <input type="hidden" name="user_id" value={a.userId} />
                    <button className="font-mono text-[10px] uppercase tracking-[0.1em] text-gray-400 hover:text-rose-500 cursor-pointer bg-transparent border-0 p-0">
                      Delete
                    </button>
                  </form>
                )}
              </Cell>
            </Row>
          ))
        )}
      </Table>
    </div>
  );
}

function F({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-grotesk text-[12.5px] font-semibold text-gray-900 dark:text-white">
        {label}
      </span>
      {hint && <span className="text-[11.5px] text-gray-500 -mt-1">{hint}</span>}
      {children}
    </label>
  );
}
