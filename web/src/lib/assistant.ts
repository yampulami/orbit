import { clockLabel, DAY_NAMES, nextClass, type ClassSlot } from "./classes";

/** The Orbit assistant's brain. It answers from what Orbit itself knows (this campus's events and clubs, your classes, reminders and unread counts) and can
 *  open a page. It does not call an outside AI service: nothing you ask leaves the app. Pure, so it can be tested. */
export type AssistantCtx = {
  now: Date;
  events: { title: string; description: string; startsAt: string; endsAt?: string; place: string; host: string; going: number }[];
  clubs: { id: string; name: string; kind: string; description: string; people: number; mine: boolean; category: string; meeting: string }[];
  classes: ClassSlot[];
  reminders: { title: string; date: string; time?: string; done: boolean }[];
  unreadMessages: number;
  unreadNotifs: number;
};
export type Reply = { text: string; go?: string; /** What to call the button that opens `go`. */ goLabel?: string };

const PAGES: [RegExp, string, string][] = [
  [/\b(feed|home)\b/, "/app/feed", "the feed"],
  [/\b(messages?|dms?|inbox|chats?)\b/, "/app/chats", "chats"],
  [/\bgroups?\b/, "/app/chats?tab=groups", "groups"],
  [/\b(sync|free time|find a time|schedule sync)\b/, "/app/sync", "Schedule sync"],
  [/\b(plans?|calendar|agenda|schedule)\b/, "/app/plans", "your plans"],
  [/\b(campus|events?|clubs?|circles?)\b/, "/app/campus", "Campus"],
  [/\bmap\b/, "/app/map", "the map"],
  [/\b(profile|settings|account)\b/, "/app/profile", "your profile"],
  [/\broommates?\b/, "/app/roommates", "roommates"],
];

const DAY = 86400000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const clock = (d: Date) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

/** "today at 4:00 PM", "tomorrow at 6:00 PM", "Wed, Oct 28 at 7:30 PM". */
export function describeWhen(iso: string, now: Date): string {
  const d = new Date(iso);
  const diff = Math.round((startOfDay(d) - startOfDay(now)) / DAY);
  const day = diff === 0 ? "today" : diff === 1 ? "tomorrow" : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  return `${day} at ${clock(d)}`;
}

const STOP = new Set(["what", "whats", "when", "where", "who", "how", "the", "and", "are", "any", "there", "this", "that", "for", "with", "have", "has", "can", "you", "tell", "about", "show", "give", "list", "going", "happening", "events", "event", "clubs", "club", "next", "from", "into", "does", "meet", "get", "find", "look", "looking", "want", "need", "please", "orbit", "campus", "today", "tonight", "tomorrow", "week", "weekend", "soon", "free"]);
const words = (q: string) => q.toLowerCase().replace(/[^a-z0-9\s']/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
const list = (items: string[]) => (items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);

export function answerFor(raw: string, ctx: AssistantCtx): Reply {
  const q = raw.trim().toLowerCase();
  const { now } = ctx;

  /* open a page */
  if (/^(open|go to|take me|bring me|navigate|switch to)\b/.test(q)) {
    const hit = PAGES.find(([re]) => re.test(q));
    if (hit) return { text: `Here is ${hit[2]}. Tap the button to go there.`, go: hit[1], goLabel: `Open ${hit[2]}` };
  }

  if (/^(hi|hello|hey|yo|good (morning|afternoon|evening))\b/.test(q)) return { text: "Hi! Ask me what is on tonight, about a club, your next class or your reminders, or tell me a page to open." };
  if (/\b(help|what can you do|what do you do)\b/.test(q)) return { text: "I can tell you what is happening on campus, find a club, check your next class and reminders, count your unread messages, explain how things work, or open a page. Try asking what is on tonight." };

  /* a club or circle by name */
  const club = ctx.clubs.find((c) => q.includes(c.name.toLowerCase()));
  if (club) {
    const kind = club.kind === "official" ? "an official office" : club.kind === "circle" ? "a student circle" : "a student club";
    return { text: `${club.name} is ${kind} with ${club.people} ${club.people === 1 ? "person" : "people"}${club.category ? `, in ${club.category}` : ""}.${club.meeting ? ` It meets ${club.meeting}.` : ""}${club.description ? ` ${club.description}` : ""}${club.mine ? " You are in it." : ""}`, go: `/app/campus/clubs/${club.id}`, goLabel: `Open ${club.name}` };
  }

  /* how things work */
  if (/\b(check ?-?in|qr)\b/.test(q)) return { text: "At an event, the host opens Check-in on the event card and shows a code that changes every 30 seconds. Scan it with your phone camera, or type the six letters, while the event is on. Your check-ins are kept privately on the Campus page." };
  if (/\b(start|make|create|apply for|open)\b.*\b(club|circle)\b/.test(q)) return { text: "On Campus, open Clubs and tap Start a club. You answer a few questions, a coordinator reviews them, and you get a notification. A circle is quicker: it starts right away and anyone can join, but it cannot post campus events." };
  if (/\b(post|create|add|host)\b.*\bevent\b/.test(q)) return { text: "Open your club's page, go to Events and tap Post an event. You answer a few questions, and a coordinator approves new events from clubs they do not trust yet." };
  if (/\bjoin\b.*\b(club|circle)\b|\bhow\b.*\bjoin\b/.test(q)) return { text: "Open the club from Campus and tap Ask to join. An officer answers, and you get a notification. Circles let you in right away." };
  if (/\b(role|title|permission)s?\b/.test(q)) return { text: "A club's president makes roles with titles, like Treasurer, and ticks what each can do. Open the club, go to People and look for Roles." };
  if (/\bpods?\b/.test(q)) return { text: "A pod is a small group inside a club, like Portrait or Street photography. Open the club, go to People, and join one. It gets its own private chat and meetups." };

  /* classes */
  if (/\b(class|classes|lecture|professor|next class)\b/.test(q)) {
    const n = nextClass(ctx.classes, now);
    if (!n) return { text: ctx.classes.length ? "You have no more classes coming up this week." : "You have not added your classes yet. Add them in Plans and I can tell you what is next." };
    const day = DAY_NAMES[n.starts.getDay()];
    return { text: `Your next class is ${n.slot.name} on ${day} at ${clockLabel(n.slot.start)}${n.slot.place ? ` in ${n.slot.place}` : ""}.` };
  }

  /* reminders */
  if (/\b(remind|reminders|to-?do|due|deadline)\b/.test(q)) {
    const open = ctx.reminders.filter((r) => !r.done).sort((a, b) => (a.date + (a.time ?? "")).localeCompare(b.date + (b.time ?? "")));
    if (open.length === 0) return { text: "You have no open reminders. Nice." };
    return { text: `You have ${open.length} open ${open.length === 1 ? "reminder" : "reminders"}: ${list(open.slice(0, 3).map((r) => `${r.title} on ${new Date(r.date + "T12:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}`))}${open.length > 3 ? ", and more in Plans" : ""}.` };
  }

  /* unread */
  if (/\b(unread|inbox|notification|notifications|bell|missed)\b|\bnew messages?\b/.test(q)) {
    const m = ctx.unreadMessages, n = ctx.unreadNotifs;
    return { text: m === 0 && n === 0 ? "You are all caught up. No unread messages or notifications." : `You have ${m} unread ${m === 1 ? "message" : "messages"} and ${n} unread ${n === 1 ? "notification" : "notifications"}.` };
  }

  /* events */
  if (/\b(event|events|happening|going on|what'?s on|whats on|tonight|today|tomorrow|weekend|this week|workshop|fair|talk|party)\b/.test(q)) {
    const today = startOfDay(now);
    const range = /\btonight|today\b/.test(q) ? [today, today + DAY] : /\btomorrow\b/.test(q) ? [today + DAY, today + 2 * DAY] : /\bweekend\b/.test(q) ? weekendRange(now) : /\bthis week\b/.test(q) ? [today, today + 7 * DAY] : [today, today + 14 * DAY];
    const terms = words(q);
    let found = ctx.events.filter((e) => { const t = new Date(e.startsAt).getTime(); return t >= range[0] && t < range[1]; });
    const matched = terms.length ? found.filter((e) => terms.some((w) => `${e.title} ${e.description} ${e.host}`.toLowerCase().includes(w))) : found;
    if (terms.length && matched.length) found = matched;
    found.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    const label = /\btonight\b/.test(q) ? "tonight" : /\btoday\b/.test(q) ? "today" : /\btomorrow\b/.test(q) ? "tomorrow" : /\bweekend\b/.test(q) ? "this weekend" : /\bthis week\b/.test(q) ? "this week" : "in the next two weeks";
    if (found.length === 0) return { text: `I do not see any campus events ${label}. Check Campus in a bit, or start something in Clubs.`, go: undefined };
    const top = found.slice(0, 3).map((e) => `${e.title} ${describeWhen(e.startsAt, now)}${e.place ? ` in ${e.place}` : ""}`);
    return { text: `${found.length === 1 ? "There is 1 event" : `There are ${found.length} events`} ${label}: ${list(top)}${found.length > 3 ? `, and ${found.length - 3} more on Campus` : ""}.` };
  }

  /* clubs in general */
  if (/\b(club|clubs|circle|circles|society|join)\b/.test(q)) {
    const terms = words(q);
    const hits = terms.length ? ctx.clubs.filter((c) => terms.some((w) => `${c.name} ${c.description} ${c.category}`.toLowerCase().includes(w))) : [];
    if (/\bmy\b/.test(q)) {
      const mine = ctx.clubs.filter((c) => c.mine);
      return { text: mine.length ? `You are in ${list(mine.map((c) => c.name))}.` : "You are not in any club yet. Open Campus and tap Clubs to find one." };
    }
    if (hits.length) return { text: `You might like ${list(hits.slice(0, 3).map((c) => c.name))}. Say a name and I will tell you more.` };
    return { text: ctx.clubs.length ? `On your campus there ${ctx.clubs.length === 1 ? "is" : "are"} ${list(ctx.clubs.slice(0, 4).map((c) => c.name))}${ctx.clubs.length > 4 ? " and more" : ""}. Say a name and I will tell you more.` : "No clubs yet. You can start the first one from Campus." };
  }

  return { text: "I am not sure about that one. I can tell you what is happening on campus, find a club, check your next class and reminders, or open a page. Try asking what is on tonight." };
}

function weekendRange(now: Date): [number, number] {
  const today = startOfDay(now);
  const dow = now.getDay();
  const sat = dow === 6 ? today : dow === 0 ? today - DAY : today + (6 - dow) * DAY;
  return [sat, sat + 2 * DAY];
}
