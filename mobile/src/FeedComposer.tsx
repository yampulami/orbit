import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import ModalSafeArea from "./ModalSafeArea";
import { Ionicons } from "@expo/vector-icons";
import { randomUUID } from "expo-crypto";
import Touch from "./Touch";
import Input from "./FocusInput";
import DateField from "./DateField";
import { ChoiceField } from "./ComposerControls";
import FeedMedia, { pickFeedMedia, retainFeedMedia } from "./FeedMedia";
import {
  communities,
  createPost,
  validatePost,
  type FeedPost,
  type PostDraft,
  type PostKind,
  type Community,
} from "../../src/feed";
import { theme as t } from "./theme";
type Props = {
  initialTool?: string;
  draft: PostDraft;
  setDraft: (draft: PostDraft) => void;
  author: string;
  onClose: () => void;
  onPublish: (post: FeedPost) => void;
};
export default function FeedComposer({
  initialTool = "",
  draft: d,
  setDraft,
  author,
  onClose,
  onPublish,
}: Props) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [tools, setTools] = useState(initialTool),
    [selection, setSelection] = useState<"kind" | "community" | null>(null);
  const change = (patch: Partial<PostDraft>) => {
    setDraft({ ...d, ...patch });
    setError("");
  };
  const field = (
    label: string,
    key:
      | "title"
      | "body"
      | "organizer"
      | "audience"
      | "location"
      | "price"
      | "link",
    placeholder = "",
    multiline = false,
  ) => (
    <View style={s.field}>
      {key !== "body" && <Text style={s.label}>{label}</Text>}
      <Input
        accessibilityLabel={label}
        value={d[key]}
        onChangeText={(value) => change({ [key]: value })}
        placeholder={placeholder}
        placeholderTextColor={t.muted}
        multiline={multiline}
        maxLength={key === "body" ? 3000 : key === "link" ? 1000 : 160}
        keyboardType={key === "price" ? "decimal-pad" : "default"}
        autoCapitalize={key === "link" ? "none" : "sentences"}
        style={[s.input, multiline && s.body]}
        underlineColorAndroid="transparent"
      />
    </View>
  );
  async function pick() {
    try {
      setBusy(true);
      const media = await pickFeedMedia();
      if (media) change({ media });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not open your media library.",
      );
    } finally {
      setBusy(false);
    }
  }
  function publish() {
    const issue = validatePost(d);
    if (issue) {
      setError(issue);
      return;
    }
    try {
      const id = randomUUID();
      const post = createPost(
        { ...d, media: retainFeedMedia(d.media, id) },
        author,
        id,
      );
      onPublish(post);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save this post. Try again.",
      );
    }
  }
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <ModalSafeArea style={s.safe}>
        <KeyboardAvoidingView
          style={s.safe}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={s.header}>
            <Touch
              accessibilityRole="button"
              accessibilityLabel="Close post composer"
              onPress={onClose}
              style={s.close}
              hitSlop={8}
            >
              <Ionicons name="close" size={24} color={t.text} />
            </Touch>
            <Text style={s.heading}>
              {d.kind === "event"
                ? "New event"
                : d.kind === "marketplace"
                  ? "New listing"
                  : "New post"}
            </Text>
            <Touch
              accessibilityRole="button"
              accessibilityLabel="Publish post"
              disabled={busy || !d.body.trim()}
              onPress={publish}
              style={[s.publish, (busy || !d.body.trim()) && { opacity: 0.4 }]}
            >
              <Text style={s.publishText}>Post</Text>
            </Touch>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.content}
          >
            <View style={s.byline}>
              <View style={s.avatar}>
                <Text style={s.initial}>{author[0]?.toUpperCase()}</Text>
              </View>
              <View>
                <Text style={s.name}>{author}</Text>
                <Text style={s.caption}>Local preview</Text>
              </View>
            </View>
            <View style={s.choices}>
              <Touch
                accessibilityRole="button"
                accessibilityLabel={`Post as: ${d.kind === "post" ? "Post" : d.kind === "event" ? "Event" : "Marketplace"}`}
                accessibilityState={{ expanded: selection === "kind" }}
                onPress={() =>
                  setSelection(selection === "kind" ? null : "kind")
                }
                style={s.choice}
              >
                <Ionicons
                  name={
                    d.kind === "event"
                      ? "calendar-outline"
                      : d.kind === "marketplace"
                        ? "pricetag-outline"
                        : "document-text-outline"
                  }
                  size={15}
                  color={t.active}
                />
                <Text style={s.choiceText}>
                  {d.kind === "post"
                    ? "Post"
                    : d.kind === "event"
                      ? "Event"
                      : "Marketplace"}
                </Text>
                <Ionicons name="chevron-down" size={13} color={t.muted} />
              </Touch>
              {d.kind !== "marketplace" && (
                <Touch
                  accessibilityRole="button"
                  accessibilityLabel={`Community: ${d.community}`}
                  accessibilityState={{ expanded: selection === "community" }}
                  onPress={() =>
                    setSelection(selection === "community" ? null : "community")
                  }
                  style={s.choice}
                >
                  <Ionicons name="people-outline" size={15} color={t.active} />
                  <Text style={s.choiceText}>{d.community}</Text>
                  <Ionicons name="chevron-down" size={13} color={t.muted} />
                </Touch>
              )}
            </View>
            {selection && (
              <View
                style={s.options}
                accessibilityRole="radiogroup"
                accessibilityLabel={
                  selection === "kind" ? "Post type" : "Community"
                }
              >
                {(selection === "kind"
                  ? [
                      { value: "post", label: "Post" },
                      { value: "event", label: "Event" },
                      { value: "marketplace", label: "Marketplace" },
                    ]
                  : communities
                      .filter((x) => x !== "Marketplace")
                      .map((value) => ({ value, label: value }))
                ).map((option) => (
                  <Touch
                    key={option.value}
                    accessibilityRole="radio"
                    accessibilityLabel={option.label}
                    accessibilityState={{
                      checked:
                        (selection === "kind" ? d.kind : d.community) ===
                        option.value,
                    }}
                    aria-checked={
                      (selection === "kind" ? d.kind : d.community) ===
                      option.value
                    }
                    onPress={() => {
                      change(
                        selection === "kind"
                          ? { kind: option.value as PostKind }
                          : { community: option.value as Community },
                      );
                      setSelection(null);
                    }}
                    style={s.option}
                  >
                    <Text style={s.choiceText}>{option.label}</Text>
                    {(selection === "kind" ? d.kind : d.community) ===
                      option.value && (
                      <Ionicons name="checkmark" size={19} color={t.active} />
                    )}
                  </Touch>
                ))}
              </View>
            )}
            {d.kind !== "post" &&
              field(
                d.kind === "event" ? "Event title" : "Item name",
                "title",
                d.kind === "event"
                  ? "What’s happening?"
                  : "What are you selling?",
              )}
            {field(
              d.kind === "post"
                ? "Your post"
                : d.kind === "event"
                  ? "Description"
                  : "Item details",
              "body",
              d.kind === "post"
                ? "What’s on your mind?"
                : "What should people know?",
              true,
            )}
            {d.media && (
              <View style={{ gap: 8 }}>
                <FeedMedia media={d.media} />
                <Touch
                  accessibilityRole="button"
                  onPress={() => change({ media: undefined })}
                  style={s.remove}
                >
                  <Text style={s.link}>Remove attachment</Text>
                </Touch>
              </View>
            )}
            {d.kind === "event" && (
              <>
                <Text style={s.section}>THE DETAILS</Text>
                {field("Organizer", "organizer")}
                <DateField
                  label="Event date"
                  mode="date"
                  value={d.date}
                  onChange={(date) => change({ date })}
                />
                <DateField
                  label="Event time"
                  mode="time"
                  value={d.time}
                  onChange={(time) => change({ time })}
                />
                <Text style={s.caption}>
                  Times use your device’s time zone.
                </Text>
                <ChoiceField
                  label="Who’s it for?"
                  value={d.audience}
                  options={[
                    "Everyone on campus",
                    "Commuters",
                    "Residents",
                    "First-year students",
                    "Students in my major",
                    "Club members",
                  ].map((value) => ({ value, label: value }))}
                  onChange={(audience) => change({ audience })}
                />
              </>
            )}
            {d.kind === "marketplace" && (
              <>
                {field("Price ($)", "price", "0.00 for free")}
                <ChoiceField
                  label="Exchange"
                  value={d.delivery}
                  options={["Pickup", "Drop-off", "Either"].map((value) => ({
                    value,
                    label: value,
                  }))}
                  onChange={(delivery) =>
                    change({ delivery: delivery as PostDraft["delivery"] })
                  }
                />
              </>
            )}
            {(d.kind !== "post" || tools === "location" || !!d.location) &&
              field("Location", "location", "Enter a place — no map needed")}
            {(tools === "link" || !!d.link) &&
              field("Link", "link", "https://")}
            {d.kind === "post" && d.pollOptions && (
              <View style={s.field}>
                <Text style={s.section}>POLL OPTIONS</Text>
                {d.pollOptions.map((option, i) => (
                  <Input
                    key={i}
                    accessibilityLabel={`Poll option ${i + 1}`}
                    value={option}
                    onChangeText={(value) =>
                      change({
                        pollOptions: d.pollOptions!.map((x, n) =>
                          n === i ? value : x,
                        ),
                      })
                    }
                    maxLength={100}
                    placeholder={`Option ${i + 1}`}
                    placeholderTextColor={t.muted}
                    style={s.input}
                  />
                ))}
                <View style={s.toolRow}>
                  {d.pollOptions.length < 4 && (
                    <Touch
                      accessibilityRole="button"
                      onPress={() =>
                        change({ pollOptions: [...d.pollOptions!, ""] })
                      }
                      style={s.remove}
                    >
                      <Text style={s.link}>Add option</Text>
                    </Touch>
                  )}
                  <Touch
                    accessibilityRole="button"
                    onPress={() => change({ pollOptions: undefined })}
                    style={s.remove}
                  >
                    <Text style={s.link}>Remove poll</Text>
                  </Touch>
                </View>
              </View>
            )}
            {tools === "emoji" && (
              <View style={s.toolRow}>
                {["👋", "☕", "✨", "📚", "🎉", "💭"].map((emoji) => (
                  <Touch
                    key={emoji}
                    accessibilityRole="button"
                    accessibilityLabel={`Insert ${emoji}`}
                    style={s.icon}
                    onPress={() => change({ body: d.body + emoji })}
                  >
                    <Text style={{ fontSize: 25 }}>{emoji}</Text>
                  </Touch>
                ))}
              </View>
            )}
          </ScrollView>
          <View style={s.footer}>
            {!!error && (
              <Text accessibilityRole="alert" style={s.error}>
                {error}
              </Text>
            )}
            <View style={s.toolRow}>
              {(
                [
                  ["image-outline", "Photo or video"],
                  ["happy-outline", "Emoji"],
                  ["location-outline", "Location"],
                  ["link-outline", "Link"],
                  ...(d.kind === "post"
                    ? [["stats-chart-outline", "Poll"]]
                    : []),
                ] as const
              ).map(([icon, label]) => (
                <Touch
                  key={label}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${label.toLowerCase()}`}
                  disabled={busy}
                  onPress={() => {
                    if (label === "Photo or video") {
                      void pick();
                      return;
                    }
                    if (label === "Poll") {
                      change({
                        pollOptions: d.pollOptions ? undefined : ["", ""],
                      });
                      return;
                    }
                    setTools(
                      tools === label.toLowerCase() ? "" : label.toLowerCase(),
                    );
                  }}
                  style={s.icon}
                >
                  <Ionicons name={icon as any} size={23} color={t.active} />
                </Touch>
              ))}
              {busy && <ActivityIndicator color={t.active} />}
            </View>
            <Text style={s.caption}>Only on this device for now.</Text>
          </View>
        </KeyboardAvoidingView>
      </ModalSafeArea>
    </Modal>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: t.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingBottom: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderColor: t.line,
  },
  heading: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    color: t.text,
  },
  close: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 20,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  choiceText: { color: t.text, fontSize: 13 },
  options: { backgroundColor: t.surface, borderRadius: 8, padding: 6 },
  option: {
    minHeight: 46,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  icon: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    padding: 22,
    gap: 12,
    maxWidth: 620,
    width: "100%",
    alignSelf: "center",
  },
  byline: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    marginBottom: 8,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: t.raised,
    alignItems: "center",
    justifyContent: "center",
  },
  initial: { fontSize: 18, color: t.active },
  name: { fontSize: 15, color: t.text, fontWeight: "600" },
  caption: { fontSize: 12, lineHeight: 18, color: t.muted },
  label: { fontSize: 12, color: t.muted },
  field: { gap: 6, marginTop: 8 },
  input: {
    minHeight: 48,
    color: t.text,
    fontSize: 16,
    borderBottomWidth: 1,
    borderColor: t.line,
    paddingVertical: 10,
  },
  body: {
    minHeight: 210,
    borderBottomWidth: 0,
    textAlignVertical: "top",
    fontSize: 22,
    lineHeight: 32,
  },
  section: { fontSize: 11, letterSpacing: 1.5, color: t.active, marginTop: 12 },
  toolRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
  },
  remove: { minHeight: 44, justifyContent: "center" },
  link: { color: t.active, fontSize: 13 },
  footer: {
    paddingHorizontal: 22,
    paddingVertical: 10,
    gap: 4,
    borderTopWidth: 1,
    borderColor: t.line,
    maxWidth: 620,
    width: "100%",
    alignSelf: "center",
  },
  publish: {
    backgroundColor: t.teal,
    borderRadius: 9,
    minHeight: 40,
    minWidth: 64,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  publishText: { color: t.text, fontSize: 16, fontWeight: "600" },
  error: { color: "#e8ad9f", fontSize: 13, lineHeight: 20 },
});
