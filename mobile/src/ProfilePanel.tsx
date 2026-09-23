import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Touch from "./Touch";
import { theme as t } from "./theme";
import type { StudentProfile } from "../../src/studentProfile";
export default function ProfilePanel({
  profile,
  signedIn,
  edit,
  security,
  signOut,
}: {
  profile: StudentProfile;
  signedIn: boolean;
  edit: () => void;
  security: () => void;
  signOut: () => void;
}) {
  const interests = [...new Set([...profile.hobbies, ...profile.clubs])];
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
        Your preferences and app activity are stored on this device. They do not
        sync to other phones yet.
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
