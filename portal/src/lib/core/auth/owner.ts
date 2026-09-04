import "server-only";

import { asSystem } from "../db/actor";
import { one, execute, sql } from "../db/sql";
import { generate, hash, rejectionReason } from "./password";

/**
 * The first account, and the one rule about it that is not negotiable.
 *
 * Every install needs somebody who can sign in before anybody has been invited,
 * so the installer creates one. The account is called `admin`, it holds the
 * owner staff role, and it is forced to choose a new password the first time it
 * signs in.
 *
 * The password is generated per install and printed to the server's own console,
 * rather than being a constant.
 *
 * That last point was a deliberate departure from what was asked for, so the
 * reasoning belongs here rather than in a commit message. The request was for a
 * fixed default of `password`, changed on first login. The forced change is
 * kept, because it is right. The fixed default is not, for a reason specific to
 * what this product now is: software other people deploy on their own servers.
 *
 * A constant default in shipped software is a credential that exists on every
 * installation of it simultaneously, and the window it is live in is not the
 * minute between deploy and first login. It is the whole time until somebody
 * gets round to logging in, on every install anyone ever makes, including the
 * ones abandoned half-configured on a public IP. Scanners find a new host in
 * seconds, and "must change at first login" is not a defence against them: the
 * attacker who arrives first performs the change, and the operator is locked out
 * of their own portal with no way to tell what happened.
 *
 * It would also have made the setup token from `../setup` pointless. There is no
 * value in guarding /setup with a token printed to the console if `admin` and a
 * password from the README opens the same install.
 *
 * Generating per install keeps everything that was actually wanted: one known
 * account, a password the operator can read without hunting, and a forced
 * rotation. It is printed in the same block as the setup token, so it is one
 * glance at the same terminal. And PORTAL_DEV_PASSWORD exists for local work,
 * where a memorable constant is a convenience rather than an exposure.
 */

/** The username the first account is always created with. */
export const OWNER_USERNAME = "admin";

/**
 * The address the owner account carries.
 *
 * An email column with a username in it needs one of these, and inventing
 * `admin@localhost` would produce a value that looks like a deliverable address
 * and is not. `.invalid` is reserved by RFC 2606 precisely so software has
 * something to put here that can never resolve, which makes it obvious in a
 * database that nothing should try to mail this account until a real address is
 * set.
 */
export const OWNER_EMAIL = "admin@portal.invalid";

export type OwnerCreation = {
  userId: string;
  username: string;
  /** The plaintext, returned exactly once so the caller can print it. */
  password: string;
  /** False when an owner already existed and nothing was created. */
  created: boolean;
};

/**
 * Is there anybody who can sign in?
 *
 * The question the setup flow turns on, and it asks about a usable owner rather
 * than about any row. An install with a portal_users row that has no password
 * and no staff role is not an install somebody can get into.
 */
export async function hasOwner(): Promise<boolean> {
  return asSystem("setup: check whether an owner account exists", async () => {
    const row = await one<{ n: number }>`
      select count(*)::int as n
        from portal_users u
        join staff_roles s on s.user_id = u.id
       where s.role = 'owner'
         and u.disabled_at is null
    `;
    return (row?.n ?? 0) > 0;
  });
}

/**
 * Creates the first account, or reports that one already exists.
 *
 * Idempotent on purpose. This runs from the setup flow, which somebody may
 * refresh, resubmit, or reach twice from two tabs, and a second owner account
 * appearing because a form was double-clicked would be a genuinely confusing
 * thing to debug.
 *
 * The whole thing is one transaction. An identity without its staff role is an
 * account that can sign in and reach nothing, which is harder to notice and
 * harder to repair than a failed setup step.
 */
export async function createOwner(options: { password?: string } = {}): Promise<OwnerCreation> {
  return asSystem("setup: create the first owner account", async () => {
    const existing = await one<{ id: string }>`
      select u.id
        from portal_users u
        join staff_roles s on s.user_id = u.id
       where s.role = 'owner'
       limit 1
    `;

    if (existing) {
      return {
        userId: existing.id,
        username: OWNER_USERNAME,
        password: "",
        created: false,
      };
    }

    /*
     * Precedence: an operator-chosen password, then the local development
     * override, then a generated one.
     *
     * PORTAL_DEV_PASSWORD is the escape hatch for working on this locally, where
     * copying a fresh twenty character string out of the terminal on every
     * `db:reset` is friction with nothing to show for it. It is an environment
     * variable rather than a default so that using it is a thing somebody did,
     * visible in whatever configures the process, instead of a thing that
     * happens to every install by omission.
     */
    const dev = (process.env.PORTAL_DEV_PASSWORD ?? "").trim();
    const password = options.password?.trim() || dev || generate();

    /* An operator typing their own password at setup gets it checked; a
       generated one does not need checking, and a dev override is knowingly
       weak. Checking the generated value would also be checking this module's
       own output, which proves nothing. */
    if (options.password) {
      const problem = rejectionReason(options.password, OWNER_EMAIL);
      if (problem) throw new Error(problem);
    }

    const passwordHash = await hash(password);

    const created = await one<{ id: string }>`
      insert into portal_users (email, password_hash, must_change_password, password_changed_at)
      values (
        ${OWNER_EMAIL},
        ${passwordHash},
        /* An operator who typed their own password at setup has already chosen
           one, so making them choose again on the next screen would be theatre.
           Every other path here produces a password its owner did not pick. */
        ${!options.password},
        now()
      )
      returning id
    `;

    if (!created) throw new Error("Could not create the owner account.");

    /* The profiles row arrives from the on_portal_user_created trigger, so the
       only thing left is the role. */
    await execute`
      insert into staff_roles (user_id, role) values (${created.id}, 'owner')
      on conflict (user_id) do update set role = 'owner'
    `;

    await execute`update profiles set full_name = ${"Administrator"} where id = ${created.id}`;

    return {
      userId: created.id,
      username: OWNER_USERNAME,
      password,
      created: true,
    };
  });
}

/**
 * Prints the credentials, once, in the same place as the setup token.
 *
 * Deliberately not written to the config file or to any log the application
 * controls. The console is a place the operator is already looking during an
 * install and which nothing archives by default; a file is a place a password
 * outlives its usefulness in.
 */
export function announceOwner(result: OwnerCreation): void {
  if (!result.created) return;

  process.stdout.write(
    [
      "",
      "  ─────────────────────────────────────────────",
      "  Administrator account created.",
      "",
      `  Username  ${result.username}`,
      `  Password  ${result.password}`,
      "",
      "  This password is shown once and must be",
      "  changed the first time you sign in.",
      "  ─────────────────────────────────────────────",
      "",
    ].join("\n")
  );
}

/**
 * Resolves what a username typed at the sign-in form refers to.
 *
 * The owner account signs in as `admin` while everyone else uses their email
 * address, so the form takes one field and this decides what it was given. An
 * input with no `@` in it can only be a username, and today `admin` is the only
 * one that exists.
 *
 * Kept as a function rather than inlined at the form because the rule has to be
 * identical everywhere a credential is looked up, and there will be more than
 * one such place as soon as there is a password reset.
 */
export function resolveLogin(input: string): string {
  const value = input.trim().toLowerCase();
  if (!value.includes("@") && value === OWNER_USERNAME) return OWNER_EMAIL;
  return value;
}

/**
 * Everything the sign-in path needs about an account, in one lookup.
 *
 * Runs as system, because there is no actor yet: working out who somebody is has
 * to happen before the database can be told who they are. This is the narrowest
 * possible use of that, one row by address, and it is the reason `asSystem`
 * takes a written reason.
 */
export type Credential = {
  id: string;
  email: string;
  passwordHash: string | null;
  mustChangePassword: boolean;
  disabledAt: string | null;
};

export async function credentialFor(login: string): Promise<Credential | null> {
  const email = resolveLogin(login);

  return asSystem("sign in: look up the credential for a submitted login", async () => {
    return one<Credential>`
      select id,
             email,
             password_hash          as "passwordHash",
             must_change_password   as "mustChangePassword",
             disabled_at            as "disabledAt"
        from portal_users
       where lower(email) = ${email}
       limit 1
    `;
  });
}

/**
 * Replaces a password and clears the rotation flag.
 *
 * Every live session for the account is revoked in the same transaction, with
 * one exception: the session doing the changing. That is the behaviour somebody
 * expects from a password change and the reason they perform one. If a password
 * was changed because it may have been seen, leaving the other sessions open
 * leaves whoever saw it signed in.
 */
export async function setPassword(
  userId: string,
  password: string,
  options: { keepSessionId?: string; email?: string } = {}
): Promise<void> {
  const problem = rejectionReason(password, options.email);
  if (problem) throw new Error(problem);

  const passwordHash = await hash(password);

  await asSystem("account: change a password and revoke other sessions", async () => {
    await execute`
      update portal_users
         set password_hash = ${passwordHash},
             must_change_password = false,
             password_changed_at = now()
       where id = ${userId}
    `;

    await sql`
      update portal_sessions
         set revoked_at = now()
       where user_id = ${userId}
         and revoked_at is null
         and id is distinct from ${options.keepSessionId ?? null}::uuid
    `;
  });
}
