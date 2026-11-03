import { it } from "vitest";
import { readFileSync } from "node:fs";
import { parseEventPage } from "../../../supabase/functions/_shared/eventSources";
it("probe", () => {
  const html = readFileSync(process.env.TEMP + "/cougar.html", "utf8");
  const ev = parseEventPage(html, new Date("2026-11-03T12:00:00Z"), "America/New_York", "https://x.test/p");
  console.log(ev.length);
  for (const e of ev) console.log(JSON.stringify({ k: e.key, t: e.title, s: e.startsAt, e: e.endsAt, ad: e.allDay, p: e.place, c: e.canceled, d: e.description.slice(0, 90) }));
  console.log("LAST:", ev[ev.length - 1]?.description);
});
