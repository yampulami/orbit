// Builds the structure of a DEV database from the migration files, oldest first: tables, security rules, functions. No real data is copied.
//
//   node web/scripts/build-dev-database.mjs <dev-project-ref> [--coordinator you@school.edu]
//
// The project ref is the short code in the dev project's address (supabase.com/dashboard/project/<ref>). You must be logged in to the Supabase CLI
// (npx supabase login) as someone who can reach that project. The live project is refused on purpose, so this can never be pointed at real students' data.
// --coordinator makes that account (sign up in the dev app first) a coordinator on its campus, so clubs and events can be reviewed while testing.
import { readdirSync, writeFileSync, mkdtempSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const LIVE_REF = "ywhoyolsbgjqgkfziyin";
const here = dirname(fileURLToPath(import.meta.url));
const migrations = join(here, "..", "..", "supabase", "migrations");

const args = process.argv.slice(2);
const ref = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--coordinator");
const coordinator = args.includes("--coordinator") ? args[args.indexOf("--coordinator") + 1] : null;

if (!ref || !/^[a-z0-9]{15,25}$/.test(ref)) { console.error("Give the dev project's ref, for example: node web/scripts/build-dev-database.mjs abcdefghijklmnopqrst"); process.exit(1); }
if (ref === LIVE_REF) { console.error("That is the LIVE project. This script only builds a dev database, so it will not touch it."); process.exit(1); }
if (coordinator && !/^[^\s@'";]+@[^\s@'";]+\.[a-z]{2,}$/i.test(coordinator)) { console.error("That does not look like an email address for --coordinator."); process.exit(1); }

const run = (file) => spawnSync("npx", ["--yes", "supabase", "db", "query", `--remote=${ref}`, "--yes", "-f", file], { encoding: "utf8", shell: true });

const files = readdirSync(migrations).filter((f) => f.endsWith(".sql")).sort();
console.log(`Building the dev database ${ref} from ${files.length} migrations...\n`);
for (const [i, f] of files.entries()) {
  const r = run(join(migrations, f));
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  if (r.status !== 0 || /"error"|ERROR:|HostedMutation|Cannot find project|not logged in/i.test(out)) {
    console.error(`FAILED at ${f} (${i + 1} of ${files.length}). Nothing after it was run.\n`);
    console.error(out.split("\n").filter((l) => l.trim() && !/^Target:|^Confirmed/.test(l)).slice(0, 12).join("\n"));
    console.error("\nFix the cause (often: not logged in, a typo in the ref, or the project is still starting) and run the same command again. Files already run are safe to run twice.");
    process.exit(1);
  }
  console.log(`  ok  ${i + 1}/${files.length}  ${f}`);
}

if (coordinator) {
  const dir = mkdtempSync(join(tmpdir(), "orbit-dev-"));
  const sql = join(dir, "coordinator.sql");
  writeFileSync(sql, `insert into public.campus_hosts (user_id, campus_key, label, role, source)
select u.id, m.campus_key, 'Dev coordinator', 'coordinator', 'manual'
from auth.users u join public.campus_memberships m on m.user_id = u.id
where lower(u.email) = lower('${coordinator}')
on conflict (user_id) do update set role = 'coordinator';
select count(*) as made from public.campus_hosts where role = 'coordinator';`);
  const r = run(sql);
  console.log(/"made": 0|made.: 0/.test(r.stdout ?? "") ? `\nNo coordinator made: ${coordinator} has not signed up and chosen a campus in the dev app yet. Do that, then run this again with the same --coordinator.` : `\nMade ${coordinator} a coordinator.`);
}
console.log("\nDone. Next: set the dev project's sign-in settings (email on, Anonymous sign-ins on, Confirm email off) as TEAM-WORKFLOW.md says.");
