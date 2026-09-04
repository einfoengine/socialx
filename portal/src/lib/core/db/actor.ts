import "server-only";

import type pg from "pg";
import { pool } from "./pool";
import { runWith } from "./sql";

/**
 * Who a piece of work is being done by, and how the database is told.
 *
 * This is the application half of migration 0031. That migration made row level
 * security read `portal.actor` instead of Supabase's `auth.uid()`; this is what
 * sets it. Between the two, every policy written in 0008 keeps working over a
 * direct Postgres connection, on any Postgres, with no authorization logic moved
 * into application code.
 *
 * The rule this module exists to enforce has one sentence: **the actor is set
 * transaction-locally, or it is not set at all.**
 *
 * Why that is not a style preference. Connections are pooled and handed back and
 * forth between concurrent requests. `set_config('portal.actor', x, false)`
 * writes for the life of the *connection*, so it outlives the request that set
 * it, and the next request to check that connection out inherits the previous
 * user's identity. Under load that is not a rare race; it is the normal case.
 * The third argument below is `true`, meaning transaction-local, and Postgres
 * discards it at commit or rollback whatever the application does next.
 *
 * That is also why every actor-bound query runs inside a transaction. It is not
 * about atomicity for a single select. It is that a transaction is the only
 * scope Postgres offers that reliably ends.
 *
 * ---
 *
 * What happens when somebody forgets.
 *
 * `current_actor()` returns null, every client policy compares against a null
 * user, nothing matches, and the query returns no rows. An unwrapped query
 * produces an empty screen, not another tenant's data. That asymmetry is chosen:
 * of the two ways to be wrong, this is the one that gets reported as a bug
 * within the hour instead of discovered in an audit.
 */

export type Actor =
  /**
   * A signed-in person. The only thing the database is told is who they are;
   * whether that makes them staff, or a member of some organization, is read
   * from the tables by the policies themselves, live, on every query. Nothing
   * about their rights is carried in from the application and trusted.
   */
  | { kind: "user"; userId: string }
  /**
   * Nobody. Public reads through the API, and the setup flow before an account
   * exists. Explicit rather than implied by absence, so a route that meant to
   * pass a user and passed nothing is distinguishable from one that meant this.
   */
  | { kind: "anonymous" }
  /**
   * Work with no user behind it: webhook handlers, provisioning after a payment,
   * the scheduled drain. Bypasses client policies, so it carries a written
   * reason and every use of it is meant to be greppable and reviewable.
   *
   * This replaces the service role key, and it is narrower in the way that
   * matters: the key was a credential that bypassed everything for as long as it
   * existed, and this is a flag that lasts one transaction.
   */
  | { kind: "system"; reason: string };

export const ANONYMOUS: Actor = { kind: "anonymous" };

/** A signed-in person. */
export function asUser(userId: string): Actor {
  return { kind: "user", userId };
}

/** Deliberate unscoped work. The reason is required and is not decoration. */
export function asSystemActor(reason: string): Actor {
  if (!reason.trim()) {
    throw new Error("System work needs a written reason. Say what this is doing.");
  }
  return { kind: "system", reason };
}

/**
 * Runs work as the given actor, inside a transaction, with the database told who
 * is asking.
 *
 * Nesting joins the outer transaction rather than opening a second one, and
 * deliberately does NOT re-set the actor: a request that resolved its user once
 * should not have its identity quietly changed halfway through by a helper
 * three calls down. Changing actor mid-request is a thing that should require
 * finishing one transaction and starting another, which is what it now does.
 */
export async function asActor<T>(actor: Actor, work: () => Promise<T>): Promise<T> {
  return runWith(async (client, alreadyInTransaction) => {
    if (alreadyInTransaction) return work();

    await client.query("begin");
    try {
      await applyActor(client, actor);
      const result = await work();
      await client.query("commit");
      return result;
    } catch (error) {
      await client.query("rollback").catch(() => {
        /* A failed rollback means the connection is already gone, in which case
           Postgres has aborted the transaction for us. Reporting it here would
           replace the real error with a less useful one. */
      });
      throw error;
    }
  });
}

/**
 * Sets the session variables the policies read.
 *
 * Parameterised, not interpolated. The user id reaching this function has come
 * from a verified session rather than from a request body, but `set_config` with
 * a concatenated value would be an injection point regardless of how trustworthy
 * today's callers are, and the parameterised form costs nothing.
 *
 * Both variables are written on every actor, including the ones that do not use
 * them. Writing `portal.system` as 'off' rather than leaving it unset is what
 * makes a stale value from an earlier transaction on this connection impossible
 * even if `is_local` were ever wrong.
 */
async function applyActor(client: pg.PoolClient, actor: Actor): Promise<void> {
  const userId = actor.kind === "user" ? actor.userId : null;
  const system = actor.kind === "system" ? "on" : "off";

  await client.query({
    text: "select set_config('portal.actor', $1, true), set_config('portal.system', $2, true)",
    /* Empty string rather than null: set_config takes text, and current_actor()
       treats '' as absent through nullif. */
    values: [userId ?? "", system],
  });
}

/**
 * The escape hatch, named at the call site.
 *
 *   await asSystem("stripe webhook: provision the new organization", async () => {
 *     ...
 *   });
 *
 * Shaped so the reason is the first thing read, because the point of it is to be
 * legible in a diff. A reviewer scanning for `asSystem(` sees what each one
 * claims to be doing without opening the function.
 */
export async function asSystem<T>(reason: string, work: () => Promise<T>): Promise<T> {
  return asActor(asSystemActor(reason), work);
}

/**
 * Confirms the deployment is actually protected by the policies it has.
 *
 * Worth running at boot and from the setup screen, because the failure this
 * detects is completely silent. Postgres exempts superusers and table owners
 * from RLS with no error and no log line: the application works perfectly, every
 * screen renders, and every tenant can read every other tenant.
 *
 * Returns the reason it is unsafe, or null when the connection is properly
 * constrained. Not a throw, because the setup screen needs to show this as a
 * warning next to the connection string rather than crash on it.
 */
export async function rlsWeakness(): Promise<string | null> {
  const client = await pool().connect();
  try {
    const { rows } = await client.query(
      `select current_user as role,
              (select rolsuper from pg_roles where rolname = current_user) as is_super,
              (select rolbypassrls from pg_roles where rolname = current_user) as bypasses`
    );
    const row = rows[0] as { role: string; is_super: boolean; bypasses: boolean };

    if (row.is_super) {
      return `Connected as "${row.role}", which is a superuser. Postgres exempts superusers from every row level security policy, so tenant isolation is not being enforced. Connect as portal_app instead.`;
    }
    if (row.bypasses) {
      return `Connected as "${row.role}", which has BYPASSRLS. Policies are not being applied. Connect as portal_app instead.`;
    }

    /* Ownership is the quiet one. A role that owns a table is exempt from that
       table's policies even without superuser or BYPASSRLS, unless the table has
       FORCE ROW LEVEL SECURITY set. */
    const { rows: owned } = await client.query(
      `select c.relname
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relkind = 'r'
          and c.relrowsecurity
          and not c.relforcerowsecurity
          and pg_get_userbyid(c.relowner) = current_user
        limit 5`
    );
    if (owned.length > 0) {
      const names = owned.map((r: { relname: string }) => r.relname).join(", ");
      return `Connected as "${row.role}", which owns tables it must not be exempt from (${names}). Either connect as portal_app, or set FORCE ROW LEVEL SECURITY on those tables.`;
    }

    return null;
  } finally {
    client.release();
  }
}
