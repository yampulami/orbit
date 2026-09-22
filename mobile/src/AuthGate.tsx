import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
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
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";
import * as Linking from "expo-linking";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import type { Session } from "@supabase/supabase-js";
import {
  emptyProfile,
  validProfile,
  type StudentProfile,
} from "../../src/studentProfile";
import {
  credentialError,
  parseEmailCallback,
  authErrorMessage,
} from "../../src/authFlow";
import { auth } from "./authClient";
import { Brand, Field, Feedback, Primary, TextAction, ui } from "./EntryUI";
import { SignupChecks } from "./EntryExperience";
import Touch from "./Touch";
import StepMotion from "./StepMotion";
import PasswordRecovery from "./PasswordRecovery";
import Onboarding from "./Onboarding";
import { theme as t } from "./theme";

export type AccountControls = {
  accountId?: string;
  profile: StudentProfile;
  editPreferences: () => void;
  signOut: () => void;
  security: () => void;
};
const profileKey = (id: string) => `orbit-profile-${id}`;
const lockKey = (id: string) => `orbit-lock-${id}`;
const confirmationUrl = Linking.createURL("auth/confirmed");
export default function AuthGate({
  children,
}: {
  children: (controls: AccountControls) => React.ReactNode;
}) {
  const incomingUrl = Linking.useURL();
  const passwordInput = useRef<TextInput>(null);
  const [recovery, setRecovery] = useState<"request" | "update" | null>(null);
  const [session, setSession] = useState<Session | null>(null),
    [guest, setGuest] = useState(false),
    [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<StudentProfile | null>(null),
    [editing, setEditing] = useState(false),
    [locked, setLocked] = useState(true),
    [lockEnabled, setLockEnabled] = useState(false);
  const [security, setSecurity] = useState(false),
    [biometric, setBiometric] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [authMode, setAuthMode] = useState<"signin" | "signup">("signin"),
    [confirmation, setConfirmation] = useState(false),
    [confirmed, setConfirmed] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [cooldown, setCooldown] = useState(0),
    [retry, setRetry] = useState(0);
  const prompting = useRef(false),
    operation = useRef(false),
    generation = useRef(0);
  const currentId = useRef<string | null>(null);
  const credentialEntry = useRef(false);
  const id = session?.user.id ?? "preview";
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(
      () => setCooldown((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => clearTimeout(timer);
  }, [cooldown]);
  useEffect(() => {
    if (!incomingUrl) return;
    let cancelled = false;
    async function verifyLink() {
      const callback = parseEmailCallback(incomingUrl!);
      if (callback.kind === "unrelated") return;
      // Tokens are consumed in memory; keep them out of copied browser URLs.
      if (
        Platform.OS === "web" &&
        typeof window !== "undefined" &&
        window.location.hash
      ) {
        window.history.replaceState(
          null,
          "",
          window.location.pathname + window.location.search,
        );
      }
      setConfirmation(false);
      setConfirmed(false);
      setAuthMode("signin");
      setNotice("");
      if (callback.kind === "invalid") {
        setError(
          "This confirmation link has expired or is invalid. Request a fresh email below.",
        );
        setConfirmation(true);
        return;
      }
      if (callback.kind !== "verify" || !auth) {
        setNotice("If you confirmed your email, sign in below to continue.");
        return;
      }
      const { data, error } = await auth.auth.getUser(callback.accessToken);
      if (cancelled) return;
      if (error || !data.user?.email_confirmed_at) {
        setError(
          "We couldn’t verify this link. Sign in or request a fresh confirmation email.",
        );
        return;
      }
      if (callback.recovery) {
        const refreshToken = callback.refreshToken;
        if (!refreshToken) {
          setError("This reset link is incomplete. Request a new one.");
          return;
        }
        setRecovery("update");
        const { error: sessionError } = await auth.auth.setSession({
          access_token: callback.accessToken,
          refresh_token: refreshToken,
        });
        if (sessionError) {
          setRecovery("request");
          setError("This reset link has expired. Request a new one.");
        }
        return;
      }
      setEmail(data.user.email || "");
      setConfirmed(true);
      setError("");
      setNotice("Email verified. You’re ready to sign in.");
    }
    void verifyLink().catch(() => {
      if (!cancelled)
        setError(
          "Couldn’t check the confirmation link. Please try signing in.",
        );
    });
    return () => {
      cancelled = true;
    };
  }, [incomingUrl]);
  useEffect(() => {
    if (
      Platform.OS === "web" ||
      (Platform.OS === "ios" && Constants.appOwnership === "expo")
    )
      return;
    Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ])
      .then(([hardware, enrolled, types]) => {
        if (hardware && enrolled)
          setBiometric(
            Platform.OS === "ios" &&
              types.includes(
                LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
              )
              ? "Face ID"
              : Platform.OS === "ios"
                ? "Touch ID"
                : "biometrics",
          );
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    let alive = true;
    async function accept(next: Session | null, credentialReentry = false) {
      if (!alive) return;
      if (next && next.user.id === currentId.current) {
        setSession(next);
        return;
      }
      const version = ++generation.current;
      currentId.current = next?.user.id ?? null;
      setLoading(true);
      setLocked(true);
      setProfile(null);
      setSession(next);
      setGuest(false);
      setError("");
      setSecurity(false);
      try {
        if (next) {
          const [raw, preference] = await Promise.all([
            AsyncStorage.getItem(profileKey(next.user.id)),
            Platform.OS === "web"
              ? Promise.resolve(null)
              : SecureStore.getItemAsync(lockKey(next.user.id)),
          ]);
          const p = raw ? JSON.parse(raw) : emptyProfile();
          if (!validProfile(p))
            throw Error(
              "Your preferences could not be read. Please try again.",
            );
          if (!alive || version !== generation.current) return;
          setProfile(p);
          setLockEnabled(preference === "enabled");
          setLocked(preference === "enabled" && !credentialReentry);
        } else {
          setLockEnabled(false);
          setLocked(false);
        }
      } catch (e) {
        if (alive && version === generation.current) {
          setError(
            e instanceof Error ? e.message : "Couldn’t restore your session.",
          );
          setLocked(false);
        }
      } finally {
        if (alive && version === generation.current) setLoading(false);
      }
    }
    if (!auth) {
      setLoading(false);
      setLocked(false);
      return;
    }
    void auth.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) throw error;
        return accept(data.session);
      })
      .catch(() => {
        if (alive) {
          setError("Couldn’t restore sign-in. Try again.");
          setLocked(false);
          setLoading(false);
        }
      });
    const {
      data: { subscription },
    } = auth.auth.onAuthStateChange((event, next) => {
      void accept(next, event === "SIGNED_IN" && credentialEntry.current);
    });
    return () => {
      alive = false;
      subscription.unsubscribe();
      currentId.current = null;
    };
  }, [retry]);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        auth?.auth.stopAutoRefresh();
        if (lockEnabled && !prompting.current) setLocked(true);
      } else auth?.auth.startAutoRefresh();
    });
    return () => sub.remove();
  }, [lockEnabled]);
  async function run(fn: () => Promise<void>) {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }
  async function preview() {
    await run(async () => {
      const raw = await AsyncStorage.getItem(profileKey("preview"));
      const p = raw ? JSON.parse(raw) : emptyProfile();
      if (!validProfile(p))
        throw Error("Preview preferences could not be read.");
      setProfile(p);
      setGuest(true);
      setLocked(false);
    });
  }
  async function submitAuth() {
    await run(async () => {
      if (!auth)
        throw Error(
          "Email sign-in is not connected yet. You can explore the preview below.",
        );
      const validation = credentialError(
        email,
        password,
        authMode === "signup",
      );
      if (validation) throw Error(validation);
      credentialEntry.current = true;
      try {
        if (authMode === "signup") {
          const { data, error } = await auth.auth.signUp({
            email: email.trim().toLowerCase(),
            password,
            options: { emailRedirectTo: confirmationUrl },
          });
          if (error) throw error;
          setPassword("");
          if (!data.session) {
            setConfirmation(true);
            setCooldown(60);
            setNotice(
              "Confirmation email sent. Check your inbox and spam folder.",
            );
          }
        } else {
          const { error } = await auth.auth.signInWithPassword({
            email: email.trim().toLowerCase(),
            password,
          });
          if (error) throw error;
          setPassword("");
        }
      } finally {
        credentialEntry.current = false;
      }
    });
  }
  async function resendConfirmation() {
    await run(async () => {
      if (!auth) throw Error("Email sign-in is not connected yet.");
      if (credentialError(email, "placeholder", false))
        throw Error("Enter a valid email address.");
      const { error } = await auth.auth.resend({
        type: "signup",
        email: email.trim().toLowerCase(),
        options: { emailRedirectTo: confirmationUrl },
      });
      if (error) throw error;
      setCooldown(60);
      setNotice(
        "If this address needs confirmation, a fresh link will arrive shortly.",
      );
    });
  }
  async function signOut() {
    await run(async () => {
      if (session && auth) {
        const { error } = await auth.auth.signOut({ scope: "local" });
        if (error) throw error;
        if (Platform.OS !== "web")
          await SecureStore.deleteItemAsync(lockKey(session.user.id));
      }
      setGuest(false);
      setProfile(null);
      setSession(null);
      setEditing(false);
      setSecurity(false);
      setLocked(false);
      setLockEnabled(false);
      setConfirmation(false);
      setConfirmed(false);
      setPassword("");
      setNotice("");
    });
  }
  async function unlock(enable = false) {
    await run(async () => {
      if (!biometric)
        throw Error(
          "Biometric unlock is unavailable here. Sign in with email instead.",
        );
      prompting.current = true;
      try {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: `Unlock Orbit with ${biometric}`,
          cancelLabel: "Cancel",
          disableDeviceFallback: true,
          biometricsSecurityLevel: "strong",
        });
        if (!result.success)
          throw Error(
            "Orbit is still locked. Try again or sign in with email.",
          );
        if (enable) {
          await SecureStore.setItemAsync(lockKey(id), "enabled");
          setLockEnabled(true);
        }
        setLocked(false);
        setSecurity(false);
      } finally {
        prompting.current = false;
      }
    });
  }
  async function saveProfile(p: StudentProfile) {
    await AsyncStorage.setItem(profileKey(id), JSON.stringify(p));
  }
  if (loading)
    return (
      <SafeAreaView
        style={[
          ui.safe,
          { justifyContent: "center", alignItems: "center", gap: 24 },
        ]}
      >
        <Brand />
        <ActivityIndicator color={t.active} />
        <Text style={ui.caption}>Opening your Orbit…</Text>
      </SafeAreaView>
    );
  if ((session || guest) && profile && !locked && !security && !recovery) {
    if (!profile.completed || editing)
      return (
        <Onboarding
          key={id}
          initial={profile}
          preview={guest}
          save={saveProfile}
          finish={(p) => {
            setProfile(p);
            setEditing(false);
            if (session && !profile.completed && Platform.OS !== "web")
              setSecurity(true);
          }}
          cancel={() => {
            if (profile.completed) setEditing(false);
            else void signOut();
          }}
        />
      );
    return (
      <>
        {children({
          accountId: session?.user.id,
          profile,
          editPreferences: () => setEditing(true),
          signOut: () => {
            void signOut();
          },
          security: () => setSecurity(true),
        })}
      </>
    );
  }
  if (recovery)
    return (
      <SafeAreaView style={ui.safe}>
        <KeyboardAvoidingView
          style={ui.frame}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={a.header}>
            <Brand />
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={a.content}
          >
            <Feedback error={error} />
            <PasswordRecovery
              email={email}
              redirectTo={confirmationUrl}
              hasSession={recovery === "update" && !!session}
              close={(completed) => {
                setRecovery(null);
                setError("");
                if (recovery === "update" && !completed) void signOut();
              }}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  const protectedView = locked || security;
  const modeLabel = authMode === "signup" ? "Create account" : "Sign in";
  const switchMode = (mode: "signin" | "signup") => {
    setAuthMode(mode);
    setConfirmed(false);
    setConfirmation(false);
    setPassword("");
    setError("");
    setNotice("");
  };
  return (
    <SafeAreaView style={ui.safe}>
      <KeyboardAvoidingView
        style={ui.frame}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={a.header}>
          <Brand />
          <Text style={a.headerNote}>
            {protectedView ? "YOUR ACCOUNT" : "LIFE BETWEEN CLASSES"}
          </Text>
        </View>
        <StepMotion
          step={
            locked
              ? "locked"
              : security
                ? "security"
                : confirmation
                  ? "confirmation"
                  : authMode
          }
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={a.content}
          >
            {!protectedView && !confirmation && !(session && !profile) && (
              <View accessibilityRole="tablist" style={a.tabs}>
                {(["signin", "signup"] as const).map((mode) => (
                  <Touch
                    key={mode}
                    disabled={busy}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: authMode === mode }}
                    aria-selected={authMode === mode}
                    onPress={() => switchMode(mode)}
                    style={[a.tab, authMode === mode && a.activeTab]}
                  >
                    <Text
                      style={[
                        a.tabText,
                        authMode === mode && { color: t.text },
                      ]}
                    >
                      {mode === "signin" ? "Sign in" : "Create account"}
                    </Text>
                  </Touch>
                ))}
              </View>
            )}
            {(protectedView || confirmation) && (
              <View style={a.stateIcon}>
                <Ionicons
                  name={protectedView ? "scan-outline" : "mail-open-outline"}
                  size={30}
                  color={t.active}
                />
              </View>
            )}
            <Text style={ui.eyebrow}>
              {locked
                ? "WELCOME BACK"
                : security
                  ? "A LITTLE PEACE OF MIND"
                  : confirmation
                    ? "ONE LAST CHECK"
                    : confirmed
                      ? "EMAIL VERIFIED"
                      : authMode === "signup"
                        ? "YOUR NEXT CHAPTER"
                        : "GOOD TO SEE YOU"}
            </Text>
            <Text accessibilityRole="header" style={ui.title}>
              {locked
                ? "Your Orbit awaits."
                : security
                  ? "Keep your space yours."
                  : confirmation
                    ? "Confirm your email."
                    : confirmed
                      ? "You’re all set."
                      : authMode === "signup"
                        ? "A place for your people."
                        : "Back to your Orbit."}
            </Text>
            <Text style={ui.body}>
              {locked
                ? "Unlock to pick up where you left off."
                : security
                  ? "A quick biometric check keeps your signed-in account private on this device."
                  : confirmation
                    ? "Open your Orbit confirmation email, or request a fresh link below."
                    : authMode === "signup"
                      ? "Make an account. Then make yourself at home."
                      : "Your people, shared plans, and campus life in one place."}
            </Text>
            {confirmation && (
              <Field
                label="Email address"
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  setError("");
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!busy}
                placeholder="you@example.com"
              />
            )}
            <Feedback error={error} notice={notice} />
            {authMode === "signin" && error.startsWith("Account not found") && (
              <TextAction
                label="Create an Orbit account"
                disabled={busy}
                onPress={() => switchMode("signup")}
              />
            )}
            {protectedView ? (
              <View style={a.actions}>
                {!!biometric && session && (
                  <Primary
                    busy={busy}
                    label={
                      lockEnabled && !locked
                        ? `Turn off ${biometric}`
                        : `${locked ? "Unlock with" : "Enable"} ${biometric}`
                    }
                    onPress={() => {
                      if (lockEnabled && !locked)
                        void run(async () => {
                          await SecureStore.deleteItemAsync(lockKey(id));
                          setLockEnabled(false);
                        });
                      else void unlock(!locked);
                    }}
                  />
                )}
                {!biometric && (
                  <View style={a.note}>
                    <Ionicons
                      name="information-circle-outline"
                      size={20}
                      color={t.muted}
                    />
                    <Text style={[ui.caption, { flex: 1 }]}>
                      {Platform.OS === "ios" &&
                      Constants.appOwnership === "expo"
                        ? "Face ID will be available in an installed Orbit build. You can continue with email in Expo Go."
                        : "Biometric unlock is available on supported phones with Face ID or a fingerprint set up."}
                    </Text>
                  </View>
                )}
                {!session && (
                  <Text style={ui.caption}>
                    Sign in to an account to enable biometric unlock.
                  </Text>
                )}
                {!locked &&
                  (biometric && session ? (
                    <TextAction
                      disabled={busy}
                      label="Continue to Orbit"
                      onPress={() => setSecurity(false)}
                    />
                  ) : (
                    <Primary
                      disabled={busy}
                      label="Continue to Orbit"
                      onPress={() => setSecurity(false)}
                    />
                  ))}
                <TextAction
                  disabled={busy}
                  label={guest ? "Leave preview" : "Sign out and use email"}
                  onPress={() => void signOut()}
                />
              </View>
            ) : session && !profile ? (
              <View style={a.actions}>
                <Primary
                  label="Try loading again"
                  onPress={() => setRetry((x) => x + 1)}
                />
                <TextAction label="Sign out" onPress={() => void signOut()} />
              </View>
            ) : confirmation ? (
              <>
                <View style={a.instructions}>
                  <View style={a.instruction}>
                    <Text style={a.number}>01</Text>
                    <Text style={[ui.body, { flex: 1, marginTop: 0 }]}>
                      Find the email from Orbit and tap Confirm email.
                    </Text>
                  </View>
                  <View style={a.instruction}>
                    <Text style={a.number}>02</Text>
                    <Text style={[ui.body, { flex: 1, marginTop: 0 }]}>
                      Come back here and sign in with your password.
                    </Text>
                  </View>
                </View>
                <Primary
                  disabled={busy}
                  label="Back to sign in"
                  onPress={() => {
                    setConfirmation(false);
                    setAuthMode("signin");
                    setError("");
                    setNotice("");
                  }}
                />
                <TextAction
                  disabled={busy || !!cooldown || !email}
                  label={
                    cooldown
                      ? `Resend email in ${cooldown}s`
                      : "Resend confirmation email"
                  }
                  onPress={() => void resendConfirmation()}
                />
                <View style={a.note}>
                  <Ionicons name="mail-outline" size={19} color={t.muted} />
                  <Text style={[ui.caption, { flex: 1 }]}>
                    Nothing yet? Check spam or junk, and make sure the address
                    above is correct.
                  </Text>
                </View>
                <TextAction
                  disabled={busy}
                  label="Change email address"
                  onPress={() => {
                    setConfirmation(false);
                    setError("");
                    setNotice("");
                  }}
                />
              </>
            ) : (
              <>
                <Field
                  label="Email address"
                  value={email}
                  onChangeText={(value) => {
                    setEmail(value);
                    setError("");
                  }}
                  placeholder="you@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="emailAddress"
                  autoComplete="email"
                  maxLength={254}
                  returnKeyType="next"
                  onSubmitEditing={() => passwordInput.current?.focus()}
                  editable={!busy}
                />
                <Field
                  ref={passwordInput}
                  label="Password"
                  value={password}
                  onChangeText={(value) => {
                    setPassword(value);
                    setError("");
                  }}
                  placeholder={
                    authMode === "signup"
                      ? "Create a password"
                      : "Enter your password"
                  }
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                  textContentType={
                    authMode === "signup" ? "newPassword" : "password"
                  }
                  autoComplete={
                    authMode === "signup" ? "new-password" : "current-password"
                  }
                  returnKeyType="go"
                  onSubmitEditing={() => void submitAuth()}
                  editable={!busy}
                />
                {authMode === "signup" && (
                  <SignupChecks email={email} password={password} />
                )}
                {authMode === "signin" && (
                  <View style={{ alignItems: "flex-end" }}>
                    <TextAction
                      disabled={busy}
                      label="Forgot password?"
                      onPress={() => {
                        setRecovery("request");
                        setError("");
                        setNotice("");
                      }}
                    />
                  </View>
                )}
                <View style={{ marginTop: authMode === "signin" ? 8 : 26 }}>
                  <Primary
                    busy={busy}
                    label={modeLabel}
                    disabled={!auth}
                    onPress={() => void submitAuth()}
                  />
                </View>
                {!auth && (
                  <Feedback error="Email sign-in isn’t connected yet. You can still explore the preview." />
                )}
                {authMode === "signup" && (
                  <Text style={[ui.caption, { marginTop: 14 }]}>
                    We’ll send a confirmation to your inbox before you sign in.
                  </Text>
                )}
                {authMode === "signin" && (
                  <TextAction
                    disabled={busy}
                    label="Need a new confirmation email?"
                    onPress={() => {
                      setConfirmation(true);
                      setError("");
                      setNotice("");
                    }}
                  />
                )}
                <View style={a.preview}>
                  <View style={a.divider} />
                  <Text style={ui.caption}>TAKE A LOOK FIRST</Text>
                  <View style={a.divider} />
                </View>
                <TextAction
                  disabled={busy}
                  label="Explore Orbit without an account"
                  onPress={() => void preview()}
                />
              </>
            )}
            <Text style={a.bottomNote}>
              {confirmation
                ? "The link confirms your email address only."
                : protectedView
                  ? "Your device handles the biometric check. Orbit doesn’t store your biometric data."
                  : "A little less organizing. A little more living."}
            </Text>
          </ScrollView>
        </StepMotion>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const a = StyleSheet.create({
  header: {
    paddingHorizontal: 26,
    paddingTop: 20,
    paddingBottom: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerNote: { fontSize: 8, letterSpacing: 1.4, color: t.muted },
  content: {
    paddingHorizontal: 26,
    paddingTop: 10,
    paddingBottom: 25,
    flexGrow: 1,
  },
  tabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: t.line,
    marginBottom: 34,
  },
  tab: {
    paddingVertical: 15,
    marginRight: 28,
    borderBottomWidth: 2,
    borderColor: "transparent",
  },
  activeTab: { borderColor: t.active },
  tabText: { fontSize: 14, color: t.muted, fontWeight: "500" },
  stateIcon: {
    width: 62,
    height: 62,
    borderRadius: 18,
    backgroundColor: t.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
    marginTop: 20,
  },
  email: { color: t.text, fontSize: 16, lineHeight: 24, marginTop: 12 },
  actions: { gap: 15, marginTop: 26 },
  note: { flexDirection: "row", gap: 12, paddingVertical: 20 },
  instructions: { paddingVertical: 28, gap: 22 },
  instruction: { flexDirection: "row", gap: 15 },
  number: { fontSize: 12, color: t.active, lineHeight: 22 },
  preview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 30,
    marginBottom: 8,
  },
  divider: { flex: 1, height: 1, backgroundColor: t.line },
  bottomNote: {
    fontSize: 11,
    lineHeight: 18,
    color: "#71888d",
    textAlign: "center",
    marginTop: 30,
    paddingHorizontal: 18,
  },
});
