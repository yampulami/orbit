import { validateForm } from "./formValidation";
export const communities = [
  "Everyone",
  "Commuters",
  "Residents",
  "Roommates",
  "Marketplace",
] as const;
export type Community = (typeof communities)[number];
export type PostKind = "post" | "event" | "marketplace";
export type Media = { uri: string; type: "image" | "video" };
export type Comment = {
  id: string;
  author: string;
  body: string;
  createdAt: string;
};
export type FeedPost = {
  id: string;
  kind: PostKind;
  author: string;
  mine?: boolean;
  sample?: boolean;
  community: Community;
  body: string;
  createdAt: string;
  media?: Media;
  link?: string;
  location?: string;
  liked: boolean;
  likes: number;
  comments: Comment[];
  poll?: { options: string[]; votes: number[]; choice: number | null };
  event?: {
    title: string;
    organizer: string;
    startsAt: string;
    audience: string;
    going: number;
    registered: boolean;
  };
  listing?: {
    title: string;
    cents: number;
    delivery: "Pickup" | "Drop-off" | "Either";
    messages: Comment[];
  };
};
export type PostDraft = {
  kind: PostKind;
  community: Community;
  body: string;
  title: string;
  organizer: string;
  date: string;
  time: string;
  audience: string;
  location: string;
  price: string;
  delivery: "Pickup" | "Drop-off" | "Either";
  link: string;
  media?: Media;
  pollOptions?: string[];
};
export function newPostDraft(author: string): PostDraft {
  return {
    kind: "post",
    community: "Everyone",
    body: "",
    title: "",
    organizer: author,
    date: "",
    time: "",
    audience: "Everyone on campus",
    location: "",
    price: "",
    delivery: "Pickup",
    link: "",
  };
}
export function safeWebLink(value: string) {
  try {
    const u = new URL(value);
    return ["http:", "https:"].includes(u.protocol) && !!u.hostname;
  } catch {
    return false;
  }
}
export function validatePost(d: PostDraft, now = Date.now()): string | null {
  if (!d.body.trim())
    return d.kind === "marketplace"
      ? "Add a few details about the item."
      : "Write something before posting.";
  if (d.body.length > 3000) return "Keep your post under 3,000 characters.";
  if (d.link.trim() && !safeWebLink(d.link.trim()))
    return "Use a full http:// or https:// link.";
  if (d.kind !== "post" && !d.title.trim())
    return d.kind === "event"
      ? "Give your event a title."
      : "Add the item name.";
  if (d.kind === "event") {
    if (!d.organizer.trim()) return "Add the organizer.";
    const issue = validateForm("hangout", {
      title: d.title,
      date: d.date,
      time: d.time,
      amount: "",
      email: "",
    });
    if (issue) return issue.message;
    if (Date.parse(`${d.date}T${d.time}`) <= now)
      return "Choose a future date and time.";
    if (!d.location.trim()) return "Add an event location.";
    if (!d.audience.trim()) return "Choose who the event is for.";
  }
  if (d.kind === "marketplace") {
    if (!/^\d+(\.\d{1,2})?$/.test(d.price.trim()) || Number(d.price) > 100000)
      return "Enter a price from $0 to $100,000, with up to two decimals.";
    if (!d.location.trim()) return "Add a pickup or drop-off location.";
  }
  if (d.kind === "post" && d.pollOptions) {
    const options = d.pollOptions.map((x) => x.trim());
    if (options.length < 2 || options.length > 4 || options.some((x) => !x))
      return "Add text for every poll option (2–4 options).";
    if (new Set(options.map((x) => x.toLowerCase())).size !== options.length)
      return "Use different poll options.";
  }
  return null;
}
export function createPost(
  d: PostDraft,
  author: string,
  id: string,
  now = Date.now(),
): FeedPost {
  const error = validatePost(d, now);
  if (error) throw new Error(error);
  return {
    id,
    kind: d.kind,
    author,
    mine: true,
    community: d.kind === "marketplace" ? "Marketplace" : d.community,
    body: d.body.trim(),
    createdAt: new Date(now).toISOString(),
    media: d.media,
    link: d.link.trim() || undefined,
    location: d.location.trim() || undefined,
    liked: false,
    likes: 0,
    comments: [],
    ...(d.kind === "event"
      ? {
          event: {
            title: d.title.trim(),
            organizer: d.organizer.trim(),
            startsAt: new Date(`${d.date}T${d.time}`).toISOString(),
            audience: d.audience.trim(),
            going: 0,
            registered: false,
          },
        }
      : {}),
    ...(d.kind === "marketplace"
      ? {
          listing: {
            title: d.title.trim(),
            cents: Math.round(Number(d.price) * 100),
            delivery: d.delivery,
            messages: [],
          },
        }
      : {}),
    ...(d.kind === "post" && d.pollOptions
      ? {
          poll: {
            options: d.pollOptions.map((x) => x.trim()),
            votes: d.pollOptions.map(() => 0),
            choice: null,
          },
        }
      : {}),
  };
}
export function likePost(p: FeedPost): FeedPost {
  return {
    ...p,
    liked: !p.liked,
    likes: Math.max(0, p.likes + (p.liked ? -1 : 1)),
  };
}
export function registerPost(p: FeedPost, now = Date.now()): FeedPost {
  if (!p.event || (Date.parse(p.event.startsAt) <= now && !p.event.registered))
    return p;
  return {
    ...p,
    event: {
      ...p.event,
      registered: !p.event.registered,
      going: Math.max(0, p.event.going + (p.event.registered ? -1 : 1)),
    },
  };
}
export function votePost(p: FeedPost, choice: number): FeedPost {
  if (
    !p.poll ||
    choice < 0 ||
    choice >= p.poll.options.length ||
    !Number.isInteger(choice)
  )
    return p;
  const previous = p.poll.choice,
    next = previous === choice ? null : choice;
  return {
    ...p,
    poll: {
      ...p.poll,
      choice: next,
      votes: p.poll.votes.map((v, i) =>
        Math.max(0, v - (previous === i ? 1 : 0) + (next === i ? 1 : 0)),
      ),
    },
  };
}
export function filterPosts(
  posts: FeedPost[],
  community: string,
  query = "",
  eventsOnly = false,
) {
  const q = query.trim().toLowerCase();
  return posts.filter(
    (p) =>
      (!eventsOnly || p.kind === "event") &&
      (community === "All" || p.community === community) &&
      `${p.body} ${p.author} ${p.event?.title ?? ""} ${p.listing?.title ?? ""} ${p.location ?? ""}`
        .toLowerCase()
        .includes(q),
  );
}
export function sampleFeed(): FeedPost[] {
  const base = {
    sample: true,
    liked: false,
    likes: 0,
    comments: [],
    createdAt: "2026-09-28T14:00:00Z",
  };
  return [
    {
      ...base,
      id: "sample-event",
      kind: "event",
      author: "Campus Makers",
      community: "Everyone",
      body: "Bring something you’re working on, or just bring yourself. A relaxed evening to make things and meet people.",
      location: "Student center · Room 204",
      event: {
        title: "Make something together",
        organizer: "Campus Makers",
        startsAt: "2026-10-08T22:00:00Z",
        audience: "All years · no experience needed",
        going: 0,
        registered: false,
      },
    },
    {
      ...base,
      id: "sample-commuter",
      kind: "post",
      author: "Taylor",
      community: "Commuters",
      body: "A gap between classes is better with company. Where’s your go-to spot to unwind on campus?",
      poll: {
        options: ["The café", "Library lounge", "Outside on the quad"],
        votes: [0, 0, 0],
        choice: null,
      },
    },
    {
      ...base,
      id: "sample-market",
      kind: "marketplace",
      author: "Alex",
      community: "Marketplace",
      body: "Adjustable desk lamp, warm light, great for late study sessions. A little wear on the base.",
      location: "Student center",
      listing: {
        title: "Desk lamp",
        cents: 1200,
        delivery: "Pickup",
        messages: [],
      },
    },
  ];
}
