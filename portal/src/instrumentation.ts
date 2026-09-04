/**
 * Runs once, when the server starts.
 *
 * This is where the install finishes itself. With no setup form, the two things
 * a form was doing that the environment cannot do have to happen somewhere, and
 * startup is the honest place for them: it is after the configuration is
 * readable, it is a moment the operator is already watching, and its output goes
 * to the terminal rather than to a browser.
 *
 * It creates the administrator account when the schema is applied and nobody can
 * sign in yet, and prints the credentials. It does NOT apply migrations, which
 * is the one thing here that looks like it belongs and does not. Auto-migrating
 * on boot means a deploy silently changes the schema, and two instances starting
 * together race each other through the same DDL. Migrations stay a command
 * somebody runs.
 *
 * Nothing here is allowed to prevent the server starting. An unreachable
 * database at boot is an outage to be reported, not a reason to refuse to serve
 * the page that explains it.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    await announce();
  } catch {
    /* Startup diagnostics are not worth a failed boot. */
  }
}

async function announce(): Promise<void> {
  const { hasDatabase, migrationConfig } = await import("@/lib/core/config");
  const { isInstalled } = await import("@/lib/core/install");
  const port = process.env.PORT ?? "3001";
  const url = `http://localhost:${port}`;

  if (await isInstalled()) return;

  if (!hasDatabase()) {
    return say([
      "This portal has no database configured.",
      "",
      `  Open  ${url}/setup  for the steps,`,
      "  or set DATABASE_URL in portal/.env.local and restart.",
    ]);
  }

  const config = migrationConfig()!;

  const { pending } = await import("@/lib/core/db/migrate");
  let outstanding: number;
  try {
    outstanding = await pending(config, process.cwd());
  } catch (error) {
    return say([
      "The database could not be reached.",
      "",
      `  ${error instanceof Error ? error.message : String(error)}`,
      "",
      `  Open  ${url}/setup  for what to check.`,
    ]);
  }

  if (outstanding > 0) {
    return say([
      `The database is missing ${outstanding} migration${outstanding === 1 ? "" : "s"}.`,
      "",
      "  Run  pnpm db:migrate  with a connection that can create tables,",
      "  then start the server again.",
    ]);
  }

  /*
   * Schema is current. Create the administrator if there is not one.
   *
   * createOwner is idempotent, so a restart on a healthy install does nothing
   * and prints nothing. That matters more than it sounds: a startup banner that
   * appears every time is a banner nobody reads, and this one carries a password.
   */
  const { createOwner, announceOwner, hasOwner } = await import("@/lib/core/auth/owner");

  /* Nothing to record. Whether the install is finished is a question the
     database answers, so creating the account IS finishing the install. */
  if (await hasOwner()) return;

  const result = await createOwner();
  announceOwner(result);

  /* Warn, after the credentials, if the connection is one that disables tenant
     isolation. Placed last so it is the thing left on screen. */
  const { rlsWeakness } = await import("@/lib/core/db/actor");
  const weakness = await rlsWeakness().catch(() => null);
  if (weakness) {
    say(["Warning: this connection is not safe to serve on.", "", `  ${weakness}`]);
  }
}

function say(lines: string[]): void {
  process.stdout.write(
    ["", "  ─────────────────────────────────────────────", ...lines.map((l) => (l ? `  ${l}` : "")), "  ─────────────────────────────────────────────", "", ""].join("\n")
  );
}
