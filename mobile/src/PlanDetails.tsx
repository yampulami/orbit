import React, { useState } from "react";
import { Keyboard, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Hangout, State } from "../../src/model";
import { updatePlan } from "../../src/ux";
import { validateForm } from "../../src/formValidation";
import DateField from "./DateField";
import TextInput from "./FocusInput";
import Touch from "./Touch";
import { theme as t } from "./theme";
import { useCurrentTime } from "./useCurrentTime";

type Props = {
  plan: Hangout;
  onClose: () => void;
  save: (update: (state: State) => State, feedback?: { message?: string; undo?: (state: State) => State }) => void;
};
const fields = (value: string) => {
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return { date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`, time: `${pad(date.getHours())}:${pad(date.getMinutes())}` };
};
const describe = (value: string) => new Date(value).toLocaleString(undefined, {
  month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
});
export default function PlanDetails({ plan, onClose, save }: Props) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(plan.title);
  const [date, setDate] = useState(fields(plan.date).date);
  const [time, setTime] = useState(fields(plan.date).time);
  const [attempted, setAttempted] = useState(false);
  const now = useCurrentTime();
  const issue = validateForm("hangout", { title, date, time, amount: "", email: "" });
  const error = attempted ? issue : null;
  const candidate = `${date}T${time}`;
  const changed = title.trim() !== plan.title || Date.parse(candidate) !== Date.parse(plan.date);
  function cancel() {
    setEditing(false); setAttempted(false); setTitle(plan.title);
    setDate(fields(plan.date).date); setTime(fields(plan.date).time); Keyboard.dismiss();
  }
  function commit() {
    setAttempted(true);
    if (issue) return;
    if (changed) save(current => updatePlan(current, plan.id, { title: title.trim(), date: candidate }), {
      message: "Plan updated",
      undo: current => updatePlan(current, plan.id, { title: plan.title, date: plan.date }),
    });
    Keyboard.dismiss(); onClose();
  }
  return <Modal visible presentationStyle="fullScreen" animationType="slide" onRequestClose={editing ? cancel : onClose}>
    <View style={s.backdrop}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <SafeAreaView edges={["top", "bottom"]} style={s.sheet}>
          <View style={s.row}>
            <Text style={s.heading}>{editing ? "Edit plan" : "Plan details"}</Text>
            <Touch accessibilityRole="button" accessibilityLabel={editing ? "Cancel plan edit" : "Close plan details"} onPress={editing ? cancel : onClose} style={s.close}>
              <Text style={s.text}>{editing ? "Cancel" : "Close"}</Text>
            </Touch>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 16, gap: 12 }}>
            {editing ? <>
              <Text style={s.muted}>Plan name</Text>
              <TextInput accessibilityLabel="Plan name" value={title} onChangeText={setTitle} maxLength={100} style={s.input} invalid={error?.field === "title"} accessibilityHint={error?.field === "title" ? error.message : undefined} />
              <DateField label="Plan date" mode="date" value={date} onChange={setDate} error={error?.field === "date" ? error.message : undefined} />
              <DateField label="Plan time" mode="time" value={time} onChange={setTime} error={error?.field === "time" ? error.message : undefined} />
              <View style={s.panel}>
                <Text style={s.muted}>SCHEDULE PREVIEW · DEVICE LOCAL TIME</Text>
                <Text style={s.text}>Before · {describe(plan.date)}</Text>
                <Text style={s.text}>After · {issue ? "Complete the fields to preview" : describe(candidate)}</Text>
                {!issue && <Text style={s.muted}>{Date.parse(candidate) < now ? "Will appear in Past" : "Will appear in Upcoming"}</Text>}
              </View>
            </> : <>
              <Text style={s.heading}>{plan.title}</Text>
              <Text style={s.text}>{describe(plan.date)}</Text>
              <Text style={s.muted}>{Date.parse(plan.date) < now ? "Past · start time has passed" : "Upcoming"} · Device local time</Text>
            </>}
            <View style={s.panel}>
              <Text style={s.muted}>SAVED RESPONSES · {plan.votes.length}/4</Text>
              <Text style={s.text}>{plan.votes.length ? plan.votes.join(" · ") : "No responses yet"}</Text>
              {editing && <Text style={s.muted}>Responses stay unchanged. This local demo does not notify participants.</Text>}
            </View>
            {editing && <Text style={s.muted}>Cancel discards edits. Saved changes can be undone.</Text>}
          </ScrollView>
          {!!error && <Text accessibilityRole="alert" style={s.error}>{error.message}</Text>}
          <Touch accessibilityRole="button" accessibilityLabel={editing ? "Save plan changes" : "Edit plan"} onPress={editing ? commit : () => setEditing(true)} style={s.button}>
            <Text style={s.text}>{editing ? "Save changes" : "Edit plan"}</Text>
          </Touch>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  </Modal>;
}
const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: t.background },
  sheet: { flex: 1, padding: 24, backgroundColor: t.background, maxWidth: 600, width: "100%", alignSelf: "center" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 },
  heading: { fontSize: 21, color: t.text, flexShrink: 1 },
  close: { minHeight: 44, paddingHorizontal: 8, justifyContent: "center" },
  text: { fontSize: 14, lineHeight: 21, color: t.text },
  muted: { fontSize: 12, lineHeight: 19, color: t.muted },
  panel: { paddingVertical: 16, borderTopWidth: 1, borderColor: t.line, backgroundColor: t.background, gap: 8 },
  input: { minHeight: 48, padding: 14, backgroundColor: t.raised, color: t.text, borderRadius: 14 },
  error: { color: "#e8ad9f", marginVertical: 10 },
  button: { minHeight: 48, borderRadius: 12, backgroundColor: t.teal, alignItems: "center", justifyContent: "center" },
});
