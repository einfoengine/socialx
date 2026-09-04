import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LogoMark } from "@/components/Logo";
import { hasDatabase, migrationConfig } from "@/lib/core/config";
import { isInstalled } from "@/lib/core/install";
import { pending } from "@/lib/core/db/migrate";
import { rlsWeakness } from "@/lib/core/db/actor";
import { hasOwner } from "@/lib/core/auth/owner";
import { stageOf, type SetupStage } from "@/lib/core/setup";

export const metadata: Metadata = {
  title: "Set up",
  robots: { index: false, follow: false },
};

/* A report on mutable machine state. A cached copy would tell a finished install
   it is unconfigured, or the reverse. */
export const dynamic = "force-dynamic";

/**
 * What to do next, and nothing else.
 *
 * There is no form on this page and no way to change anything from it. The
 * database is configured through the environment, which is where configuration
 * belongs: it survives a restart, it reaches every instance rather than the one
 * that happened to receive a form post, it works on a read-only filesystem, and
 * it is what every secret manager injects.
 *
 * What this page is for is the part documentation is bad at. A README has to
 * describe every state at once; this knows which one you are actually in, so it
 * prints the one command that moves you forward. That is the whole value of it
 * existing rather than redirecting to the README.
 */
export default async function SetupPage() {
  if (await isInstalled()) redirect("/login");

  /* Every one of these has to survive an unreachable or absent database, because
     "unreachable" is precisely the state this page exists to explain. */
  const configured = hasDatabase();

  let pendingCount: number | null = null;
  let owner = false;
  let weakness: string | null = null;

  if (configured) {
    const config = migrationConfig()!;
    try {
      pendingCount = await pending(config, process.cwd());
    } catch {
      pendingCount = null;
    }
    if (pendingCount === 0) {
      try {
        owner = await hasOwner();
      } catch {
        owner = false;
      }
      try {
        weakness = await rlsWeakness();
      } catch {
        weakness = null;
      }
    }
  }

  const stage = stageOf({ pendingMigrations: pendingCount, hasOwner: owner });

  return (
    <main className="min-h-screen bg-[#F4F2EF] dark:bg-[#050508] px-6 py-16">
      <div className="max-w-[640px] mx-auto">
        <div className="mb-8">
          <LogoMark className="h-7" />
        </div>

        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#2B50DC] dark:text-[#5B8DEF] mb-3">
          Not set up yet
        </div>

        <Steps stage={stage} />

        {stage === "database" && <DatabaseStep />}
        {stage === "schema" && <SchemaStep unreachable={pendingCount === null} count={pendingCount} />}
        {stage === "owner" && <OwnerStep />}

        {weakness && <Weakness reason={weakness} />}
      </div>
    </main>
  );
}

/* ---------------- steps ---------------- */

function Steps({ stage }: { stage: SetupStage }) {
  const order: SetupStage[] = ["database", "schema", "owner"];
  const labels = {
    database: "Connect a database",
    schema: "Apply the schema",
    owner: "Create the administrator",
    done: "",
  };
  const at = order.indexOf(stage);

  return (
    <ol className="mb-10 space-y-1.5">
      {order.map((s, i) => (
        <li
          key={s}
          className={`font-mono text-[11.5px] ${
            i < at
              ? "text-emerald-700 dark:text-emerald-400"
              : i === at
                ? "text-gray-900 dark:text-white font-semibold"
                : "text-gray-400 dark:text-gray-600"
          }`}
        >
          {i < at ? "done  " : i === at ? "now   " : "next  "}
          {labels[s]}
        </li>
      ))}
    </ol>
  );
}

function DatabaseStep() {
  return (
    <Section
      title="Point it at a database"
      body="Any PostgreSQL 13 or later. Supabase, DigitalOcean, RDS, Neon, or one running on this machine. All of them are a connection string, and there is nothing else to choose."
    >
      <Code>{`# portal/.env.local

# What the app serves on. portal_app: no DDL, no RLS exemption.
DATABASE_URL=postgres://portal_app:password@host:5432/portal

# What migrations run on. An owner role. Falls back to the one above.
MIGRATION_DATABASE_URL=postgres://owner:password@host:5432/portal

DATABASE_SSL=verify`}</Code>

      <Note>
        Copy <Mono>.env.example</Mono> to <Mono>.env.local</Mono> if you have not
        already, then restart the server. Next reads environment files at startup,
        so a running process will not pick this up on its own.
      </Note>

      <Note>
        Two connections, because the application and the migrations want opposite
        things. Migrations create tables. The application must never be a superuser
        or a table owner, because Postgres exempts both from every row level
        security policy without saying so.
      </Note>

      <Note>
        On a brand new database <Mono>portal_app</Mono> does not exist yet: it is
        created by the migrations. Point both lines at an owner connection,
        migrate, give the role a password, then narrow <Mono>DATABASE_URL</Mono>.
      </Note>
    </Section>
  );
}

function SchemaStep({ unreachable, count }: { unreachable: boolean; count: number | null }) {
  if (unreachable) {
    return (
      <Section
        title="The database could not be reached"
        body="DATABASE_URL is set, but connecting to it failed. The usual causes are a firewall or IP allowlist, the wrong port, or a TLS mode the server will not accept."
      >
        <Code>{`# Check it from the same machine the portal runs on:
psql "$DATABASE_URL" -c "select version()"`}</Code>
        <Note>
          If that reports a certificate it cannot verify, put the provider&apos;s CA
          bundle in <Mono>DATABASE_CA_CERT</Mono>. That keeps the connection both
          encrypted and authenticated. <Mono>DATABASE_SSL=no-verify</Mono> also
          works and is a downgrade: it encrypts, then trusts whoever answered.
        </Note>
      </Section>
    );
  }

  return (
    <Section
      title={`Apply the schema (${count} migration${count === 1 ? "" : "s"} pending)`}
      body="The connection works. The tables are not there yet. Migrations are plain SQL applied in filename order and recorded in schema_migrations, so this is safe to re-run."
    >
      <Code>{`cd portal
pnpm db:migrate`}</Code>
      <Note>
        This runs on <Mono>MIGRATION_DATABASE_URL</Mono> when set, falling back to{" "}
        <Mono>DATABASE_URL</Mono>. It needs a role that can create tables, which{" "}
        <Mono>portal_app</Mono> deliberately cannot.
      </Note>
    </Section>
  );
}

function OwnerStep() {
  return (
    <Section
      title="Restart to create the administrator"
      body="The schema is applied and nobody can sign in yet. The server creates the administrator account on startup when one is missing, and prints the password to its own console."
    >
      <Code>{`# stop the server, then
pnpm dev`}</Code>
      <Note>
        Look for the block that prints <Mono>Username admin</Mono> and a password.
        It is shown once, it is not stored anywhere you can read it back, and you
        will be asked to change it the first time you sign in.
      </Note>
    </Section>
  );
}

function Weakness({ reason }: { reason: string }) {
  return (
    <div className="mt-8 border border-amber-500/40 bg-white dark:bg-[#111118] p-5">
      <div className="font-grotesk text-sm font-semibold text-amber-900 dark:text-amber-200 mb-2">
        This connection is not safe to serve on
      </div>
      <p className="text-xs text-amber-900/90 dark:text-amber-200/90 leading-relaxed mb-3">
        {reason}
      </p>
      <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed mb-3">
        Postgres exempts superusers and table owners from every row level security
        policy and reports nothing when it does. The portal would run perfectly and
        every client would be able to read every other client&apos;s data.
      </p>
      <Code>{`alter role portal_app with login password 'choose-one';`}</Code>
      <Note>
        Then point <Mono>DATABASE_URL</Mono> at <Mono>portal_app</Mono> and restart.
        Keep the owner connection for running migrations only.
      </Note>
    </div>
  );
}

/* ---------------- presentation ---------------- */

function Section({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h1 className="font-grotesk text-xl font-semibold text-gray-900 dark:text-white mb-3">
        {title}
      </h1>
      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-5">{body}</p>
      {children}
    </div>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="border border-black/10 dark:border-white/10 bg-white dark:bg-[#111118] p-4 font-mono text-[11.5px] text-gray-700 dark:text-gray-300 leading-relaxed overflow-x-auto">
      {children}
    </pre>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs text-gray-500 dark:text-gray-500 mt-4 leading-relaxed">{children}</p>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-gray-700 dark:text-gray-300">{children}</span>;
}
