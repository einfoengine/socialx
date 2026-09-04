#!/usr/bin/env node
/**
 * Fails if the portal reads a site's data without saying which site.
 *
 * Migration 0027 put site_id on every table holding tenant data, and
 * lib/dal/scoped.ts is where that column is meant to be used. Neither of those
 * stops somebody writing `.from("batches").select(...)` with no filter, and that
 * query does not fail, does not warn, and returns every customer's rows in one
 * list. It looks correct until the day there are two sites.
 *
 * So this is the check that a person cannot forget to run mentally. It is not a
 * type system and it is not a parser: it reads the source, finds every access to
 * a site-scoped table, and asks whether the same statement narrows it.
 *
 * A cross-site query is legitimate and is not banned. The Sites screen counts
 * rows across every site on purpose, and authentication looks a key up by prefix
 * before it knows which site it belongs to. Both are correct. What this insists
 * on is that they say so:
 *
 *     // cross-site: the registry screen counts every site's keys.
 *     supabase.from("api_keys").select("site_id, revoked_at")
 *
 * The marker is the whole value. It turns "did anyone think about this" from an
 * unanswerable question into a grep.
 *
 *   node scripts/check-site-scoping.mjs
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/* Resolved from this file rather than the working directory, so the check runs
   the same from the project root and from anywhere else. */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCANNED = ["app", "lib", "components"];

/* The table list is read out of scoped.ts rather than repeated here. Two copies
   of it would disagree the first time somebody adds a table, and the copy that
   disagreed would be the one that silently stopped checking. */
const scopedSource = readFileSync(join(ROOT, "lib/dal/scoped.ts"), "utf8");
const block = scopedSource.match(/SITE_SCOPED_TABLES = \[(.*?)\] as const;/s);
if (!block) {
  console.error("Could not read SITE_SCOPED_TABLES from lib/dal/scoped.ts.");
  process.exit(1);
}
const TABLES = [...block[1].matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);

/* How far past `.from("x")` to look for the filter that narrows it. Supabase
   chains are written one call per line and the long ones in this repo run to
   about a dozen; twenty is comfortably clear of the longest without running into
   the next statement. */
const WINDOW = 20;

/* How far back to look for a marker. Enough for a short explanation above the
   call, not so far that an unrelated comment excuses a query. */
const LOOKBACK = 4;

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry.startsWith(".")) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* walk(path);
    else if (/\.tsx?$/.test(path)) yield path;
  }
}

const problems = [];
let accesses = 0;
let declared = 0;

for (const base of SCANNED) {
  for (const file of walk(join(ROOT, base))) {
    /* scoped.ts names every table in order to define the list. Checking the
       definition against itself would report all sixteen. */
    if (file.endsWith("lib/dal/scoped.ts")) continue;

    const lines = readFileSync(file, "utf8").split("\n");

    lines.forEach((line, i) => {
      const match = line.match(/\.from\(\s*["']([a-z_]+)["']\s*\)/);
      if (!match || !TABLES.includes(match[1])) return;

      accesses++;

      const before = lines.slice(Math.max(0, i - LOOKBACK), i).join("\n");
      if (/cross-site:/.test(before) || /cross-site:/.test(line)) {
        declared++;
        return;
      }

      /* The statement, as far as its terminating semicolon or the window,
         whichever comes first. A filter belonging to the next statement should
         not excuse this one. */
      const rest = lines.slice(i, i + WINDOW);
      const end = rest.findIndex((l, n) => n > 0 && /;\s*$/.test(l));
      const statement = rest.slice(0, end === -1 ? WINDOW : end + 1).join("\n");

      /* An insert needs no filter. site_id is derived by the trigger in
         migration 0027, and a value supplied here would be overwritten anyway. */
      if (/\.(insert|upsert)\(/.test(statement)) return;

      /* Narrowed explicitly to a site. The optional prefix accepts the embedded
         form PostgREST uses when the column belongs to a joined resource, as in
         .eq("organizations.site_id", id) on a query that reaches sites through
         the buying organization. */
      if (/\.eq\(\s*["'][a-z_]*\.?site_id["']/.test(statement)) return;
      /* The wrapper sits upstream of the .from() it narrows, so it is looked for
         across the preceding lines as well as the statement. Unlike the eq()
         below, a wrapper opening above cannot belong to a different statement:
         the .from() is inside its argument list. */
      const around = `${before}\n${statement}`;
      if (/onlySite\(/.test(around)) return;
      if (/applySiteFilter\(/.test(around)) return;
      if (/\.is\(\s*["']site_id["']\s*,\s*null\s*\)/.test(statement)) return;

      /*
       * Narrowed to a record, or to one organization.
       *
       * `.eq("id", batchId)` and `.eq("org_id", orgId)` cannot return two
       * customers' rows in one list, so they are not what this check is for. The
       * risk being hunted is the query with no equality filter at all: the one
       * that lists a table and, the day there are two sites, lists both.
       *
       * Only id-shaped columns count. `.eq("key", ...)` deliberately does not,
       * because a content key stopped being unique in 0026 and is now unique per
       * site, which makes it exactly the kind of filter that looks narrowing and
       * is not.
       */
      if (/\.(eq|in)\(\s*["'](id|[a-z_]+_id)["']/.test(statement)) return;

      problems.push({
        file: relative(ROOT, file),
        line: i + 1,
        table: match[1],
        text: line.trim().slice(0, 100),
      });
    });
  }
}

console.log(
  `Checked ${accesses} access${accesses === 1 ? "" : "es"} to ${TABLES.length} site-scoped tables.`
);
console.log(`  ${declared} declared cross-site, ${accesses - declared - problems.length} narrowed.`);

if (problems.length === 0) {
  console.log("\nEvery query says which site it is for.");
  process.exit(0);
}

console.log(`\n${problems.length} listing every site:\n`);
for (const p of problems) {
  console.log(`  ${p.file}:${p.line}  ${p.table}`);
  console.log(`    ${p.text}`);
}
console.log(
  `\nAdd .eq("site_id", ...), read through siteTable(), or mark it with a` +
    `\n"cross-site:" comment saying why it spans every site.`
);
process.exit(1);
