import React, { useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  lifestyles,
  years,
  hobbies,
  clubInterests,
  toggleInterest,
  type StudentProfile,
} from "../../src/studentProfile";
import Touch from "./Touch";
import StepMotion from "./StepMotion";
import { Brand, Field, Feedback, Primary, ui } from "./EntryUI";
import { theme as t } from "./theme";

const stages = ["You", "Studies", "Interests", "Review"];
const titles = [
  "Start with you.",
  "Your academic life.",
  "What draws you in?",
  "Your place in Orbit.",
];
const descriptions = [
  "A name, a campus, a little context.",
  "Make room for the people in your year and field.",
  "Choose what you enjoy. There’s no right number.",
  "A quick look before you settle in.",
];
const livingIcons = ["bed-outline", "train-outline", "home-outline"] as const;
const livingDetails = [
  "Living where it happens",
  "Making the most of the gaps",
  "Nearby, with your own routine",
];

export default function Onboarding({
  initial,
  save,
  finish,
  cancel,
  preview,
}: {
  initial: StudentProfile;
  save: (p: StudentProfile) => Promise<void>;
  finish: (p: StudentProfile) => void;
  cancel: () => void;
  preview: boolean;
}) {
  const [profile, setProfile] = useState(initial),
    [step, setStep] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [clubsOpen, setClubsOpen] = useState(initial.clubs.length > 0),
    [reviewEdit, setReviewEdit] = useState(false);
  const submitting = useRef(false),
    scroll = useRef<ScrollView>(null),
    nameInput = useRef<TextInput>(null),
    campusInput = useRef<TextInput>(null);
  function patch(update: Partial<StudentProfile>) {
    setProfile((p) => ({ ...p, ...update }));
    setError("");
  }
  function go(value: number) {
    if (submitting.current) return;
    Keyboard.dismiss();
    setStep(value);
    setError("");
    scroll.current?.scrollTo({ y: 0, animated: false });
  }
  async function next() {
    if (submitting.current) return;
    if (!profile.name.trim()) {
      go(0);
      setError("Add your first name to continue.");
      nameInput.current?.focus();
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError("");
    Keyboard.dismiss();
    const nextProfile = {
      ...profile,
      name: profile.name.trim(),
      campus: profile.campus.trim(),
      major: profile.major.trim(),
      completed: initial.completed || step === 3,
    };
    try {
      if (!initial.completed || step === 3) await save(nextProfile);
      setProfile(nextProfile);
      if (step === 3) finish(nextProfile);
      else {
        setStep(reviewEdit ? 3 : step + 1);
        setReviewEdit(false);
        scroll.current?.scrollTo({ y: 0, animated: false });
      }
    } catch {
      setError(
        "Your answers are still here. We couldn’t save them — please try again.",
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  function chip(
    label: string,
    selected: boolean,
    onPress: () => void,
    multiple = false,
  ) {
    return (
      <Touch
        key={label}
        disabled={busy}
        accessibilityRole={multiple ? "checkbox" : "radio"}
        accessibilityState={{ checked: selected }}
        aria-checked={selected}
        accessibilityLabel={label}
        onPress={onPress}
        style={[s.chip, selected && s.chipSelected]}
      >
        <Text style={[s.chipText, selected && { color: t.text }]}>{label}</Text>
        <View style={{ width: 15 }}>
          {selected && (
            <Ionicons
              accessible={false}
              name="checkmark"
              size={15}
              color={t.active}
            />
          )}
        </View>
      </Touch>
    );
  }
  function review(label: string, value: string, target: number) {
    return (
      <Touch
        accessibilityRole="button"
        accessibilityLabel={`Edit ${label}`}
        onPress={() => {
          go(target);
          setReviewEdit(true);
        }}
        style={s.reviewRow}
      >
        <View style={{ flex: 1, gap: 5 }}>
          <Text style={ui.caption}>{label}</Text>
          <Text style={s.reviewValue}>{value || "Not added"}</Text>
        </View>
        <Ionicons
          accessible={false}
          name="pencil-outline"
          size={17}
          color={t.muted}
        />
      </Touch>
    );
  }
  return (
    <SafeAreaView style={ui.safe}>
      <KeyboardAvoidingView
        style={ui.frame}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={s.header}>
          <Touch
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={
              reviewEdit
                ? "Back to review"
                : step
                  ? "Previous step"
                  : "Leave setup"
            }
            onPress={() => {
              if (reviewEdit) {
                go(3);
                setReviewEdit(false);
              } else if (step) go(step - 1);
              else cancel();
            }}
            style={s.back}
          >
            <Ionicons
              accessible={false}
              name="arrow-back"
              size={21}
              color={t.text}
            />
          </Touch>
          <Brand />
          <Text style={ui.caption}>{step + 1} of 4</Text>
        </View>
        <View
          accessibilityRole="progressbar"
          accessibilityLabel="Setup progress"
          accessibilityValue={{
            min: 1,
            max: 4,
            now: step + 1,
            text: stages[step],
          }}
          style={s.progress}
        >
          {stages.map((label, i) => (
            <View key={label} style={{ flex: 1, gap: 8 }}>
              <View
                style={[
                  s.track,
                  { backgroundColor: i <= step ? t.active : t.line },
                ]}
              />
              <Text style={[s.stepLabel, i === step && { color: t.text }]}>
                {label}
              </Text>
            </View>
          ))}
        </View>
        <StepMotion step={step}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            ref={scroll}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={s.content}
          >
            <Text style={ui.eyebrow}>
              {preview
                ? "PREVIEW SETUP"
                : initial.completed
                  ? "YOUR PREFERENCES"
                  : "A LITTLE INTRODUCTION"}
            </Text>
            <Text accessibilityRole="header" style={ui.title}>
              {titles[step]}
            </Text>
            <Text style={ui.body}>{descriptions[step]}</Text>
            {step === 0 && (
              <>
                <Field
                  ref={nameInput}
                  label="First name"
                  value={profile.name}
                  onChangeText={(name) => patch({ name })}
                  placeholder="Your first name"
                  maxLength={100}
                  textContentType="givenName"
                  autoComplete="given-name"
                  returnKeyType="next"
                  onSubmitEditing={() => campusInput.current?.focus()}
                  invalid={!!error && !profile.name.trim()}
                  editable={!busy}
                />
                {!!error && !profile.name.trim() && <Feedback error={error} />}
                <Field
                  ref={campusInput}
                  label="College or university · optional"
                  value={profile.campus}
                  onChangeText={(campus) => patch({ campus })}
                  placeholder="Where do you study?"
                  maxLength={100}
                  returnKeyType="done"
                  editable={!busy}
                />
                <Text style={s.section}>
                  Campus life <Text style={ui.caption}>· optional</Text>
                </Text>
                <View style={s.livingList}>
                  {lifestyles.map((item, i) => (
                    <Touch
                      key={item}
                      disabled={busy}
                      accessibilityRole="radio"
                      accessibilityLabel={item}
                      accessibilityState={{
                        checked: profile.lifestyle === item,
                      }}
                      aria-checked={profile.lifestyle === item}
                      onPress={() =>
                        patch({
                          lifestyle: profile.lifestyle === item ? "" : item,
                        })
                      }
                      style={[
                        s.livingRow,
                        profile.lifestyle === item && s.livingSelected,
                      ]}
                    >
                      <Ionicons
                        accessible={false}
                        name={livingIcons[i]}
                        size={22}
                        color={profile.lifestyle === item ? t.active : t.muted}
                      />
                      <View style={{ flex: 1, gap: 3 }}>
                        <Text style={s.optionTitle}>{item}</Text>
                        <Text style={ui.caption}>{livingDetails[i]}</Text>
                      </View>
                      <View
                        style={[
                          s.radio,
                          profile.lifestyle === item && {
                            borderColor: t.active,
                          },
                        ]}
                      >
                        {profile.lifestyle === item && (
                          <View style={s.radioDot} />
                        )}
                      </View>
                    </Touch>
                  ))}
                </View>
              </>
            )}
            {step === 1 && (
              <>
                <Text style={s.section}>
                  Year <Text style={ui.caption}>· optional</Text>
                </Text>
                <View style={s.yearGrid}>
                  {years.map((year) => (
                    <View key={year} style={{ width: "48%" }}>
                      {chip(year, profile.year === year, () =>
                        patch({ year: profile.year === year ? "" : year }),
                      )}
                    </View>
                  ))}
                </View>
                <Field
                  label="Major · optional"
                  value={profile.major}
                  onChangeText={(major) => patch({ major })}
                  placeholder="Your field, or still exploring"
                  maxLength={100}
                  editable={!busy}
                />
                <View style={s.aside}>
                  <Ionicons
                    accessible={false}
                    name="sparkles-outline"
                    size={20}
                    color={t.active}
                  />
                  <Text style={[ui.caption, { flex: 1 }]}>
                    Still figuring it out? Leave these open. You can update them
                    from your profile.
                  </Text>
                </View>
              </>
            )}
            {step === 2 && (
              <>
                <View style={s.sectionRow}>
                  <Text style={s.section}>Outside the classroom</Text>
                  <Text style={ui.caption}>
                    {profile.hobbies.length} selected
                  </Text>
                </View>
                <View style={s.chips}>
                  {hobbies.map((h) =>
                    chip(
                      h,
                      profile.hobbies.includes(h),
                      () =>
                        patch({ hobbies: toggleInterest(profile.hobbies, h) }),
                      true,
                    ),
                  )}
                </View>
                <Touch
                  accessibilityRole="button"
                  accessibilityLabel="Clubs you’d explore"
                  accessibilityState={{ expanded: clubsOpen }}
                  aria-expanded={clubsOpen}
                  onPress={() => setClubsOpen(!clubsOpen)}
                  style={s.accordion}
                >
                  <View style={{ gap: 5 }}>
                    <Text style={s.optionTitle}>Clubs you’d explore</Text>
                    <Text style={ui.caption}>
                      {profile.clubs.length
                        ? `${profile.clubs.length} selected`
                        : "Optional · find a shared interest"}
                    </Text>
                  </View>
                  <Ionicons
                    accessible={false}
                    name={clubsOpen ? "chevron-up" : "chevron-down"}
                    size={19}
                    color={t.active}
                  />
                </Touch>
                {clubsOpen && (
                  <View style={s.chips}>
                    {clubInterests.map((c) =>
                      chip(
                        c,
                        profile.clubs.includes(c),
                        () =>
                          patch({ clubs: toggleInterest(profile.clubs, c) }),
                        true,
                      ),
                    )}
                  </View>
                )}
                <Text style={[ui.caption, { marginTop: 22 }]}>
                  Choose freely. This won’t join any clubs or share your
                  details.
                </Text>
              </>
            )}
            {step === 3 && (
              <>
                <View style={s.identity}>
                  <View style={s.avatar}>
                    <Text style={s.initial}>
                      {profile.name.slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.name}>{profile.name}</Text>
                    <Text style={ui.caption}>
                      {profile.campus || "Campus life, on your terms"}
                    </Text>
                  </View>
                </View>
                {review(
                  "You & your campus",
                  [profile.name, profile.campus, profile.lifestyle]
                    .filter(Boolean)
                    .join(" · "),
                  0,
                )}
                {review(
                  "Studies",
                  [profile.year, profile.major].filter(Boolean).join(" · "),
                  1,
                )}
                {review(
                  "Interests",
                  [...profile.hobbies, ...profile.clubs].join(" · "),
                  2,
                )}
                <View style={s.aside}>
                  <Ionicons
                    accessible={false}
                    name={
                      profile.lifestyle === "Commuter"
                        ? "train-outline"
                        : "people-outline"
                    }
                    size={23}
                    color={t.active}
                  />
                  <View style={{ flex: 1, gap: 5 }}>
                    <Text style={s.optionTitle}>
                      {profile.lifestyle === "Commuter"
                        ? "Make the time between classes count."
                        : "Start with your circle."}
                    </Text>
                    <Text style={ui.caption}>
                      {profile.lifestyle === "Commuter"
                        ? "Explore campus plans and find something worth staying for."
                        : "Explore shared plans, everyday tasks, and campus life."}
                    </Text>
                  </View>
                </View>
                <Text style={ui.caption}>
                  Preferences are saved on this device. Campus listings in the
                  preview are samples.
                </Text>
              </>
            )}
            <Feedback error={profile.name.trim() ? error : undefined} />
          </ScrollView>
        </StepMotion>
        <View style={s.footer}>
          <Primary
            busy={busy}
            label={
              step === 3
                ? initial.completed
                  ? "Save preferences"
                  : "Enter Orbit"
                : reviewEdit
                  ? "Back to review"
                  : "Continue"
            }
            onPress={() => void next()}
          />
          <Text style={s.footerNote}>
            {step === 0
              ? "Just your first name is required."
              : step === 3
                ? "You can change these anytime in your profile."
                : "Everything here is optional. Continue whenever you’re ready."}
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  header: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  back: { minHeight: 44, minWidth: 40, justifyContent: "center" },
  progress: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 26,
    paddingTop: 8,
  },
  track: { height: 2 },
  stepLabel: { color: t.muted, fontSize: 10 },
  content: { paddingHorizontal: 26, paddingTop: 30, paddingBottom: 20 },
  section: {
    color: t.text,
    fontSize: 14,
    fontWeight: "500",
    marginTop: 25,
    marginBottom: 12,
  },
  livingList: { gap: 4 },
  livingRow: {
    minHeight: 67,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 13,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "transparent",
  },
  livingSelected: { backgroundColor: t.surface, borderColor: t.line },
  optionTitle: { color: t.text, fontSize: 14, fontWeight: "500" },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#577078",
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: t.active },
  yearGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  chip: {
    minHeight: 46,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 9,
  },
  chipSelected: { backgroundColor: t.surface, borderColor: t.active },
  chipText: { color: t.muted, fontSize: 14 },
  aside: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 13,
    paddingVertical: 24,
  },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  accordion: {
    paddingVertical: 21,
    marginTop: 22,
    borderTopWidth: 1,
    borderColor: t.line,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  identity: {
    flexDirection: "row",
    gap: 15,
    alignItems: "center",
    paddingVertical: 25,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: t.teal,
    alignItems: "center",
    justifyContent: "center",
  },
  initial: { color: t.cream, fontSize: 25 },
  name: { fontSize: 23, color: t.text, marginBottom: 5 },
  reviewRow: {
    borderTopWidth: 1,
    borderColor: t.line,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  reviewValue: { color: t.text, fontSize: 14, lineHeight: 21 },
  footer: {
    paddingHorizontal: 26,
    paddingTop: 12,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderColor: t.line,
  },
  footerNote: {
    color: t.muted,
    fontSize: 10,
    lineHeight: 16,
    textAlign: "center",
    marginTop: 10,
  },
});
