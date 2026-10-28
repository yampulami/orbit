import { campusKey } from "../shared/campus";
import { supabase } from "./supabase";
import { samplePostsFor } from "./demoPosts";

/** `parent_id` is the comment this one answers, or null for a comment straight on the post. */
export type Comment = { id: string; user_id: string; author_name: string; body: string; created_at: string; parent_id?: string | null };
export type Row = {
  id: string; author_id: string; author_name: string; kind: string; community: string;
  payload: { body?: string; text?: string; title?: string; /** A repost: the post it repeats, and who wrote that one. */ repostOf?: string; repostName?: string };
  created_at: string;
  post_likes: { user_id: string }[]; post_comments: Comment[];
};
export type Campus = { name: string; key: string };
export type NewPost = { id: string; campus_key: string; author_id: string; author_name: string; community: string; body: string; repostOf?: string; repostName?: string };

export interface FeedApi {
  campus(): Promise<Campus | null>;
  join(c: Campus, me: string): Promise<void>;
  list(): Promise<Row[]>;
  publish(p: NewPost): Promise<void>;
  like(postId: string, me: string, liked: boolean): Promise<void>;
  remove(id: string): Promise<void>;
  comment(postId: string, me: string, author: string, body: string, parentId?: string): Promise<void>;
}

function fail(error: { message: string } | null) { if (error) throw new Error(error.message); }

const supaApi: FeedApi = {
  async campus() {
    const { data } = await supabase!.from("campus_memberships").select("campus_name,campus_key").maybeSingle();
    return data ? { name: data.campus_name, key: data.campus_key } : null;
  },
  async join(c, me) {
    fail((await supabase!.from("campus_memberships").upsert({ user_id: me, campus_key: c.key, campus_name: c.name, updated_at: new Date().toISOString() })).error);
  },
  async list() {
    const { data, error } = await supabase!.from("campus_posts")
      .select("id,author_id,author_name,kind,community,payload,created_at,post_likes(user_id),post_comments(id,user_id,author_name,body,created_at,parent_id)")
      .order("created_at", { ascending: false }).limit(50);
    fail(error);
    return ((data ?? []) as unknown as Row[]).map((r) => ({ ...r, post_comments: [...r.post_comments].sort((a, b) => a.created_at.localeCompare(b.created_at)) }));
  },
  async publish(p) {
    fail((await supabase!.from("campus_posts").insert({ id: p.id, campus_key: p.campus_key, author_id: p.author_id, author_name: p.author_name, kind: "post", community: p.community, payload: { body: p.body, ...(p.repostOf ? { repostOf: p.repostOf, repostName: p.repostName } : {}) } })).error);
  },
  async like(postId, me, liked) {
    fail((liked ? await supabase!.from("post_likes").upsert({ post_id: postId, user_id: me }) : await supabase!.from("post_likes").delete().eq("post_id", postId).eq("user_id", me)).error);
  },
  async remove(id) { fail((await supabase!.from("campus_posts").delete().eq("id", id)).error); },
  async comment(postId, me, author, body, parentId) {
    fail((await supabase!.from("post_comments").insert({ id: crypto.randomUUID(), post_id: postId, user_id: me, author_name: author, body, parent_id: parentId ?? null })).error);
  },
};

/* ---------- Demo mode: runs fully in the browser, no account needed ---------- */
const KEY = "orbit-demo-feed-v2";
const ago = (m: number) => new Date(Date.now() - m * 60000).toISOString();
const seed = (): Row[] => [
  { id: "d1", author_id: "u-maya", author_name: "Maya", kind: "post", community: "Everyone", created_at: ago(18), payload: { body: "Library 3rd floor quiet room is empty right now. Midterm week is rough, good luck everyone." }, post_likes: [{ user_id: "u-sam" }, { user_id: "u-lee" }], post_comments: [{ id: "c1", user_id: "u-sam", author_name: "Sam", body: "Heading there now, thank you!", created_at: ago(10) }] },
  { id: "d2", author_id: "u-jordan", author_name: "Jordan", kind: "post", community: "Commuters", created_at: ago(95), payload: { body: "Anyone driving in from Montclair tomorrow around 8:30? Happy to split gas." }, post_likes: [{ user_id: "u-maya" }], post_comments: [] },
  { id: "d3", author_id: "u-priya", author_name: "Priya", kind: "post", community: "Marketplace", created_at: ago(300), payload: { body: "Selling a lightly used Calc II textbook, $25. Pickup at the student center." }, post_likes: [], post_comments: [] },
  { id: "d4", author_id: "u-lee", author_name: "Lee", kind: "post", community: "Roommates", created_at: ago(1500), payload: { body: "Reminder: quiet hours start at 10pm in Hamilton Hall this week. Thanks all!" }, post_likes: [{ user_id: "u-maya" }, { user_id: "u-jordan" }, { user_id: "u-priya" }], post_comments: [] },
  { id: "d5", author_id: "u-sam", author_name: "Sam", kind: "post", community: "Everyone", created_at: ago(4), payload: { body: "Does anyone know if the dining hall is still serving brunch? The sign says 11 but the doors are locked." }, post_likes: [{ user_id: "u-maya" }, { user_id: "u-lee" }], post_comments: [{ id: "d5-c1", user_id: "u-priya", author_name: "Priya", body: "They open at 11:30 on Sundays, I just walked by.", created_at: ago(2) }] },
  { id: "d6", author_id: "u-riley", author_name: "Riley", kind: "post", community: "Everyone", created_at: ago(12), payload: { body: "Free coffee at the library entrance until 3pm. Bring your own mug and they will refill it!" }, post_likes: [{ user_id: "u-maya" }, { user_id: "u-sam" }, { user_id: "u-jordan" }, { user_id: "u-priya" }, { user_id: "u-lee" }], post_comments: [] },
  { id: "d7", author_id: "u-dana", author_name: "Dana", kind: "post", community: "Commuters", created_at: ago(25), payload: { body: "The 7:40 shuttle from the north lot is running about 10 minutes late today. Leave a little earlier if you have an 8am." }, post_likes: [{ user_id: "u-jordan" }], post_comments: [{ id: "d7-c1", user_id: "u-jordan", author_name: "Jordan", body: "Thanks, just saw it pull in.", created_at: ago(15) }] },
  { id: "d8", author_id: "u-alex", author_name: "Alex", kind: "post", community: "Marketplace", created_at: ago(40), payload: { body: "Selling a mini fridge, works great, 3 years old. $60, pickup from Hamilton Hall this weekend." }, post_likes: [{ user_id: "u-lee" }, { user_id: "u-sam" }], post_comments: [{ id: "d8-c1", user_id: "u-maya", author_name: "Maya", body: "Is it still available?", created_at: ago(30) }, { id: "d8-c2", user_id: "u-alex", author_name: "Alex", body: "Yes! Message me.", created_at: ago(22) }] },
  { id: "d9", author_id: "u-noor", author_name: "Noor", kind: "post", community: "Roommates", created_at: ago(55), payload: { body: "Looking for one more roommate for a 4 bedroom off Park Ave starting in January. Quiet, clean, and likes to cook. DM me." }, post_likes: [{ user_id: "u-priya" }, { user_id: "u-maya" }, { user_id: "u-riley" }], post_comments: [] },
  { id: "d10", author_id: "u-chris", author_name: "Chris", kind: "post", community: "Residents", created_at: ago(75), payload: { body: "Reminder: fire drill in Hamilton Hall tonight at 9pm. Everyone out, even if you are in the shower. Thanks!" }, post_likes: [{ user_id: "u-lee" }], post_comments: [] },
  { id: "d11", author_id: "u-taylor", author_name: "Taylor", kind: "post", community: "Everyone", created_at: ago(110), payload: { body: "The robotics club is hosting an open build night in the engineering lab on Thursday. No experience needed, snacks provided." }, post_likes: [{ user_id: "u-sam" }, { user_id: "u-jordan" }, { user_id: "u-maya" }, { user_id: "u-priya" }], post_comments: [{ id: "d11-c1", user_id: "u-sam", author_name: "Sam", body: "I will be there!", created_at: ago(90) }, { id: "d11-c2", user_id: "u-noor", author_name: "Noor", body: "Do we need to bring anything?", created_at: ago(80) }, { id: "d11-c3", user_id: "u-taylor", author_name: "Taylor", body: "Just yourself. We have tools and parts.", created_at: ago(70) }] },
  { id: "d12", author_id: "u-morgan", author_name: "Morgan", kind: "post", community: "Marketplace", created_at: ago(150), payload: { body: "Calc II textbook, 8th edition, highlighted but in good shape. $30 or best offer. Can meet at the student center." }, post_likes: [], post_comments: [] },
  { id: "d13", author_id: "u-jamie", author_name: "Jamie", kind: "post", community: "Commuters", created_at: ago(200), payload: { body: "Anyone driving in from the east side tomorrow morning? I have two open seats and I leave at 7:15." }, post_likes: [{ user_id: "u-jordan" }, { user_id: "u-riley" }], post_comments: [{ id: "d13-c1", user_id: "u-riley", author_name: "Riley", body: "I would love a ride! Where do you park?", created_at: ago(180) }] },
  { id: "d14", author_id: "u-casey", author_name: "Casey", kind: "post", community: "Everyone", created_at: ago(260), payload: { body: "Lost: a black water bottle with a mountain sticker, left in Smith 204 after lecture. If you find it please let me know." }, post_likes: [{ user_id: "u-lee" }], post_comments: [] },
  { id: "d15", author_id: "u-quinn", author_name: "Quinn", kind: "post", community: "Residents", created_at: ago(340), payload: { body: "The laundry room on the 2nd floor has two broken dryers again. I put in a maintenance request, add yours too so they take it seriously." }, post_likes: [{ user_id: "u-maya" }, { user_id: "u-lee" }, { user_id: "u-priya" }], post_comments: [{ id: "d15-c1", user_id: "u-lee", author_name: "Lee", body: "Added mine. It has been two weeks.", created_at: ago(300) }] },
  { id: "d16", author_id: "u-avery", author_name: "Avery", kind: "post", community: "Everyone", created_at: ago(420), payload: { body: "Study group for Organic Chemistry forming for the midterm. We are meeting Tuesday and Thursday at 6 in the library, room 3B." }, post_likes: [{ user_id: "u-sam" }, { user_id: "u-maya" }, { user_id: "u-jordan" }, { user_id: "u-priya" }, { user_id: "u-lee" }, { user_id: "u-riley" }], post_comments: [{ id: "d16-c1", user_id: "u-maya", author_name: "Maya", body: "Count me in.", created_at: ago(400) }, { id: "d16-c2", user_id: "u-jordan", author_name: "Jordan", body: "Same, I need the help.", created_at: ago(390) }] },
  { id: "d17", author_id: "u-blake", author_name: "Blake", kind: "post", community: "Roommates", created_at: ago(520), payload: { body: "Quiet hours reminder for the third floor: 10pm on weeknights. If you want to hang out, the lounge downstairs is open until midnight." }, post_likes: [{ user_id: "u-lee" }, { user_id: "u-priya" }], post_comments: [] },
  { id: "d18", author_id: "u-skyler", author_name: "Skyler", kind: "post", community: "Marketplace", created_at: ago(700), payload: { body: "Giving away a desk lamp and a set of bookshelves, free to whoever can carry them. Pickup by Friday please." }, post_likes: [{ user_id: "u-sam" }, { user_id: "u-maya" }, { user_id: "u-riley" }, { user_id: "u-jordan" }], post_comments: [{ id: "d18-c1", user_id: "u-sam", author_name: "Sam", body: "I will take the lamp!", created_at: ago(650) }, { id: "d18-c2", user_id: "u-priya", author_name: "Priya", body: "I can take the shelves, I have a car.", created_at: ago(600) }, { id: "d18-c3", user_id: "u-skyler", author_name: "Skyler", body: "Perfect, I will message you both.", created_at: ago(560) }] },
  { id: "d19", author_id: "u-emerson", author_name: "Emerson", kind: "post", community: "Everyone", created_at: ago(960), payload: { body: "Career fair next Wednesday in the gym, 10 to 3. Dress code is business casual. Bring printed resumes, even if you apply online." }, post_likes: [{ user_id: "u-sam" }, { user_id: "u-maya" }, { user_id: "u-jordan" }, { user_id: "u-priya" }, { user_id: "u-lee" }], post_comments: [{ id: "d19-c1", user_id: "u-noor", author_name: "Noor", body: "Which companies are coming?", created_at: ago(900) }, { id: "d19-c2", user_id: "u-emerson", author_name: "Emerson", body: "There is a list on the careers page, over 40 so far.", created_at: ago(880) }] },
  { id: "d20", author_id: "u-rowan", author_name: "Rowan", kind: "post", community: "Commuters", created_at: ago(1250), payload: { body: "Parking tip: the south garage fills up by 8:30, but the lot behind the science building almost always has spots until 10." }, post_likes: [{ user_id: "u-jordan" }, { user_id: "u-riley" }, { user_id: "u-sam" }], post_comments: [] },
  { id: "d21", author_id: "u-finley", author_name: "Finley", kind: "post", community: "Residents", created_at: ago(1800), payload: { body: "Movie night in the common room on Friday at 8. We are voting on the movie, drop your pick in the comments." }, post_likes: [{ user_id: "u-maya" }, { user_id: "u-priya" }, { user_id: "u-lee" }], post_comments: [{ id: "d21-c1", user_id: "u-maya", author_name: "Maya", body: "Spirited Away!", created_at: ago(1700) }, { id: "d21-c2", user_id: "u-lee", author_name: "Lee", body: "Anything but a horror movie please.", created_at: ago(1650) }, { id: "d21-c3", user_id: "u-finley", author_name: "Finley", body: "Noted, no horror.", created_at: ago(1600) }] },
  { id: "d22", author_id: "u-harper", author_name: "Harper", kind: "post", community: "Everyone", created_at: ago(2400), payload: { body: "The campus garden has extra tomatoes and herbs. Come by after 4pm and take what you want, just bring a bag." }, post_likes: [{ user_id: "u-sam" }, { user_id: "u-maya" }, { user_id: "u-lee" }, { user_id: "u-priya" }, { user_id: "u-jordan" }], post_comments: [] },
  { id: "d23", author_id: "u-kai", author_name: "Kai", kind: "post", community: "Marketplace", created_at: ago(3000), payload: { body: "Bike for sale, 21 speed, new tires, lock included. $85. Great for getting between the dorms and the lecture halls." }, post_likes: [{ user_id: "u-riley" }], post_comments: [{ id: "d23-c1", user_id: "u-jordan", author_name: "Jordan", body: "Can I test ride it?", created_at: ago(2900) }, { id: "d23-c2", user_id: "u-kai", author_name: "Kai", body: "Sure, I am free after 5 today.", created_at: ago(2850) }] },
  { id: "d24", author_id: "u-sage", author_name: "Sage", kind: "post", community: "Roommates", created_at: ago(4200), payload: { body: "Our group chat for the house is getting messy, so we started a shared chores list and split the groceries by app. So much calmer already." }, post_likes: [{ user_id: "u-maya" }, { user_id: "u-lee" }, { user_id: "u-priya" }, { user_id: "u-jordan" }], post_comments: [{ id: "d24-c1", user_id: "u-noor", author_name: "Noor", body: "Which app do you use for groceries?", created_at: ago(4100) }, { id: "d24-c2", user_id: "u-sage", author_name: "Sage", body: "We just keep a shared list in Orbit now.", created_at: ago(4000) }] },
].sort((x, y) => y.created_at.localeCompare(x.created_at)); // newest first
let mem: Row[] | null = null;
function read(): Row[] {
  if (mem) return mem;
  try { const s = localStorage.getItem(KEY); if (s) return (mem = JSON.parse(s)); } catch { /* storage unavailable */ }
  return (mem = seed());
}
function write(rows: Row[]) { mem = rows; try { localStorage.setItem(KEY, JSON.stringify(rows)); } catch { /* ignore */ } }

const demoCampusKey = () => { try { const n = localStorage.getItem("orbit-demo-campus"); return n ? campusKey(n) : ""; } catch { return ""; } };

const demoApi: FeedApi = {
  async campus() {
    // Demo mode has no accounts, so the chosen university is kept on this device. Nothing is chosen until the student picks one.
    try { const n = localStorage.getItem("orbit-demo-campus"); if (n) return { name: n, key: campusKey(n) }; } catch { /* ignore */ }
    return null;
  },
  async join(c) { try { localStorage.setItem("orbit-demo-campus", c.name); } catch { /* ignore */ } },
  // The hand-written sample posts belong to Caldwell. Any other campus gets a generic set the first time it is opened, so it never starts empty.
  async list() {
    const key = demoCampusKey();
    const flag = `orbit-demo-seeded:${key}`;
    try {
      if (key && key !== "caldwell-university" && !localStorage.getItem(flag)) { write([...read(), ...samplePostsFor(key)]); localStorage.setItem(flag, "1"); }
    } catch { /* storage unavailable */ }
    return structuredClone(read().filter((r) => ((r.payload as { campus?: string }).campus ?? "caldwell-university") === key));
  },
  async publish(p) {
    write([{ id: p.id, author_id: p.author_id, author_name: p.author_name, kind: "post", community: p.community, created_at: new Date().toISOString(), payload: { body: p.body, campus: p.campus_key, ...(p.repostOf ? { repostOf: p.repostOf, repostName: p.repostName } : {}) } as Row["payload"], post_likes: [], post_comments: [] }, ...read()]);
  },
  async like(postId, me, liked) {
    write(read().map((r) => r.id !== postId ? r : { ...r, post_likes: liked ? [...r.post_likes.filter((l) => l.user_id !== me), { user_id: me }] : r.post_likes.filter((l) => l.user_id !== me) }));
  },
  async remove(id) { write(read().filter((r) => r.id !== id)); },
  async comment(postId, me, author, body, parentId) {
    write(read().map((r) => r.id !== postId ? r : { ...r, post_comments: [...r.post_comments, { id: crypto.randomUUID(), user_id: me, author_name: author, body, created_at: new Date().toISOString(), parent_id: parentId ?? null }] }));
  },
};

export const feedApi: FeedApi = supabase ? supaApi : demoApi;
export const isDemo = !supabase;
