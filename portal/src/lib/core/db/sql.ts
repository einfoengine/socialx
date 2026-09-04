import "server-only";

import type pg from "pg";
import { isTransient, pool } from "./pool";

/**
 * Writing queries, without writing an injection.
 *
 * This replaces `supabase.from("x").select(...)`, and the thing it has to be
 * better at than a naive replacement is safety. PostgREST had one accidental
 * virtue: there was no string concatenation anywhere near a query, so there was
 * nowhere for an injection to live. Handing three hundred call sites a `query()`
 * that takes a string would give all of that back, and the first `where id =
 * '${id}'` would arrive within a week.
 *
 * So the only way to write a query here is a tagged template, and interpolation
 * is not string interpolation: every `${}` becomes a bound parameter. This is
 * safe by construction rather than by discipline.
 *
 *   const rows = await sql<Batch>`
 *     select id, status from batches
 *     where org_id = ${orgId} and status = ${status}
 *     order by due_at
 *   `;
 *
 * The value of `orgId` never touches the SQL text. Postgres receives
 * `where org_id = $1 and status = $2` and the values separately, so there is no
 * parse step for a hostile string to escape from. A caller cannot opt out of
 * this, because there is no overload that accepts a plain string.
 *
 * ---
 *
 * Composition, for the cases a template cannot express on its own.
 *
 * Real queries have optional filters and dynamic ordering, and a tagged template
 * with no way to build a fragment forces those into either a string escape hatch
 * or four near-identical copies of the same query. `fragment` is the escape
 * hatch that stays safe: fragments carry their own parameters and are spliced
 * with their placeholders renumbered, so an assembled query is exactly as
 * parameterised as a literal one.
 *
 * Identifiers are the one thing a parameter cannot be. Postgres will not accept
 * a bound parameter as a column or table name, so `identifier()` exists, it
 * validates against a strict pattern, and it throws rather than escaping
 * anything clever. A dynamic sort column must be checked against a list the
 * application owns before it reaches here.
 */

/** A piece of SQL plus the values its placeholders refer to. */
export type Fragment = {
  readonly __sql: string;
  readonly values: readonly unknown[];
};

const FRAGMENT = Symbol.for("portal.sql.fragment");

type Marked = Fragment & { [FRAGMENT]: true };

function isFragment(value: unknown): value is Marked {
  return typeof value === "object" && value !== null && FRAGMENT in value;
}

function mark(text: string, values: readonly unknown[]): Marked {
  return { __sql: text, values, [FRAGMENT]: true } as Marked;
}

/**
 * Builds text and values from a template, splicing any nested fragments and
 * renumbering their placeholders so the result is one flat parameter list.
 */
function build(
  strings: TemplateStringsArray,
  expressions: readonly unknown[]
): { text: string; values: unknown[] } {
  let text = "";
  const values: unknown[] = [];

  for (let i = 0; i < strings.length; i++) {
    text += strings[i];
    if (i >= expressions.length) continue;

    const expression = expressions[i];

    if (isFragment(expression)) {
      /* Renumber. The fragment was built believing its parameters started at $1;
         here they start wherever this query has got to. */
      const offset = values.length;
      text += expression.__sql.replace(/\$(\d+)/g, (_, n: string) => `$${Number(n) + offset}`);
      values.push(...expression.values);
      continue;
    }

    values.push(expression);
    text += `$${values.length}`;
  }

  return { text, values };
}

/**
 * A reusable piece of a query.
 *
 *   const active = live ? fragment`and status = ${"active"}` : EMPTY;
 *   await sql`select * from sites where true ${active}`;
 */
export function fragment(
  strings: TemplateStringsArray,
  ...expressions: unknown[]
): Fragment {
  const { text, values } = build(strings, expressions);
  return mark(text, values);
}

/** A fragment that contributes nothing. The neutral element for optional clauses. */
export const EMPTY: Fragment = mark("", []);

/**
 * Joins fragments with a separator. For `in` lists and multi-column updates.
 *
 * Returns EMPTY for an empty list rather than producing `()`, which is a syntax
 * error Postgres reports from somewhere unhelpful.
 */
export function join(parts: readonly Fragment[], separator = ", "): Fragment {
  const usable = parts.filter((p) => p.__sql.trim() !== "");
  if (usable.length === 0) return EMPTY;

  let text = "";
  const values: unknown[] = [];
  usable.forEach((part, index) => {
    if (index > 0) text += separator;
    const offset = values.length;
    text += part.__sql.replace(/\$(\d+)/g, (_, n: string) => `$${Number(n) + offset}`);
    values.push(...part.values);
  });

  return mark(text, values);
}

/**
 * A table or column name, for the rare query whose shape is genuinely dynamic.
 *
 * Validated, not escaped. Anything that is not a plain lowercase identifier is
 * refused outright, because the alternative is quoting rules that differ per
 * dialect and a false sense that arbitrary input is now safe. Callers with a
 * user-supplied sort column must map it through their own allowlist first; this
 * is the last line, not the only one.
 */
export function identifier(name: string): Fragment {
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(name)) {
    throw new Error(`Not a usable SQL identifier: ${JSON.stringify(name)}`);
  }
  return mark(name, []);
}

/* ---------------- execution ---------------- */

/**
 * The connection a query runs on.
 *
 * Defaults to the pool, which checks out a connection per query. Inside `tx` it
 * is the transaction's own client, which is what makes a transaction actually
 * hold: two queries on two pooled connections are two transactions no matter
 * what `begin` was issued on.
 */
export type Executor = Pick<pg.Pool, "query"> | Pick<pg.PoolClient, "query">;

let ambient: Executor | null = null;

function executor(): Executor {
  return ambient ?? pool();
}

/**
 * Runs one query, retrying once if the connection died before the server saw it.
 *
 * A pooled connection can be closed under the application by three routine
 * events: a database restart, a pooler recycling backends, and a provider
 * failover. The socket is gone, the query never executed, and a second attempt
 * on a fresh connection succeeds immediately. Without this, every one of those
 * is a 500 for whoever was unlucky.
 *
 * Retried exactly once, and never inside a transaction. Both limits matter. A
 * loop would turn a database that is genuinely down into a request that hangs
 * for as long as the platform allows. And a transaction whose connection dropped
 * has been rolled back by the server, so re-running one statement of it would
 * apply that statement outside the transaction the caller believes they are in,
 * which is worse than the error.
 */
async function run(text: string, values: unknown[]): Promise<pg.QueryResult> {
  const inTransaction = ambient !== null;

  try {
    return await executor().query({ text, values });
  } catch (error) {
    if (inTransaction || !isTransient(error)) throw error;
    return executor().query({ text, values });
  }
}

/** Runs a query and returns every row. */
export async function sql<T = Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...expressions: unknown[]
): Promise<T[]> {
  const { text, values } = build(strings, expressions);
  const result = await run(text, values);
  return result.rows as T[];
}

/**
 * Runs a query expecting at most one row.
 *
 * Returns null for none, and throws for more than one, which is the behaviour
 * worth having: a query written as a single-row lookup that starts matching two
 * rows has a bug, and silently taking the first one hides it for months.
 */
export async function one<T = Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...expressions: unknown[]
): Promise<T | null> {
  const { text, values } = build(strings, expressions);
  const result = await run(text, values);

  if (result.rows.length === 0) return null;
  if (result.rows.length > 1) {
    throw new Error(`Expected at most one row, got ${result.rows.length}.`);
  }
  return result.rows[0] as T;
}

/** Runs a statement and returns how many rows it touched. */
export async function execute(
  strings: TemplateStringsArray,
  ...expressions: unknown[]
): Promise<number> {
  const { text, values } = build(strings, expressions);
  const result = await run(text, values);
  return result.rowCount ?? 0;
}

/**
 * Pins one connection for the duration of `work`, and says whether it was
 * already pinned by a caller further up.
 *
 * The primitive `tx` and `asActor` are both built on, exposed because they need
 * the same three things and must not each invent them: a single connection that
 * every nested query lands on, the knowledge of whether somebody outside already
 * opened a transaction on it, and a release that happens even when the work
 * throws.
 *
 * The connection is pinned through module state rather than threaded as an
 * argument, so a repository function written without any of this in mind runs
 * unchanged inside it. That is the property that makes it realistic to add
 * transactions and actors to code that already exists, which is all of it.
 *
 * The trade is that this assumes one logical thread of execution per pin. Node
 * gives that, because `await` does not interleave two callers into one
 * synchronous frame. What it would not survive is two pins started concurrently
 * with Promise.all, which is why nesting joins rather than opening a second.
 */
export async function runWith<T>(
  work: (client: pg.PoolClient, alreadyPinned: boolean) => Promise<T>
): Promise<T> {
  if (ambient) return work(ambient as pg.PoolClient, true);

  const client = await pool().connect();
  ambient = client;
  try {
    return await work(client, false);
  } finally {
    ambient = null;
    client.release();
  }
}

/**
 * Runs work inside a transaction.
 *
 * Note this does NOT set an actor, so queries inside it are subject to whatever
 * identity the surrounding `asActor` established, and to none at all if there
 * was not one. Use `asActor` or `asSystem` from ./actor for anything touching
 * tenant data; this is for the cases that are genuinely only about atomicity.
 *
 * Nesting joins the outer transaction. Postgres has savepoints, but a nested
 * `tx` in this codebase would almost always be an accident rather than a
 * deliberate partial rollback, and joining is what the caller means.
 */
export async function tx<T>(work: () => Promise<T>): Promise<T> {
  return runWith(async (client, alreadyPinned) => {
    if (alreadyPinned) return work();

    await client.query("begin");
    try {
      const result = await work();
      await client.query("commit");
      return result;
    } catch (error) {
      await client.query("rollback").catch(() => {
        /* The rollback failing means the connection is already broken, in which
           case Postgres has aborted the transaction anyway. Losing the original
           error to report this one would be the worse outcome. */
      });
      throw error;
    }
  });
}
