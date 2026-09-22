import React, { useRef, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { Field, Feedback, Primary, TextAction, ui } from "./EntryUI";
import { auth } from "./authClient";

export default function PasswordRecovery({
  email: initialEmail,
  redirectTo,
  hasSession,
  close,
}: {
  email: string;
  redirectTo: string;
  hasSession: boolean;
  close: (completed?: boolean) => void;
}) {
  const [email, setEmail] = useState(initialEmail),
    [password, setPassword] = useState(""),
    [repeat, setRepeat] = useState(""),
    [sent, setSent] = useState(false),
    [done, setDone] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const pending = useRef(false),
    confirmation = useRef<TextInput>(null);
  async function submit() {
    if (pending.current) return;
    if (!hasSession && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter the email address you use for Orbit.");
      return;
    }
    if (hasSession && password.length < 8) {
      setError("Use at least 8 characters for your new password.");
      return;
    }
    if (hasSession && password !== repeat) {
      setError("The passwords don’t match yet.");
      return;
    }
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      if (!auth) throw Error("Email sign-in is unavailable. Try again later.");
      if (hasSession) {
        const { error } = await auth.auth.updateUser({ password });
        if (error) throw error;
        setPassword("");
        setRepeat("");
        setDone(true);
      } else {
        const { error } = await auth.auth.resetPasswordForEmail(
          email.trim().toLowerCase(),
          { redirectTo },
        );
        if (error) throw error;
        setSent(true);
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Couldn’t complete that request. Please try again.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <View style={{ paddingTop: 28 }}>
      <Text style={ui.eyebrow}>
        {done
          ? "PASSWORD UPDATED"
          : sent
            ? "CHECK YOUR INBOX"
            : "LET’S GET YOU BACK IN"}
      </Text>
      <Text accessibilityRole="header" style={ui.title}>
        {done
          ? "A fresh start."
          : sent
            ? "Your next step is in your inbox."
            : hasSession
              ? "Choose a new password."
              : "Forgot your password?"}
      </Text>
      <Text style={ui.body}>
        {done
          ? "Your new password is saved. Continue to your Orbit."
          : sent
            ? `If there’s an account for ${email.trim()}, we’ll send a reset link. Check spam too.`
            : hasSession
              ? "Make it unique to Orbit and easy for you to remember."
              : "We’ll send a secure reset link to your account’s email."}
      </Text>
      <Feedback error={error} />
      {!sent && !done && (
        <>
          {hasSession ? (
            <>
              <Field
                label="New password"
                value={password}
                onChangeText={setPassword}
                placeholder="At least 8 characters"
                secureTextEntry
                textContentType="newPassword"
                autoComplete="new-password"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!busy}
                returnKeyType="next"
                onSubmitEditing={() => confirmation.current?.focus()}
              />
              <Field
                ref={confirmation}
                label="Confirm new password"
                value={repeat}
                onChangeText={setRepeat}
                placeholder="Enter it again"
                secureTextEntry
                textContentType="newPassword"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!busy}
                returnKeyType="go"
                onSubmitEditing={() => void submit()}
              />
            </>
          ) : (
            <Field
              label="Email address"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              editable={!busy}
              returnKeyType="go"
              onSubmitEditing={() => void submit()}
            />
          )}
          <View style={{ marginTop: 26 }}>
            <Primary
              label={hasSession ? "Save new password" : "Send reset link"}
              busy={busy}
              onPress={() => void submit()}
            />
          </View>
        </>
      )}
      {done ? (
        <View style={{ marginTop: 26 }}>
          <Primary label="Continue to Orbit" onPress={() => close(true)} />
        </View>
      ) : (
        <TextAction
          disabled={busy}
          label={hasSession ? "Cancel and sign out" : "Back to sign in"}
          onPress={() => close(false)}
        />
      )}
    </View>
  );
}
