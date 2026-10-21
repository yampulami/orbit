import type { Row } from "./feedData";

/** Sample posts for any campus in demo mode, so a new campus never opens on an empty feed. They are generic on purpose (the library, the dining
 *  hall, the shuttle) and name no real buildings or events: every campus has those. Real campuses fill up with what students actually post. */
type Seed = { c: Row["community"]; ago: number; by: number; body: string; title?: string; likes?: number; comments?: [number, string][] };

const PEOPLE = ["Maya", "Sam", "Riley", "Jordan", "Priya", "Lee", "Dana", "Alex", "Noor", "Chris", "Taylor", "Morgan", "Jamie", "Casey", "Quinn", "Avery"];

const SEEDS: Seed[] = [
  { c: "Everyone", ago: 4, by: 1, body: "Does anyone know if the dining hall is still serving brunch? The sign says 11 but the doors are locked.", likes: 3, comments: [[5, "They switched to lunch early today, I just ate there."]] },
  { c: "Everyone", ago: 12, by: 2, body: "Free coffee at the library entrance until 3pm. Bring your own mug and they will refill it!", likes: 9, comments: [[0, "Going right now, thank you!"], [7, "Is it the good coffee or the regular?"]] },
  { c: "Everyone", ago: 18, by: 0, body: "Library 3rd floor quiet room is empty right now. Midterm week is rough, good luck everyone.", likes: 6 },
  { c: "Commuters", ago: 25, by: 6, body: "The shuttle from the north lot is running about 10 minutes late today. Leave a little earlier if you have an 8am.", likes: 4, comments: [[3, "Thanks for the warning, I was about to leave."]] },
  { c: "Marketplace", ago: 40, by: 7, body: "Selling a mini fridge, works great, 3 years old. $60, pickup this weekend.", likes: 2 },
  { c: "Roommates", ago: 55, by: 8, body: "Looking for one more roommate for a 4 bedroom close to campus starting in January. Quiet, clean, and likes to cook. DM me.", likes: 5, comments: [[10, "How far is it from the main gate?"], [8, "Ten minute walk. I can send photos."]] },
  { c: "Residents", ago: 75, by: 9, body: "Reminder: fire drill in the residence halls tonight at 9pm. Everyone out, even if you are in the shower. Thanks!", likes: 7 },
  { c: "Everyone", ago: 110, by: 10, title: "Open build night", body: "The robotics club is hosting an open build night in the engineering lab on Thursday. No experience needed, snacks provided.", likes: 14, comments: [[1, "Can first-years come?"], [10, "Absolutely, bring a friend."]] },
  { c: "Marketplace", ago: 150, by: 11, body: "Calc II textbook, 8th edition, highlighted but in good shape. $30 or best offer. Can meet at the student center.", likes: 3 },
  { c: "Commuters", ago: 200, by: 12, body: "Anyone driving in from the east side tomorrow morning? I have two open seats and I leave at 7:15.", likes: 8, comments: [[4, "Yes please! Where do you pick up?"]] },
  { c: "Everyone", ago: 260, by: 13, body: "Lost: a black water bottle with a mountain sticker, left in a lecture hall after class. If you find it please let me know.", likes: 1 },
  { c: "Residents", ago: 340, by: 14, body: "The laundry room on the 2nd floor has two broken dryers again. I put in a maintenance request, add yours too so they take it seriously.", likes: 11, comments: [[9, "Done, thanks for organizing this."]] },
  { c: "Everyone", ago: 420, by: 15, body: "Study group for Organic Chemistry forming for the midterm. We are meeting Tuesday at 6 in the library. All levels welcome.", likes: 12, comments: [[2, "Count me in."], [6, "Same! Which room?"], [15, "Group study room, second floor."]] },
  { c: "Roommates", ago: 520, by: 5, body: "Quiet hours reminder for the third floor: 10pm on weeknights. If you want to hang out later, the common room is free.", likes: 4 },
  { c: "Marketplace", ago: 700, by: 3, body: "Giving away a desk lamp and a set of bookshelves, free to whoever can carry them. Pickup today only.", likes: 6, comments: [[11, "I'll take the bookshelves!"]] },
  { c: "Everyone", ago: 960, by: 7, title: "Career fair", body: "Career fair next week in the gym, 10 to 3. Business casual, and bring a few copies of your resume.", likes: 18, comments: [[13, "Which companies are coming?"], [7, "The list is on the careers page."]] },
  { c: "Commuters", ago: 1250, by: 14, body: "Parking tip: the south garage fills up by 8:30, but the lot behind the science building usually has spots until 9.", likes: 15 },
  { c: "Residents", ago: 1800, by: 4, body: "Movie night in the common room on Friday at 8. We are voting on the movie, drop your pick below.", likes: 9, comments: [[0, "Something funny please."], [12, "Anything but a horror movie."]] },
  { c: "Everyone", ago: 2400, by: 9, body: "The campus garden has extra tomatoes and herbs. Come by after 4pm and take what you want.", likes: 10 },
  { c: "Marketplace", ago: 3000, by: 12, body: "Bike for sale, 21 speed, new tires, lock included. $85. Great for getting between classes.", likes: 2 },
  { c: "Roommates", ago: 4200, by: 2, body: "Our group chat for the house is getting messy, so we started a shared chores list. Anyone have a system that actually works?", likes: 7, comments: [[8, "A rotating weekly chart on the fridge worked for us."]] },
  { c: "Everyone", ago: 120, by: 11, body: "Anyone up for a pickup soccer game on the main lawn Saturday morning? All skill levels, we just need bodies.", likes: 8, comments: [[3, "I'm in!"], [14, "What time?"]] },
  { c: "Everyone", ago: 38, by: 6, body: "Does anyone have notes from Monday's chemistry lecture? I was out sick and the midterm is next week.", likes: 2, comments: [[2, "I'll post mine in the study group."]] },
  { c: "Commuters", ago: 600, by: 15, body: "The 5:45 train has been cancelled twice this week. If you ride it, the 6:10 is the safe bet.", likes: 6 },
  { c: "Residents", ago: 1500, by: 8, body: "The mail room closes at 4 on Fridays now. Learned that the hard way with a package I really needed.", likes: 5 },
];

/** Posts for a campus, newest first. Deterministic, so every visit shows the same set until someone posts. */
export function samplePostsFor(key: string): Row[] {
  const now = Date.now();
  return SEEDS.map((s, n) => {
    const author = PEOPLE[s.by % PEOPLE.length];
    const likers = PEOPLE.filter((p) => p !== author).slice(n % 5, (n % 5) + (s.likes ?? 0)).concat(PEOPLE.slice(0, Math.max(0, (s.likes ?? 0) - 10)));
    const created = (m: number) => new Date(now - m * 60000).toISOString();
    return {
      id: `seed-${key}-${n}`,
      author_id: `u-${author.toLowerCase()}`,
      author_name: author,
      kind: "post",
      community: s.c,
      created_at: created(s.ago),
      payload: { body: s.body, title: s.title, campus: key } as Row["payload"],
      post_likes: [...new Set(likers)].slice(0, s.likes ?? 0).map((p) => ({ user_id: `u-${p.toLowerCase()}` })),
      post_comments: (s.comments ?? []).map(([who, body], i) => ({ id: `seed-${key}-${n}-c${i}`, user_id: `u-${PEOPLE[who % PEOPLE.length].toLowerCase()}`, author_name: PEOPLE[who % PEOPLE.length], body, created_at: created(Math.max(1, s.ago - 3 - i * 4)) })),
    } as Row;
  }).sort((a, b) => b.created_at.localeCompare(a.created_at));
}
