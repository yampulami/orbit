import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Touch from "./Touch";
import { theme as t } from "./theme";
import type { StudentProfile } from "../../src/studentProfile";
import type { FeedPost } from "../../src/feed";
export default function ProfilePanel({
  profile,
  posts,
  signedIn,
  edit,
  security,
  signOut,
}: {
  profile: StudentProfile;
  posts: FeedPost[];
  signedIn: boolean;
  edit: () => void;
  security: () => void;
  signOut: () => void;
}) {
  const interests = [...new Set([...profile.hobbies, ...profile.clubs])];
  const [activity, setActivity] = useState<"Posts" | "Replies">("Posts");
  const myPosts = posts.filter((post) => post.mine && !post.sample);
  const replies = posts.flatMap((post) =>
    post.comments
      .filter((comment) => comment.mine || (!signedIn && comment.author === profile.name))
      .map((comment) => ({ comment, post })),
  ).sort((a, b) => b.comment.createdAt.localeCompare(a.comment.createdAt));
  function action(
    label: string,
    detail: string,
    icon: React.ComponentProps<typeof Ionicons>["name"],
    onPress: () => void,
  ) {
    return (
      <Touch
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={s.action}
      >
        <Ionicons accessible={false} name={icon} size={22} color={t.active} />
        <View style={s.grow}>
          <Text style={s.actionTitle}>{label}</Text>
          <Text style={s.caption}>{detail}</Text>
        </View>
        <Ionicons
          accessible={false}
          name="chevron-forward"
          size={16}
          color={t.muted}
        />
      </Touch>
    );
  }
  return (
    <View>
      <View style={s.identity}>
        <View style={s.avatar}>
          <Text style={s.initial}>
            {profile.name.slice(0, 1).toUpperCase()}
          </Text>
        </View>
        <View style={s.grow}>
          <Text style={s.name}>{profile.name}</Text>
          <Text style={s.caption}>
            {signedIn ? "Signed in" : "Preview account"}
          </Text>
          {!!profile.bio?.trim() && <Text style={s.bio}>{profile.bio.trim()}</Text>}
        </View>
      </View>
      <View style={s.details}>
        {[
          { label: "Campus", value: profile.campus },
          { label: "Campus life", value: profile.lifestyle },
          {
            label: "Studies",
            value: [profile.year, profile.major].filter(Boolean).join(" · "),
          },
        ].map((row) => (
          <View key={row.label} style={s.detail}>
            <Text style={s.label}>{row.label}</Text>
            <Text style={s.value}>{row.value || "Not added"}</Text>
          </View>
        ))}
      </View>
      <Text style={s.section}>Interests</Text>
      <View style={s.interests}>
        {interests.length ? (
          interests.map((interest) => (
            <View key={interest} style={s.interest}>
              <Text style={s.caption}>{interest}</Text>
            </View>
          ))
        ) : (
          <Text style={s.caption}>
            Add a few interests to shape your suggestions.
          </Text>
        )}
      </View>
      <View style={s.activityHeader}>
        <Text style={s.section}>Activity</Text>
        <View accessibilityRole="tablist" style={s.tabs}>
          {(["Posts", "Replies"] as const).map((value) => (
            <Touch
              key={value}
              accessibilityRole="tab"
              accessibilityState={{ selected: activity === value }}
              aria-selected={activity === value}
              onPress={() => setActivity(value)}
              style={[s.tab, activity === value && s.tabActive]}
            >
              <Text style={[s.tabText, activity === value && s.tabTextActive]}>{value}</Text>
            </Touch>
          ))}
        </View>
      </View>
      <View style={s.activityList}>
        {activity === "Posts" ? (
          myPosts.length ? myPosts.map((post) => (
            <View key={post.id} style={s.activityRow}>
              <Text style={s.activityMeta}>{post.community} · {new Date(post.createdAt).toLocaleDateString()}</Text>
              <Text numberOfLines={3} style={s.activityText}>{post.event?.title ?? post.listing?.title ?? post.body}</Text>
              {(post.event?.title || post.listing?.title) && <Text numberOfLines={2} style={s.caption}>{post.body}</Text>}
            </View>
          )) : <Text style={s.caption}>Your campus posts will appear here.</Text>
        ) : replies.length ? replies.map(({ comment, post }) => (
          <View key={comment.id} style={s.activityRow}>
            <Text style={s.activityMeta}>Reply to {post.author} · {new Date(comment.createdAt).toLocaleDateString()}</Text>
            <Text numberOfLines={3} style={s.activityText}>{comment.body}</Text>
            <Text numberOfLines={1} style={s.caption}>On: {post.event?.title ?? post.listing?.title ?? post.body}</Text>
          </View>
        )) : <Text style={s.caption}>Your replies will appear here.</Text>}
      </View>
      <View style={s.actions}>
        {action(
          "Edit campus preferences",
          "Campus, studies, and interests",
          "options-outline",
          edit,
        )}
        {action(
          "Account & biometric unlock",
          signedIn
            ? "Manage access on this device"
            : "Sign in to enable biometric unlock",
          "finger-print-outline",
          security,
        )}
        {action(
          signedIn ? "Sign out" : "Leave preview",
          signedIn
            ? "Your saved preferences stay on this device"
            : "Return to sign in",
          "log-out-outline",
          signOut,
        )}
      </View>
      <Text style={s.footnote}>
        {signedIn
          ? "Your profile, posts, and replies are shared securely with people at your university."
          : "Preview activity is stored only on this device."}
      </Text>
    </View>
  );
}
const s = StyleSheet.create({
  grow: { flex: 1, gap: 5 },
  identity: {
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
    paddingVertical: 24,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: t.teal,
    alignItems: "center",
    justifyContent: "center",
  },
  initial: { color: t.cream, fontSize: 28 },
  name: { fontSize: 25, color: t.text, fontWeight: "500" },
  caption: { fontSize: 12, lineHeight: 18, color: t.muted },
  bio: { fontSize: 13, lineHeight: 19, color: t.text, marginTop: 3 },
  details: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: t.line,
    paddingVertical: 8,
  },
  detail: { flexDirection: "row", gap: 18, paddingVertical: 10 },
  label: { width: 78, fontSize: 12, color: t.muted, lineHeight: 20 },
  value: { flex: 1, fontSize: 14, color: t.text, lineHeight: 20 },
  section: { fontSize: 12, color: t.muted, marginTop: 22, marginBottom: 12 },
  interests: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  interest: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: t.surface,
  },
  actions: { marginTop: 24 },
  activityHeader: { marginTop: 22, borderTopWidth: 1, borderColor: t.line },
  tabs: { flexDirection: "row", gap: 20 },
  tab: { minHeight: 42, justifyContent: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: t.active },
  tabText: { color: t.muted, fontSize: 13 },
  tabTextActive: { color: t.text },
  activityList: { paddingTop: 4 },
  activityRow: { paddingVertical: 14, gap: 5, borderBottomWidth: 1, borderColor: t.line },
  activityMeta: { color: t.active, fontSize: 11, lineHeight: 16 },
  activityText: { color: t.text, fontSize: 14, lineHeight: 20 },
  action: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderTopWidth: 1,
    borderColor: t.line,
    paddingVertical: 15,
  },
  actionTitle: { fontSize: 14, color: t.text, fontWeight: "500" },
  footnote: { fontSize: 11, lineHeight: 18, color: t.muted, marginTop: 24 },
});
