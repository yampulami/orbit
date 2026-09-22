import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  profileSuggestions,
  type StudentProfile,
} from "../../src/studentProfile";
import StepMotion from "./StepMotion";
import Touch from "./Touch";
import { ui } from "./EntryUI";
import { theme as t } from "./theme";

export function SetupProgress({
  step,
  labels,
}: {
  step: number;
  labels: string[];
}) {
  const value = useRef(new Animated.Value((step + 1) / labels.length)).current;
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduced)
      .catch(() => {});
    const listener = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );
    return () => listener.remove();
  }, []);
  useEffect(() => {
    const target = (step + 1) / labels.length;
    value.stopAnimation();
    if (reduced) {
      value.setValue(target);
      return;
    }
    const animation = Animated.timing(value, {
      toValue: target,
      duration: 320,
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [step, labels.length, reduced, value]);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="Setup progress"
      accessibilityValue={{
        min: 1,
        max: labels.length,
        now: step + 1,
        text: labels[step],
      }}
      style={s.progress}
    >
      <View style={s.track}>
        <Animated.View
          style={[
            s.fill,
            {
              width: value.interpolate({
                inputRange: [0, 1],
                outputRange: ["0%", "100%"],
              }),
            },
          ]}
        />
      </View>
      <View style={s.labels}>
        {labels.map((label, i) => (
          <Text key={label} style={[s.step, i === step && { color: t.text }]}>
            {i < step ? "✓ " : ""}
            {label}
          </Text>
        ))}
      </View>
    </View>
  );
}
export function SignupChecks({
  email,
  password,
}: {
  email: string;
  password: string;
}) {
  const checks = [
    {
      label: "Email format",
      done: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()),
    },
    { label: "8+ characters", done: password.length >= 8 },
  ];
  return (
    <View accessibilityLiveRegion="polite" style={s.checks}>
      {checks.map((c) => (
        <View
          key={c.label}
          style={s.check}
          accessible
          accessibilityLabel={`${c.label}: ${c.done ? "complete" : "not complete"}`}
        >
          <Ionicons
            accessible={false}
            name={c.done ? "checkmark-circle" : "ellipse-outline"}
            color={c.done ? t.active : t.muted}
            size={16}
          />
          <Text style={[ui.caption, c.done && { color: t.active }]}>
            {c.label}
          </Text>
        </View>
      ))}
    </View>
  );
}
export function YourOrbitPreview({ profile }: { profile: StudentProfile }) {
  const [active, setActive] = useState(1);
  const suggestions = profileSuggestions(profile),
    item = suggestions[active];
  return (
    <View style={s.preview}>
      <View style={s.previewTop}>
        <Text style={s.overline}>YOUR HOME, TAKING SHAPE</Text>
        <View style={s.switcher}>
          {["Plans", "Clubs"].map((label, i) => (
            <Touch
              key={label}
              accessibilityRole="tab"
              accessibilityLabel={`${label} preview`}
              accessibilityState={{ selected: active === i }}
              aria-selected={active === i}
              onPress={() => setActive(i)}
              style={[s.switch, active === i && { backgroundColor: t.raised }]}
            >
              <Text style={[ui.caption, active === i && { color: t.text }]}>
                {label}
              </Text>
            </Touch>
          ))}
        </View>
      </View>
      <View style={{ minHeight: 84 }}>
        <StepMotion step={`${active}:${item.title}:${item.detail}`}>
          <View style={s.previewRow}>
            <Ionicons
              accessible={false}
              name={active ? "people-outline" : "calendar-outline"}
              size={25}
              color={t.active}
            />
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={s.previewTitle}>{item.title}</Text>
              <Text style={ui.caption}>{item.detail}</Text>
            </View>
          </View>
        </StepMotion>
      </View>
      <Text style={s.note}>
        Suggestions update with your choices. Club listings are a preview.
      </Text>
    </View>
  );
}
const s = StyleSheet.create({
  progress: { paddingHorizontal: 26, paddingTop: 8, gap: 9 },
  track: {
    height: 3,
    backgroundColor: t.line,
    borderRadius: 2,
    overflow: "hidden",
  },
  fill: { height: 3, backgroundColor: t.active },
  labels: { flexDirection: "row", justifyContent: "space-between" },
  step: { fontSize: 10, color: t.muted },
  checks: { flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: 12 },
  check: { flexDirection: "row", gap: 6, alignItems: "center" },
  preview: {
    marginTop: 22,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: t.line,
    paddingVertical: 12,
  },
  previewTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  overline: { fontSize: 8, letterSpacing: 1, color: t.active, flex: 1 },
  switcher: { flexDirection: "row" },
  switch: {
    minHeight: 40,
    paddingHorizontal: 10,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  previewRow: {
    flexDirection: "row",
    gap: 13,
    paddingVertical: 18,
    alignItems: "center",
  },
  previewTitle: {
    fontSize: 16,
    lineHeight: 22,
    color: t.text,
    fontWeight: "500",
  },
  note: { fontSize: 10, lineHeight: 16, color: t.muted },
});
