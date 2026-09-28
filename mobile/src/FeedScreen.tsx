import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { randomUUID } from "expo-crypto";
import {
  communities,
  filterPosts,
  likePost,
  newPostDraft,
  registerPost,
  sampleFeed,
  votePost,
  type FeedPost,
  type PostDraft,
} from "../../src/feed";
import type { State } from "../../src/model";
import { money } from "../../src/model";
import Touch from "./Touch";
import Input from "./FocusInput";
import SearchField from "./SearchField";
import FeedComposer from "./FeedComposer";
import FeedMedia from "./FeedMedia";
import { OrbitMark } from "./EntryUI";
import { useCurrentTime } from "./useCurrentTime";
import { theme as t } from "./theme";
const samples = sampleFeed();
type Props = {
  state: State;
  save: (update: (s: State) => State) => void;
  author: string;
  eventsOnly: boolean;
  profile: () => void;
  showFeed: () => void;
};
export default function FeedScreen({
  state,
  save,
  author,
  eventsOnly,
  profile,
  showFeed,
}: Props) {
  const posts = state.feed ?? samples,
    now = useCurrentTime();
  const [draft, setDraft] = useState<PostDraft>(() => newPostDraft(author)),
    [composerTool, setComposerTool] = useState(""),
    [composing, setComposing] = useState(false),
    [filter, setFilter] = useState("All"),
    [query, setQuery] = useState(""),
    [eventFilter, setEventFilter] = useState("Upcoming");
  const [panel, setPanel] = useState<{
      kind: "comments" | "chat" | "notifications";
      id?: string;
    } | null>(null),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [removed, setRemoved] = useState<FeedPost | null>(null);
  useEffect(() => {
    setQuery("");
  }, [eventsOnly]);
  const selected = posts.find((p) => p.id === panel?.id);
  const update = (id: string, fn: (post: FeedPost) => FeedPost) =>
    save((s) => ({
      ...s,
      feed: (s.feed ?? samples).map((p) => (p.id === id ? fn(p) : p)),
    }));
  const visible = filterPosts(
    posts,
    eventsOnly ? "All" : filter,
    query,
    eventsOnly,
  ).filter(
    (p) =>
      !eventsOnly ||
      (eventFilter === "Registered"
        ? p.event?.registered
        : eventFilter === "Past"
          ? Date.parse(p.event!.startsAt) <= now
          : Date.parse(p.event!.startsAt) > now),
  );
  function openComposer() {
    setComposerTool("");
    if (eventsOnly) setDraft({ ...draft, kind: "event" });
    setComposing(true);
  }
  function openPanel(kind: "comments" | "chat" | "notifications", id?: string) {
    setPanel({ kind, id });
    setMessage("");
    setError("");
  }
  function publish(post: FeedPost) {
    save((s) => ({ ...s, feed: [post, ...(s.feed ?? samples)] }));
    setComposing(false);
    setDraft(newPostDraft(author));
    setFilter("All");
    setQuery("");
    setEventFilter("Upcoming");
    if (eventsOnly && post.kind !== "event") showFeed();
  }
  async function share(post: FeedPost) {
    try {
      await Share.share({
        message: [
          post.event?.title ?? post.listing?.title,
          post.body,
          post.location,
          post.link,
        ]
          .filter(Boolean)
          .join("\n\n"),
      });
    } catch {
      setError("Sharing is unavailable here. Try again on your phone.");
    }
  }
  function send() {
    if (!selected || !message.trim()) return;
    const entry = {
      id: randomUUID(),
      author,
      body: message.trim(),
      createdAt: new Date().toISOString(),
    };
    update(selected.id, (p) =>
      panel?.kind === "chat" && p.listing
        ? {
            ...p,
            listing: { ...p.listing, messages: [...p.listing.messages, entry] },
          }
        : { ...p, comments: [...p.comments, entry] },
    );
    setMessage("");
  }
  const icon = (
    name: React.ComponentProps<typeof Ionicons>["name"],
    size = 21,
    color = t.muted,
  ) => <Ionicons accessible={false} name={name} size={size} color={color} />;
  return (
    <View style={s.root}>
      <View style={s.header}>
        <Touch
          accessibilityRole="button"
          accessibilityLabel="Edit profile"
          onPress={profile}
          style={s.brand}
        >
          <OrbitMark size={30} />
          <Text style={s.wordmark}>orbit</Text>
        </Touch>
        <View style={{ flex: 1 }} />
        <Text style={s.meta}>LOCAL PREVIEW</Text>
        <Touch
          accessibilityRole="button"
          accessibilityLabel="Notifications"
          onPress={() => openPanel("notifications")}
          style={s.iconTouch}
        >
          {icon("notifications-outline", 23, t.text)}
        </Touch>
      </View>
      {eventsOnly ? (
        <View style={s.eventsTitle}>
          <View>
            <Text style={s.heading}>Events</Text>
            <Text style={s.caption}>Find your next reason to show up.</Text>
          </View>
          <Touch
            accessibilityRole="button"
            accessibilityLabel="Create event"
            onPress={openComposer}
            style={s.newEvent}
          >
            {icon("add", 24, t.text)}
          </Touch>
        </View>
      ) : (
        <Touch
          accessibilityRole="button"
          accessibilityLabel="Write a post"
          onPress={openComposer}
          style={s.composer}
        >
          <View style={s.avatar}>
            <Text style={s.initial}>{author[0]?.toUpperCase()}</Text>
          </View>
          <Text style={s.prompt}>
            {draft.body
              ? "Continue your draft…"
              : "What’s happening in your orbit?"}
          </Text>
          {icon("create-outline", 22, t.active)}
        </Touch>
      )}
      {!eventsOnly && (
        <View style={s.composerTools}>
          {(
            [
              ["image-outline", "Photo"],
              ["happy-outline", "Emoji"],
              ["location-outline", "Location"],
              ["stats-chart-outline", "Poll"],
            ] as const
          ).map(([name, label]) => (
            <Touch
              key={label}
              accessibilityRole="button"
              accessibilityLabel={`Create ${label.toLowerCase()} post`}
              onPress={() => {
                setComposerTool(label.toLowerCase());
                if (label === "Poll")
                  setDraft({
                    ...draft,
                    kind: "post",
                    pollOptions: draft.pollOptions ?? ["", ""],
                  });
                setComposing(true);
              }}
              style={s.action}
            >
              {icon(name, 18, t.active)}
              <Text style={s.caption}>{label}</Text>
            </Touch>
          ))}
        </View>
      )}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.filters}
        accessibilityRole="tablist"
      >
        {(eventsOnly
          ? ["Upcoming", "Registered", "Past"]
          : ["All", ...communities.filter((x) => x !== "Everyone")]
        ).map((value) => {
          const active = (eventsOnly ? eventFilter : filter) === value;
          return (
            <Touch
              key={value}
              accessibilityRole="tab"
              accessibilityLabel={value}
              accessibilityState={{ selected: active }}
              aria-selected={active}
              onPress={() =>
                eventsOnly ? setEventFilter(value) : setFilter(value)
              }
              style={[s.filter, active && s.filterActive]}
            >
              <Text style={[s.filterText, active && { color: t.text }]}>
                {value}
              </Text>
            </Touch>
          );
        })}
      </ScrollView>
      <View style={s.search}>
        <SearchField
          label={eventsOnly ? "Search events" : "Search feed"}
          placeholder={eventsOnly ? "Search events" : "Search your campus"}
          value={query}
          onChange={setQuery}
        />
      </View>
      {!!error && (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      )}
      {removed && (
        <View style={s.undo}>
          <Text style={s.caption}>Post removed</Text>
          <Touch
            accessibilityRole="button"
            accessibilityLabel="Undo remove post"
            onPress={() => {
              save((s) => ({ ...s, feed: [removed, ...(s.feed ?? samples)] }));
              setRemoved(null);
            }}
            style={s.iconTouch}
          >
            <Text style={s.link}>Undo</Text>
          </Touch>
        </View>
      )}
      {!visible.length && (
        <View style={s.empty}>
          {icon(
            eventsOnly ? "calendar-outline" : "chatbubbles-outline",
            32,
            t.active,
          )}
          <Text style={s.title}>
            {query
              ? "No matches"
              : eventsOnly && eventFilter === "Registered"
                ? "Nothing registered yet"
                : "Nothing here yet"}
          </Text>
          <Text style={s.caption}>
            {query
              ? "Try a different search."
              : eventsOnly
                ? "Events posted in Feed appear here too."
                : "Start a conversation in this community."}
          </Text>
          {query ? (
            <Touch
              accessibilityRole="button"
              onPress={() => setQuery("")}
              style={s.iconTouch}
            >
              <Text style={s.link}>Clear search</Text>
            </Touch>
          ) : (
            <Touch
              accessibilityRole="button"
              onPress={openComposer}
              style={s.iconTouch}
            >
              <Text style={s.link}>
                {eventsOnly ? "Create an event" : "Write a post"}
              </Text>
            </Touch>
          )}
        </View>
      )}
      {visible.map((post) => (
        <View key={post.id} style={s.post}>
          <View style={s.authorRow}>
            <View
              style={[
                s.avatar,
                post.kind === "event" && { backgroundColor: t.teal },
              ]}
            >
              {post.kind === "event" ? (
                icon("calendar-outline", 20, t.text)
              ) : (
                <Text style={s.initial}>{post.author[0]?.toUpperCase()}</Text>
              )}
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={s.author}>{post.author}</Text>
              <Text style={s.meta}>
                {post.community} ·{" "}
                {post.sample
                  ? "Sample post"
                  : new Date(post.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
              </Text>
            </View>
            {post.mine && (
              <Touch
                accessibilityRole="button"
                accessibilityLabel={`Remove ${post.event?.title ?? post.listing?.title ?? "post"}`}
                onPress={() => {
                  setRemoved(post);
                  save((s) => ({
                    ...s,
                    feed: (s.feed ?? samples).filter((p) => p.id !== post.id),
                  }));
                }}
                style={s.iconTouch}
              >
                {icon("trash-outline", 18)}
              </Touch>
            )}
          </View>
          {post.event && (
            <View style={s.eventHeading}>
              <View style={s.dateTile}>
                <Text style={s.month}>
                  {new Date(post.event.startsAt)
                    .toLocaleDateString(undefined, { month: "short" })
                    .toUpperCase()}
                </Text>
                <Text style={s.day}>
                  {new Date(post.event.startsAt).getDate()}
                </Text>
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={s.title}>{post.event.title}</Text>
                <Text style={s.caption}>
                  {new Date(post.event.startsAt).toLocaleString(undefined, {
                    weekday: "short",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
            </View>
          )}
          {post.listing && (
            <View style={s.listingHead}>
              <Text style={[s.title, { flex: 1 }]}>{post.listing.title}</Text>
              <Text style={s.price}>
                {post.listing.cents ? money(post.listing.cents) : "Free"}
              </Text>
            </View>
          )}
          <Text selectable style={s.body}>
            {post.body}
          </Text>
          {post.media && <FeedMedia key={post.media.uri} media={post.media} />}
          {post.link && (
            <Touch
              accessibilityRole="link"
              accessibilityLabel={`Open ${post.link}`}
              onPress={() => {
                void Linking.openURL(post.link!).catch(() =>
                  setError("Could not open that link."),
                );
              }}
              style={s.external}
            >
              {icon("link-outline", 17, t.active)}
              <Text numberOfLines={1} style={[s.link, { flex: 1 }]}>
                {post.link}
              </Text>
              {icon("open-outline", 16, t.active)}
            </Touch>
          )}
          {!!post.location && (
            <View style={s.location}>
              {icon("location-outline", 15, t.active)}
              <Text style={s.caption}>
                {post.location}
                {post.listing ? ` · ${post.listing.delivery}` : ""}
              </Text>
            </View>
          )}
          {post.poll && (
            <View style={s.poll}>
              {post.poll.options.map((option, i) => {
                const total = post.poll!.votes.reduce((a, b) => a + b, 0),
                  percent = total
                    ? Math.round((post.poll!.votes[i] / total) * 100)
                    : 0;
                return (
                  <Touch
                    key={i}
                    accessibilityRole="radio"
                    accessibilityLabel={`${option}, ${post.poll!.votes[i]} votes`}
                    accessibilityState={{ checked: post.poll!.choice === i }}
                    aria-checked={post.poll!.choice === i}
                    onPress={() => update(post.id, (p) => votePost(p, i))}
                    style={[
                      s.pollOption,
                      post.poll!.choice === i && { borderColor: t.active },
                    ]}
                  >
                    {post.poll!.choice !== null && (
                      <View style={[s.pollFill, { width: `${percent}%` }]} />
                    )}
                    <Text style={[s.pollLabel, { flex: 1 }]}>{option}</Text>
                    {post.poll!.choice !== null && (
                      <Text style={s.pollLabel}>{percent}%</Text>
                    )}
                  </Touch>
                );
              })}
              <Text style={s.meta}>
                {post.poll.votes.reduce((a, b) => a + b, 0)}{" "}
                {post.poll.votes.reduce((a, b) => a + b, 0) === 1
                  ? "vote"
                  : "votes"}{" "}
                · tap again to remove your vote
              </Text>
            </View>
          )}
          {post.event && (
            <>
              <Text style={s.caption}>
                {post.event.audience} · Organized by {post.event.organizer}
              </Text>
              <View style={s.registerRow}>
                <Text style={s.caption}>
                  {post.event.going} going{post.sample ? " · sample event" : ""}
                </Text>
              </View>
              <Touch
                accessibilityRole="button"
                accessibilityLabel={
                  post.event.registered
                    ? `Cancel registration for ${post.event.title}`
                    : `Register for ${post.event.title}`
                }
                accessibilityState={{
                  selected: post.event.registered,
                  disabled:
                    Date.parse(post.event.startsAt) <= now &&
                    !post.event.registered,
                }}
                disabled={
                  Date.parse(post.event.startsAt) <= now &&
                  !post.event.registered
                }
                onPress={() => update(post.id, (p) => registerPost(p, now))}
                style={[
                  s.register,
                  post.event.registered && { backgroundColor: t.surface },
                ]}
              >
                {icon(
                  post.event.registered
                    ? "checkmark-circle-outline"
                    : "ticket-outline",
                  21,
                  t.text,
                )}
                <Text style={s.registerText}>
                  {post.event.registered
                    ? "Registered · tap to cancel"
                    : Date.parse(post.event.startsAt) <= now
                      ? "Event has started"
                      : "Interested? Register for the event"}
                </Text>
              </Touch>
            </>
          )}
          {post.listing && (
            <Touch
              accessibilityRole="button"
              accessibilityLabel={`Message seller about ${post.listing.title}`}
              onPress={() => openPanel("chat", post.id)}
              style={s.register}
            >
              {icon("chatbubble-outline", 20, t.text)}
              <Text style={s.registerText}>Interested? Message seller</Text>
            </Touch>
          )}
          <View style={s.actions}>
            <Touch
              accessibilityRole="button"
              accessibilityLabel={`${post.liked ? "Unlike" : "Like"} post by ${post.author}`}
              accessibilityState={{ selected: post.liked }}
              aria-pressed={post.liked}
              onPress={() => update(post.id, likePost)}
              style={s.action}
            >
              {icon(
                post.liked ? "heart" : "heart-outline",
                20,
                post.liked ? t.active : t.muted,
              )}
              <Text style={s.caption}>{post.likes || "Like"}</Text>
            </Touch>
            <Touch
              accessibilityRole="button"
              accessibilityLabel={`Comments on post by ${post.author}`}
              onPress={() => openPanel("comments", post.id)}
              style={s.action}
            >
              {icon("chatbubble-outline", 19)}
              <Text style={s.caption}>{post.comments.length || "Comment"}</Text>
            </Touch>
            <Touch
              accessibilityRole="button"
              accessibilityLabel={`Share post by ${post.author}`}
              onPress={() => {
                void share(post);
              }}
              style={s.action}
            >
              {icon("share-outline", 20)}
              <Text style={s.caption}>Share</Text>
            </Touch>
          </View>
        </View>
      ))}
      <Text style={s.end}>You’re caught up · local preview</Text>
      {composing && (
        <FeedComposer
          initialTool={composerTool}
          draft={draft}
          setDraft={setDraft}
          author={author}
          onClose={() => setComposing(false)}
          onPublish={publish}
        />
      )}
      <Modal
        visible={!!panel}
        animationType="slide"
        onRequestClose={() => setPanel(null)}
      >
        <SafeAreaView style={s.safe}>
          <KeyboardAvoidingView
            style={s.safe}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <View style={s.panelHeader}>
              <Text style={s.heading}>
                {panel?.kind === "notifications"
                  ? "Notifications"
                  : panel?.kind === "chat"
                    ? "Message seller"
                    : "Comments"}
              </Text>
              <Touch
                accessibilityRole="button"
                accessibilityLabel="Close feed details"
                onPress={() => setPanel(null)}
                style={s.iconTouch}
              >
                {icon("close", 24, t.text)}
              </Touch>
            </View>
            <ScrollView
              contentContainerStyle={s.panelContent}
              keyboardShouldPersistTaps="handled"
            >
              {panel?.kind === "notifications" ? (
                <View style={s.empty}>
                  {icon("notifications-outline", 35, t.active)}
                  <Text style={s.title}>You’re all caught up</Text>
                  <Text style={s.caption}>
                    Live replies and event reminders will appear here once
                    campus accounts are connected.
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={s.title}>
                    {selected?.listing?.title ??
                      selected?.event?.title ??
                      selected?.author}
                  </Text>
                  {panel?.kind === "chat" && (
                    <Text style={s.localNote}>
                      Local chat preview with {selected?.author}. Messages are
                      saved on this device; they are not delivered to the
                      seller.
                    </Text>
                  )}
                  {(panel?.kind === "chat"
                    ? selected?.listing?.messages
                    : selected?.comments
                  )?.map((comment) => (
                    <View key={comment.id} style={s.comment}>
                      <Text style={s.author}>{comment.author}</Text>
                      <Text style={s.body}>{comment.body}</Text>
                      <Text style={s.meta}>
                        {new Date(comment.createdAt).toLocaleString()}
                      </Text>
                    </View>
                  ))}
                  {panel?.kind === "comments" && !selected?.comments.length && (
                    <Text style={s.caption}>Start the conversation.</Text>
                  )}
                </>
              )}
            </ScrollView>
            {panel?.kind !== "notifications" && (
              <View style={s.messageRow}>
                <Input
                  accessibilityLabel={
                    panel?.kind === "chat"
                      ? "Message seller"
                      : "Write a comment"
                  }
                  value={message}
                  onChangeText={setMessage}
                  multiline
                  maxLength={1000}
                  placeholder={
                    panel?.kind === "chat"
                      ? "Is this still available?"
                      : "Add a comment…"
                  }
                  placeholderTextColor={t.muted}
                  style={s.message}
                />
                <Touch
                  accessibilityRole="button"
                  accessibilityLabel={
                    panel?.kind === "chat"
                      ? "Save preview message"
                      : "Post comment"
                  }
                  disabled={!message.trim()}
                  onPress={send}
                  style={[s.newEvent, !message.trim() && { opacity: 0.4 }]}
                >
                  {icon("arrow-up", 23, t.text)}
                </Touch>
              </View>
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}
const s = StyleSheet.create({
  root: { paddingBottom: 8 },
  safe: { flex: 1, backgroundColor: t.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: t.line,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 9, minHeight: 44 },
  wordmark: {
    fontSize: 25,
    fontWeight: "600",
    letterSpacing: -1,
    color: t.text,
  },
  iconTouch: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  composer: {
    marginHorizontal: 18,
    marginTop: 20,
    padding: 14,
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 10,
    backgroundColor: t.surface,
  },
  avatar: {
    width: 37,
    height: 37,
    borderRadius: 19,
    backgroundColor: t.raised,
    alignItems: "center",
    justifyContent: "center",
  },
  initial: { fontSize: 16, color: t.active },
  prompt: { flex: 1, color: t.muted, fontSize: 15, lineHeight: 22 },
  composerTools: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 23,
    paddingTop: 10,
    paddingBottom: 12,
  },
  filters: {
    paddingHorizontal: 18,
    gap: 20,
    borderBottomWidth: 1,
    borderColor: t.line,
  },
  filter: {
    paddingVertical: 13,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  filterActive: { borderBottomColor: t.active },
  filterText: { fontSize: 13, color: t.muted },
  search: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 4 },
  post: {
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 4,
    gap: 14,
    borderBottomWidth: 1,
    borderColor: t.line,
  },
  authorRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  author: { fontSize: 14, fontWeight: "600", color: t.text },
  meta: { fontSize: 11, color: t.muted, lineHeight: 16 },
  caption: { fontSize: 12, lineHeight: 18, color: t.muted },
  body: { fontSize: 15, lineHeight: 23, color: t.text },
  heading: { fontSize: 26, color: t.text, letterSpacing: -0.7 },
  title: {
    fontSize: 21,
    lineHeight: 28,
    fontWeight: "500",
    color: t.text,
    letterSpacing: -0.4,
  },
  eventHeading: { flexDirection: "row", alignItems: "center", gap: 15 },
  dateTile: {
    width: 62,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: t.raised,
    alignItems: "center",
    gap: 2,
  },
  month: { fontSize: 10, letterSpacing: 1.6, color: t.active },
  day: { fontSize: 27, color: t.text },
  location: { flexDirection: "row", gap: 6, alignItems: "center" },
  registerRow: { flexDirection: "row", justifyContent: "space-between" },
  register: {
    minHeight: 50,
    borderRadius: 8,
    backgroundColor: t.teal,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 9,
    paddingHorizontal: 12,
  },
  registerText: {
    fontSize: 13,
    fontWeight: "600",
    color: t.text,
    flexShrink: 1,
  },
  actions: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  action: { flexDirection: "row", alignItems: "center", gap: 7, minHeight: 48 },
  listingHead: { flexDirection: "row", gap: 14, alignItems: "center" },
  price: { fontSize: 25, color: t.active, fontWeight: "500" },
  external: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    minHeight: 44,
  },
  link: { color: t.active, fontSize: 13 },
  poll: { gap: 8 },
  pollOption: {
    minHeight: 46,
    paddingHorizontal: 12,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 6,
    overflow: "hidden",
  },
  pollFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: t.raised,
  },
  pollLabel: { fontSize: 13, color: t.text },
  eventsTitle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 22,
  },
  newEvent: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: t.teal,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: { padding: 30, gap: 12, alignItems: "center" },
  end: { textAlign: "center", fontSize: 11, color: t.muted, padding: 24 },
  error: { padding: 18, color: "#e8ad9f" },
  undo: {
    paddingHorizontal: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  panelHeader: {
    padding: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderColor: t.line,
  },
  panelContent: {
    padding: 22,
    gap: 18,
    maxWidth: 620,
    width: "100%",
    alignSelf: "center",
  },
  comment: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: t.line,
    gap: 7,
  },
  messageRow: {
    padding: 18,
    borderTopWidth: 1,
    borderColor: t.line,
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-end",
  },
  message: {
    flex: 1,
    maxHeight: 140,
    minHeight: 48,
    color: t.text,
    fontSize: 15,
    padding: 12,
    backgroundColor: t.surface,
    borderRadius: 8,
  },
  localNote: {
    color: t.muted,
    fontSize: 13,
    lineHeight: 20,
    backgroundColor: t.surface,
    padding: 16,
    borderRadius: 8,
  },
});
