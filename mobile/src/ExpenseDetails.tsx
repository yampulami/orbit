import { amountValid, validateForm } from "../../src/formValidation";
import TextInput from "./FocusInput";
import React, { useEffect, useState } from "react";
import {
  Modal,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { balances, members, money, shares, type State } from "../../src/model";
import { updateExpense } from "../../src/ux";
import Touch from "./Touch";
import { theme as t } from "./theme";

type Props = {
  state: State;
  spaceId: string;
  id: string;
  onClose: () => void;
  save: (
    update: (state: State) => State,
    feedback?: { message?: string; undo?: (state: State) => State },
  ) => void;
};
export default function ExpenseDetails({
  state,
  spaceId,
  id,
  onClose,
  save,
}: Props) {
  const space = state.spaces.find((s) => s.id === spaceId)!;
  const expense = space.expenses.find((e) => e.id === id)!;
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(expense.title);
  const [amount, setAmount] = useState((expense.cents / 100).toFixed(2));
  const [payer, setPayer] = useState(expense.payer);
  const [error, setError] = useState("");
  const [attempted, setAttempted] = useState(false);
  const issue = attempted
    ? validateForm("expense", { title, amount, date: "", time: "", email: "" })
    : null;
  useEffect(() => {
    if (attempted) setError(issue?.message ?? "");
  }, [attempted, title, amount]);
  const valid = amountValid(amount);
  const candidate = {
    ...expense,
    title: title.trim(),
    payer,
    cents: valid ? Math.round(Number(amount) * 100) : expense.cents,
  };
  const shown = editing ? candidate : expense;
  const before = balances(space.expenses).You;
  const after = balances(
    space.expenses.map((e) => (e.id === id ? candidate : e)),
  ).You;
  const balanceLabel = (value: number) =>
    value === 0
      ? "Settled · $0.00"
      : `${value > 0 ? "Owed to you" : "You owe"} ${money(Math.abs(value))}`;
  function commit() {
    setAttempted(true);
    const problem = validateForm("expense", {
      title,
      amount,
      date: "",
      time: "",
      email: "",
    });
    if (problem) {
      setError(problem.message);
      return;
    }
    save((current) => updateExpense(current, spaceId, candidate), {
      message: "Expense updated",
      undo: (current) => updateExpense(current, spaceId, expense),
    });
    Keyboard.dismiss();
    onClose();
  }
  function cancelEdit() {
    setAttempted(false);
    setEditing(false);
    setTitle(expense.title);
    setAmount((expense.cents / 100).toFixed(2));
    setPayer(expense.payer);
    setError("");
    Keyboard.dismiss();
  }
  return (
    <Modal
      visible
      presentationStyle="fullScreen"
      animationType="slide"
      onRequestClose={() => (editing ? cancelEdit() : onClose())}
    >
      <View style={s.backdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={s.keyboard}
        >
          <SafeAreaView edges={["top", "bottom"]} style={s.sheet}>
            <View style={s.row}>
              <Text style={s.heading}>
                {editing ? "Edit expense" : "Expense details"}
              </Text>
              <Touch
                accessibilityRole="button"
                accessibilityLabel={
                  editing ? "Cancel expense edit" : "Close expense details"
                }
                onPress={() => (editing ? cancelEdit() : onClose())}
                style={s.close}
              >
                <Text style={s.text}>{editing ? "Cancel" : "Close"}</Text>
              </Touch>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 18 }}
            >
              <Text style={s.muted}>{space.name}</Text>
              {editing ? (
                <>
                  <Text style={s.label}>Expense name</Text>
                  <TextInput
                    accessibilityLabel="Expense name"
                    invalid={issue?.field === "title"}
                    accessibilityHint={
                      issue?.field === "title" ? issue.message : undefined
                    }
                    value={title}
                    onChangeText={(value) => {
                      setTitle(value);
                    }}
                    maxLength={100}
                    style={s.input}
                  />
                  <Text style={s.label}>Amount ($)</Text>
                  <TextInput
                    accessibilityLabel="Expense amount"
                    invalid={issue?.field === "amount"}
                    accessibilityHint={
                      issue?.field === "amount" ? issue.message : undefined
                    }
                    value={amount}
                    onChangeText={(value) => {
                      setAmount(value);
                    }}
                    keyboardType="decimal-pad"
                    keyboardAppearance="dark"
                    style={s.input}
                  />
                  <Text style={s.label}>Paid by</Text>
                  <View style={s.choices}>
                    {members.map((member) => (
                      <Touch
                        key={member}
                        accessibilityRole="radio"
                        accessibilityLabel={`Paid by ${member}`}
                        accessibilityState={{ checked: payer === member }}
                        onPress={() => setPayer(member)}
                        style={[
                          s.choice,
                          payer === member && { backgroundColor: t.teal },
                        ]}
                      >
                        <Text style={s.text}>{member}</Text>
                      </Touch>
                    ))}
                  </View>
                </>
              ) : (
                <>
                  <Text style={[s.heading, { marginTop: 18 }]}>
                    {expense.title}
                  </Text>
                  <Text style={s.total}>{money(expense.cents)}</Text>
                  <Text style={s.muted}>
                    Paid by {expense.payer} · split equally
                  </Text>
                </>
              )}
              {(!editing || valid) && (
                <View style={s.panel}>
                  <Text style={s.label}>
                    {editing
                      ? "PREVIEW · EACH PERSON’S SHARE"
                      : "EACH PERSON’S SHARE"}
                  </Text>
                  {shares(shown.cents, members.length).map((cents, index) => (
                    <View style={s.row} key={members[index]}>
                      <Text style={s.text}>{members[index]}</Text>
                      <Text style={s.number}>{money(cents)}</Text>
                    </View>
                  ))}
                  <Text style={s.muted}>
                    Any leftover cents go in the roommate order shown.
                  </Text>
                </View>
              )}
              {editing && valid && (
                <View style={s.panel}>
                  <Text style={s.label}>YOUR TOTAL ROOM BALANCE</Text>
                  <Text style={s.muted}>Before · {balanceLabel(before)}</Text>
                  <Text style={s.text}>After · {balanceLabel(after)}</Text>
                  <Text style={s.muted}>
                    Includes every expense in this space.
                  </Text>
                </View>
              )}
            </ScrollView>
            <View style={s.footer}>
              {!!error && (
                <Text accessibilityRole="alert" style={{ color: "#e8ad9f" }}>
                  {error}
                </Text>
              )}
              <Text style={s.muted}>
                {editing
                  ? "Cancel discards these edits. Saved corrections can be undone."
                  : "Stored on this device. No payments are sent."}
              </Text>
              <Touch
                accessibilityRole="button"
                accessibilityLabel={
                  editing ? "Save expense changes" : "Edit expense"
                }
                onPress={() => (editing ? commit() : setEditing(true))}
                style={s.button}
              >
                <Text style={s.text}>
                  {editing ? "Save changes" : "Edit expense"}
                </Text>
              </Touch>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
const s = StyleSheet.create({
  backdrop: {
    flex: 1,

    backgroundColor: t.background,
  },
  keyboard: { flex: 1 },
  sheet: {
    flex: 1,
    padding: 24,
    maxWidth: 600,
    width: "100%",
    alignSelf: "center",
    backgroundColor: t.background,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  heading: { fontSize: 21, color: t.text },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  close: { minHeight: 44, justifyContent: "center", paddingHorizontal: 8 },
  text: { color: t.text, fontSize: 14 },
  muted: { color: t.muted, fontSize: 12, lineHeight: 19 },
  label: { color: t.muted, fontSize: 11, marginTop: 16, marginBottom: 8 },
  total: {
    color: t.text,
    fontSize: 36,
    fontVariant: ["tabular-nums"],
    marginVertical: 14,
  },
  number: {
    color: t.text,
    fontSize: 16,
    fontVariant: ["tabular-nums"],
    textAlign: "right",
  },
  panel: {
    marginTop: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderColor: t.line,
    backgroundColor: t.background,
    gap: 5,
  },
  input: {
    color: t.text,
    backgroundColor: t.surface,
    padding: 14,
    borderRadius: 12,
    minHeight: 48,
  },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: {
    minHeight: 44,
    paddingHorizontal: 15,
    justifyContent: "center",
    borderRadius: 24,
    backgroundColor: t.raised,
  },
  footer: { borderTopWidth: 1, borderColor: t.line, paddingTop: 12, gap: 10 },
  button: {
    minHeight: 48,
    backgroundColor: t.teal,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
