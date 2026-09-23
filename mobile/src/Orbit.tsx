import TextInput from "./FocusInput";
import { ChoiceField, EffortField } from "./ComposerControls";
import { amountValid, validateForm } from "../../src/formValidation";
import ExpenseDetails from "./ExpenseDetails";
import PlanDetails from "./PlanDetails";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AccessibilityInfo,
  Keyboard,
  BackHandler,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { randomUUID } from "expo-crypto";
import {
  balances,
  shares,
  members,
  money,
  newSpace,
  nextOwner,
  seed,
  type State,
  type Space,
} from "../../src/model";
import { draftKey, type Drafts } from "../../src/localStore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createLocalStore } from "../../src/localStore";
import AuthGate, { type AccountControls } from "./AuthGate";
import Pressable from "./Touch";
import DateField from "./DateField";
import {
  quietTimes,
  restoreTaskField,
  setGroceryDone,
  groceryGroups,
} from "../../src/ux";
import ProfilePanel from "./ProfilePanel";
import HomeDashboard from "./HomeDashboard";
import { theme } from "./theme";
import BottomNavigation from "./BottomNavigation";
import {
  RoommateOverview,
  SectionTabs,
  HangoutsScreen,
  CampusScreen,
} from "./TabScreens";

type IconName = React.ComponentProps<typeof Ionicons>["name"];
type SaveFeedback = { message?: string; undo?: (current: State) => State };
type Page = "Home" | "Roommates" | "Hangouts" | "Campus";
const colors = {
  ink: theme.text,
  teal: theme.teal,
  cream: theme.cream,
  bg: theme.background,
  muted: theme.muted,
  line: theme.line,
  sage: theme.raised,
};
const nav: { page: Page; icon: IconName }[] = [
  { page: "Home", icon: "home-outline" },
  { page: "Roommates", icon: "people-outline" },
  { page: "Hangouts", icon: "cafe-outline" },
  { page: "Campus", icon: "compass-outline" },
];
function Icon({
  name,
  color = "#99bec4",
  size = 21,
}: {
  name: IconName;
  color?: string;
  size?: number;
}) {
  return <Ionicons accessible={false} name={name} color={color} size={size} />;
}
function Button({
  title,
  onPress,
  secondary = false,
  icon,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  icon?: IconName;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        secondary && s.secondary,
        pressed && s.pressed,
      ]}
    >
      {icon && <Icon name={icon} color={theme.text} size={17} />}
      <Text style={[s.buttonText, secondary && { color: theme.text }]}>
        {title}
      </Text>
    </Pressable>
  );
}
function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={[s.chip, selected && s.chipActive]}
    >
      <Text style={[s.chipText, selected && { color: "#fff" }]}>{label}</Text>
    </Pressable>
  );
}
function Label({ children }: { children: React.ReactNode }) {
  return <Text style={s.eyebrow}>{children}</Text>;
}
function Field({
  label,
  value,
  onChangeText,
  keyboardType = "default",
  placeholder,
  multiline = false,
  compact = false,
  prominent = false,
  error,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: "default" | "decimal-pad" | "email-address";
  placeholder?: string;
  multiline?: boolean;
  compact?: boolean;
  prominent?: boolean;
  error?: string;
}) {
  return (
    <View style={[s.field, compact && { marginBottom: 4 }]}>
      {!compact && <Text style={s.fieldLabel}>{label}</Text>}
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={error}
        invalid={!!error}
        value={value}
        onChangeText={onChangeText}
        style={[
          s.input,
          prominent && s.titleInput,
          error && { borderColor: "#e8ad9f", borderBottomWidth: 2 },
          compact && { marginTop: 0 },
          multiline && { minHeight: 90, textAlignVertical: "top" },
        ]}
        placeholder={placeholder}
        placeholderTextColor="#82979a"
        keyboardType={keyboardType}
        keyboardAppearance="dark"
        returnKeyType={multiline ? "default" : "done"}
        onSubmitEditing={() => {
          if (!multiline) Keyboard.dismiss();
        }}
        autoCapitalize={keyboardType === "email-address" ? "none" : "sentences"}
        maxLength={multiline ? 500 : 100}
        multiline={multiline}
      />
      {!!error && <Text accessibilityRole="alert" style={s.fieldError}>{error}</Text>}
    </View>
  );
}

export default function Orbit() {
  return (
    <SafeAreaProvider>
      <AuthGate>{controls => <OrbitApp key={controls.accountId ?? "preview"} {...controls} />}</AuthGate>
    </SafeAreaProvider>
  );
}
function OrbitApp({accountId, profile, editPreferences, signOut, security}: AccountControls) {
  // The account key remounts OrbitApp on sign-in/out; state preserves this loaded store during Fast Refresh.
  const [store] = useState(() => createLocalStore(AsyncStorage, accountId));
  const { save: persist, load: restore, saveDrafts: persistDrafts } = store;
  const [state, setState] = useState<State>(seed),
    [ready, setReady] = useState(false),
    [loadError, setLoadError] = useState(false),
    [error, setError] = useState("");
  const [page, setPage] = useState<Page>("Home"),
    [section, setSection] = useState("Tasks");
  const [modal, setModal] = useState(""),
    [title, setTitle] = useState(""),
    [amount, setAmount] = useState(""),
    [owner, setOwner] = useState("Auto"),
    [points, setPoints] = useState("2"),
    [category, setCategory] = useState("Produce"),
    [date, setDate] = useState(""),
    [time, setTime] = useState(""),
    [email, setEmail] = useState(""),
    [formError, setFormError] = useState("");
  const [attempted, setAttempted] = useState(false);
  const currentIssue = attempted
    ? validateForm(modal, { title, amount, date, time, email })
    : null;
  useEffect(() => {
    if (attempted) setFormError(currentIssue?.message ?? "");
  }, [attempted, modal, title, amount, date, time, email]);
  const [campusCategory, setCampusCategory] = useState("Events");
  const [taskFilter, setTaskFilter] = useState("Open");
  const [query, setQuery] = useState("");
  const [groceryFilter, setGroceryFilter] = useState("Needed");
  const [notice, setNotice] = useState<{
    message: string;
    id: number;
    undo?: (current: State) => State;
  } | null>(null);
  const [expenseDetails, setExpenseDetails] = useState<{
    spaceId: string;
    id: string;
  } | null>(null);
  const [planDetails, setPlanDetails] = useState<string | null>(null);
  const [assignTask, setAssignTask] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const saveVersion = useRef(0);
  const drafts = useRef<Drafts>({});
  const [draftStatus, setDraftStatus] = useState("");
  const [recovered, setRecovered] = useState(false);
  const draftVersion = useRef(0);
  function writeDrafts() {
    const version = ++draftVersion.current;
    setDraftStatus("Saving draft…");
    return persistDrafts(drafts.current)
      .then(() => {
        if (version === draftVersion.current)
          setDraftStatus("Draft saved on this device");
      })
      .catch(() => {
        if (version === draftVersion.current)
          setDraftStatus("Draft not saved. Retry before leaving.");
      });
  }
  useEffect(() => {
    if (!ready || !modal || modal === "assign" || modal === "profile") return;
    drafts.current[draftKey(state.active, modal)] = {
      title,
      amount,
      owner,
      points,
      category,
      date,
      time,
      email,
    };
    void writeDrafts();
  }, [
    ready,
    modal,
    state.active,
    title,
    amount,
    owner,
    points,
    category,
    date,
    time,
    email,
  ]);
  function discardDraft() {
    delete drafts.current[draftKey(state.active, modal)];
    void writeDrafts();
    Keyboard.dismiss();
    setModal("");
    setRecovered(false);
  }
  const stateRef = useRef(state);
  useEffect(() => {
    if (Platform.OS === "ios" && formError)
      AccessibilityInfo.announceForAccessibility(formError);
  }, [formError]);
  useEffect(() => {
    if (Platform.OS === "ios" && notice)
      AccessibilityInfo.announceForAccessibility(
        notice.message + (notice.undo ? ". Undo available." : ""),
      );
  }, [notice]);
  useEffect(() => {
    if (!notice || notice.undo) return;
    const timer = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  function closeForm() {
    Keyboard.dismiss();
    setModal("");
  }
  const scroll = useRef<ScrollView>(null);
  useEffect(() => {
    let active = true;
    restore()
      .then(({ state: data, drafts: savedDrafts }) => {
        if (active) {
          drafts.current = savedDrafts;
          stateRef.current = data;
          setState(data);
          setReady(true);
        }
      })
      .catch(() => {
        if (active) {
          setLoadError(true);
          setError(
            "Your saved data could not be loaded. Your stored data has been kept. Retry to load it again.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [loadAttempt]);
  useEffect(() => {
    const listener = BackHandler.addEventListener("hardwareBackPress", () => {
      if (modal) {
        closeForm();
        return true;
      }
      if (page !== "Home") {
        setPage("Home");
        return true;
      }
      return false;
    });
    return () => listener.remove();
  }, [page, modal, title, amount, owner, points, category, date, time, email]);
  function save(
    update: (current: State) => State,
    feedback: SaveFeedback = {},
  ) {
    const next = update(stateRef.current);
    stateRef.current = next;
    setState(next);
    setNotice(null);
    const clearDraft =
      modal && modal !== "assign" ? draftKey(state.active, modal) : undefined;
    if (clearDraft) {
      delete drafts.current[clearDraft];
      ++draftVersion.current;
      setDraftStatus("");
    }
    writeState(next, feedback, clearDraft);
  }
  function writeState(
    next: State,
    feedback: SaveFeedback = {},
    clearDraft?: string,
  ) {
    const version = ++saveVersion.current;
    persist(next, clearDraft)
      .then(() => {
        if (version === saveVersion.current) {
          setError("");
          setNotice(feedback.undo ? {
            message: feedback.message ?? "Updated",
            id: version,
            undo: feedback.undo,
          } : null);
        }
      })
      .catch(() => {
        if (version === saveVersion.current) {
          setNotice(null);
          setError(
            "Changes are visible but not saved. Keep Orbit open and retry.",
          );
        }
      });
  }
  const space = state.spaces.find((x) => x.id === state.active)!;
  const balance = balances(space.expenses);
  const pending = space.tasks.filter((x) => !x.done);
  function edit(fn: (s: Space) => Space, feedback: SaveFeedback = {}) {
    save(
      (current) => ({
        ...current,
        spaces: current.spaces.map((x) =>
          x.id === current.active ? fn(x) : x,
        ),
      }),
      feedback,
    );
  }
  function go(next: Page) {
    Keyboard.dismiss();
    setPage(next);
    scroll.current?.scrollTo({ y: 0, animated: false });
  }
  function open(kind: string) {
    setAttempted(false);
    setTitle(kind === "profile" ? state.name : "");
    setEmail(state.email);
    setAmount("");
    setOwner(kind === "expense" ? "You" : "Auto");
    setPoints("2");
    setCategory("Produce");
    const suggested = new Date();
    suggested.setHours(suggested.getHours() + 1, 0, 0, 0);
    const pad = (n: number) => String(n).padStart(2, "0");
    const quiet = quietTimes(space.quiet);
    setDate(
      kind === "quiet"
        ? (quiet?.[0] ?? "22:00")
        : kind === "hangout"
          ? suggested.getFullYear() +
            "-" +
            pad(suggested.getMonth() + 1) +
            "-" +
            pad(suggested.getDate())
          : "",
    );
    setTime(
      kind === "quiet"
        ? (quiet?.[1] ?? "08:00")
        : kind === "hangout"
          ? pad(suggested.getHours()) + ":00"
          : "",
    );
    const draft = drafts.current[draftKey(state.active, kind)];
    setRecovered(!!draft);
    if (draft) {
      setTitle(draft.title);
      setAmount(draft.amount);
      setOwner(draft.owner);
      setPoints(draft.points);
      setCategory(draft.category);
      setDate(draft.date);
      setTime(draft.time);
      setEmail(draft.email);
    }
    setFormError("");
    setModal(kind);
  }
  function toggleTask(id: string) {
    const before = space.tasks.find((t) => t.id === id)!;
    const spaceId = space.id;
    edit(
      (current) => {
        const task = current.tasks.find((x) => x.id === id)!;
        return {
          ...current,
          tasks: current.tasks.map((x) =>
            x.id === id ? { ...x, done: !x.done } : x,
          ),
          history: [
            `${new Date().toLocaleString()}: ${task.done ? "Reopened" : "Completed"} ${task.title}`,
            ...current.history,
          ],
        };
      },
      {
        message: before.done ? "Task reopened" : "Task completed",
        undo: (current) =>
          restoreTaskField(current, spaceId, id, { done: before.done }),
      },
    );
  }
  function changeOwner() {
    const before = space.tasks.find((t) => t.id === assignTask);
    if (!before) {
      closeForm();
      return;
    }
    if (before.owner === owner) {
      closeForm();
      return;
    }
    const spaceId = space.id;
    edit(
      (current) => ({
        ...current,
        tasks: current.tasks.map((t) =>
          t.id === before.id ? { ...t, owner } : t,
        ),
        history: [`Reassigned ${before.title} to ${owner}`, ...current.history],
      }),
      {
        message: `Assigned to ${owner}`,
        undo: (current) =>
          restoreTaskField(current, spaceId, before.id, {
            owner: before.owner,
          }),
      },
    );
    closeForm();
  }
  function vote(id: string) {
    save((current) => ({
      ...current,
      hangouts: current.hangouts.map((x) =>
        x.id === id
          ? {
              ...x,
              votes: x.votes.includes("You")
                ? x.votes.filter((v) => v !== "You")
                : [...x.votes, "You"],
            }
          : x,
      ),
    }));
  }
  function submit() {
    if (modal === "assign") {
      changeOwner();
      return;
    }
    setAttempted(true);
    const issue = validateForm(modal, { title, amount, date, time, email });
    if (issue) {
      setFormError(issue.message);
      return;
    }
    const name = title.trim();
    if (modal === "task")
      edit((x) => ({
        ...x,
        tasks: [
          ...x.tasks,
          {
            id: randomUUID(),
            title: name,
            owner: owner === "Auto" ? nextOwner(x.tasks) : owner,
            points: Number(points),
            done: false,
          },
        ],
      }));
    if (modal === "grocery")
      edit((x) => ({
        ...x,
        groceries: [
          ...x.groceries,
          { id: randomUUID(), title: name, category, done: false },
        ],
      }));
    if (modal === "expense") {
      edit((x) => ({
        ...x,
        expenses: [
          ...x.expenses,
          {
            id: randomUUID(),
            title: name,
            cents: Math.round(Number(amount) * 100),
            payer: owner,
          },
        ],
      }));
    }
    if (modal === "space") {
      const created = newSpace(name, randomUUID());
      save((x) => ({
        ...x,
        spaces: [...x.spaces, created],
        active: created.id,
      }));
    }
    if (modal === "hangout") {
      const iso = `${date.trim()}T${time.trim()}`;
      save((x) => ({
        ...x,
        hangouts: [
          ...x.hangouts,
          { id: randomUUID(), title: name, date: iso, votes: ["You"] },
        ],
      }));
    }
    if (modal === "maintenance")
      edit((x) => ({
        ...x,
        maintenance: [
          ...x.maintenance,
          { id: randomUUID(), title: name, done: false },
        ],
      }));
    if (modal === "concern")
      edit((x) => ({
        ...x,
        history: [
          `Concern · ${new Date().toLocaleString()}: ${name}`,
          ...x.history,
        ],
      }));
    if (modal === "quiet") {
      edit((x) => ({ ...x, quiet: `${date} – ${time}` }));
    }
    if (modal === "profile") {
      save((x) => ({ ...x, name: name.slice(0, 30), email: email.trim() }));
    }
    Keyboard.dismiss();
    setModal("");
  }
  function taskRows(limit?: number) {
    const list = limit
      ? pending.slice(0, limit)
      : space.tasks.filter(
          (t) =>
            (taskFilter === "All" ||
              (taskFilter === "Done"
                ? t.done
                : !t.done && (taskFilter !== "Mine" || t.owner === "You"))) &&
            (t.title + " " + t.owner)
              .toLowerCase()
              .includes(query.trim().toLowerCase()),
        );
    return list.length ? (
      list.map((t) => (
        <View style={s.row} key={t.id}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: t.done }}
            accessibilityLabel={`${t.done ? "Reopen" : "Complete"} ${t.title}`}
            onPress={() => toggleTask(t.id)}
            style={s.checkTouch}
          >
            <View style={[s.check, t.done && s.checked]}>
              {t.done && <Icon name="checkmark" color="#fff" size={15} />}
            </View>
          </Pressable>
          <View style={s.grow}>
            <Text style={[s.rowTitle, t.done && s.strike]}>{t.title}</Text>
            <Text style={s.small}>
              {t.points} effort points · {t.owner}
            </Text>
          </View>
          {!limit && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Reassign ${t.title}`}
              style={s.iconTouch}
              onPress={() => {
                setAssignTask(t.id);
                setOwner(t.owner);
                setFormError("");
                setModal("assign");
              }}
            >
              <Icon name="ellipsis-horizontal" size={19} />
            </Pressable>
          )}
        </View>
      ))
    ) : (
      <View style={s.emptyState}>
        <Icon name="checkmark-done-outline" size={28} />
        <Text style={s.rowTitle}>
          {space.tasks.length ? "Nothing in this view" : "A fresh start"}
        </Text>
        <Text style={s.small}>
          {space.tasks.length
            ? "Try another filter or clear your search."
            : "Add the first task. Orbit can suggest who takes it."}
        </Text>
        <Button
          title={space.tasks.length ? "Show all tasks" : "Add first task"}
          secondary
          onPress={() => {
            if (space.tasks.length) {
              setTaskFilter("All");
              setQuery("");
            } else open("task");
          }}
        />
      </View>
    );
  }
  if (!ready)
    return (
      <SafeAreaView style={[s.safe, s.loading]}>
        <Icon name="leaf-outline" size={45} />
        <Text style={s.heading}>orbit.</Text>
        {loadError ? (
          <>
            <Text style={s.body}>{error}</Text>
            <Button
              title="Retry loading"
              onPress={() => {
                setLoadError(false);
                setError("");
                setLoadAttempt((x) => x + 1);
              }}
            />
          </>
        ) : (
          <ActivityIndicator color={colors.teal} />
        )}
      </SafeAreaView>
    );
  return (
    <SafeAreaView
      style={[s.safe, page === "Home" && { backgroundColor: theme.background }]}
    >
      <StatusBar style="light" />
      <View
        style={[
          s.topbar,
          page === "Home" && {
            borderBottomColor: "#213a43",
            paddingVertical: 8,
          },
        ]}
      >
        <View style={s.inline}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Edit profile"
            onPress={() => open("profile")}
            style={[s.avatar, { width: 44, height: 44 }]}
          >
            <Text style={s.avatarText}>{profile.name[0]?.toUpperCase() || state.name[0]?.toUpperCase()}</Text>
          </Pressable>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "400",
              color: page === "Home" ? "#d9e5de" : colors.ink,
            }}
          >
            {page}
          </Text>
        </View>
        <Text style={s.demo}>{accountId ? "● LOCAL DATA" : "● PREVIEW"}</Text>
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        ref={scroll}
        contentContainerStyle={[
          s.content,
          page === "Home" && { padding: 14, paddingBottom: 8 },
        ]}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        {!!error && (
          <View style={s.info}>
            <Text accessibilityRole="alert" style={s.body}>
              {error}
            </Text>
            <Button
              title="Retry save"
              onPress={() => writeState(stateRef.current)}
            />
          </View>
        )}
        {page === "Home" && (
          <HomeDashboard
            state={state}
            space={space}
            profile={profile}
            open={open}
            roommates={(next, mine) => {
              setSection(next);
              setTaskFilter(mine ? "Mine" : "Open");
              setQuery("");
              go("Roommates");
            }}
            hangouts={() => go("Hangouts")}
            campus={() => { setCampusCategory("Events"); go("Campus"); }}
            exploreClubs={() => { setCampusCategory("Clubs"); go("Campus"); }}
            planDetails={setPlanDetails}
            toggleTask={toggleTask}
          />
        )}
        {page === "Roommates" && (
          <>
            <RoommateOverview
              state={state}
              space={space}
              save={save}
              open={open}
            />
            <SectionTabs
              values={[
                "Tasks",
                "Groceries",
                "Expenses",
                "Fairness",
                "House notes",
              ]}
              value={section}
              onChange={(value) => {
                setSection(value);
                setQuery("");
              }}
            />
            <View style={{ paddingBottom: 12 }}>
              <View style={s.between}>
                <Text style={s.cardTitle}>{section}</Text>
                {["Tasks", "Groceries", "Expenses"].includes(section) && (
                  <Button
                    title="Add"
                    icon="add"
                    onPress={() =>
                      open(
                        section === "Tasks"
                          ? "task"
                          : section === "Groceries"
                            ? "grocery"
                            : "expense",
                      )
                    }
                  />
                )}
              </View>
              {section === "Tasks" && (
                <>
                  <View style={[s.wrap, { marginBottom: 10 }]}>
                    {["Open", "Mine", "Done", "All"].map((value) => (
                      <Chip
                        key={value}
                        label={value}
                        selected={taskFilter === value}
                        onPress={() => setTaskFilter(value)}
                      />
                    ))}
                  </View>
                  <Field
                    compact
                    label="Find a task"
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Search task or roommate"
                  />
                  {taskRows()}
                </>
              )}
              {section === "Groceries" && (
                <>
                  <View style={s.wrap}>
                    {["Needed", "Bought", "All"].map((value) => (
                      <Chip
                        key={value}
                        label={value}
                        selected={groceryFilter === value}
                        onPress={() => setGroceryFilter(value)}
                      />
                    ))}
                  </View>
                  <Text style={s.small}>
                    {space.groceries.filter((g) => !g.done).length} left on your
                    shopping list
                  </Text>
                  {!space.groceries.filter(
                    (g) =>
                      groceryFilter === "All" ||
                      (groceryFilter === "Bought" ? g.done : !g.done),
                  ).length && (
                    <Text style={s.body}>
                      {space.groceries.length === 0
                        ? "Start your shared shopping list."
                        : groceryFilter === "Needed"
                          ? "Everything is bought. Add what you need next."
                          : "Nothing bought yet. Check off items as you shop."}
                    </Text>
                  )}
                  {!space.groceries.length && (
                    <Button
                      title="Add first grocery"
                      secondary
                      onPress={() => open("grocery")}
                    />
                  )}
                  {groceryGroups(
                    space.groceries.filter(
                      (g) =>
                        groceryFilter === "All" ||
                        (groceryFilter === "Bought" ? g.done : !g.done),
                    ),
                  ).map((group) => (
                    <View key={group.category}>
                      <Text style={[s.eyebrow, { marginTop: 20 }]}>
                        {group.category} · {group.items.length}
                      </Text>
                      {group.items.map((g) => (
                        <View key={g.id} style={s.row}>
                          <Pressable
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: g.done }}
                            accessibilityLabel={`${g.done ? "Mark needed" : "Mark bought"} ${g.title}`}
                            style={s.checkTouch}
                            onPress={() => {
                              const spaceId = space.id;
                              save(
                                (current) =>
                                  setGroceryDone(
                                    current,
                                    spaceId,
                                    g.id,
                                    !g.done,
                                  ),
                                {
                                  message: g.done
                                    ? "Moved to needed"
                                    : "Marked bought",
                                  undo: (current) =>
                                    setGroceryDone(
                                      current,
                                      spaceId,
                                      g.id,
                                      g.done,
                                    ),
                                },
                              );
                            }}
                          >
                            <View style={[s.check, g.done && s.checked]}>
                              {g.done && (
                                <Icon name="checkmark" size={15} color="#fff" />
                              )}
                            </View>
                          </Pressable>
                          <Text
                            style={[s.rowTitle, s.grow, g.done && s.strike]}
                          >
                            {g.title}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ))}
                </>
              )}
              {section === "Expenses" && (
                <>
                  <View style={s.roomBanner}>
                    <Label>
                      {balance.You >= 0 ? "YOU ARE OWED" : "YOU OWE"}
                    </Label>
                    <Text style={s.balance}>
                      {money(Math.abs(balance.You))}
                    </Text>
                    <Text style={s.small}>
                      Equal splits across the four demo roommates.
                    </Text>
                  </View>
                  {!space.expenses.length && (
                    <View style={s.emptyState}>
                      <Icon name="receipt-outline" size={28} />
                      <Text style={s.rowTitle}>No shared expenses yet</Text>
                      <Text style={s.small}>
                        Add a purchase to see each person’s share.
                      </Text>
                      <Button
                        title="Add first expense"
                        secondary
                        onPress={() => open("expense")}
                      />
                    </View>
                  )}
                  {space.expenses.map((e) => (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`View expense ${e.title}`}
                      onPress={() =>
                        setExpenseDetails({ spaceId: space.id, id: e.id })
                      }
                      style={s.row}
                      key={e.id}
                    >
                      <Icon name="receipt-outline" />
                      <View style={s.grow}>
                        <Text style={s.rowTitle}>{e.title}</Text>
                        <Text style={s.small}>
                          Paid by {e.payer} · split 4 ways
                        </Text>
                      </View>
                      <Text
                        style={[
                          s.rowTitle,
                          { fontVariant: ["tabular-nums"], textAlign: "right" },
                        ]}
                      >
                        {money(e.cents)}
                      </Text>
                      <Icon name="chevron-forward" size={16} />
                    </Pressable>
                  ))}
                </>
              )}
              {section === "Fairness" && (
                <>
                  <Text style={s.body}>
                    Completed chore effort and money balances, side by side.
                    Positive balances are owed to that person.
                  </Text>
                  {members.map((m) => {
                    const tasks = space.tasks.filter((t) => t.owner === m),
                      total = tasks.reduce((a, t) => a + t.points, 0),
                      done = tasks
                        .filter((t) => t.done)
                        .reduce((a, t) => a + t.points, 0);
                    return (
                      <View key={m} style={s.fairRow}>
                        <View style={s.between}>
                          <Text style={s.rowTitle}>{m}</Text>
                          <Text style={s.rowTitle}>{money(balance[m])}</Text>
                        </View>
                        <Text style={s.small}>
                          {done} completed / {total} assigned points
                        </Text>
                        <View style={s.track}>
                          <View
                            style={[
                              s.fill,
                              { width: `${total ? (done / total) * 100 : 0}%` },
                            ]}
                          />
                        </View>
                      </View>
                    );
                  })}
                  <Button
                    title="Log a concern"
                    secondary
                    icon="flag-outline"
                    onPress={() => open("concern")}
                  />
                  <Text style={s.sectionTitle}>Activity history</Text>
                  {!space.history.length && (
                    <Text style={s.body}>
                      No activity yet. Completed tasks and logged concerns will
                      appear here.
                    </Text>
                  )}
                  {space.history.map((h, i) => (
                    <View style={s.timelineRow} key={i}>
                      <View style={s.timelineDot} />
                      <Text style={[s.small, { flex: 1 }]}>{h}</Text>
                    </View>
                  ))}
                </>
              )}
              {section === "House notes" && (
                <>
                  <View style={s.roomBanner}>
                    <Icon name="moon-outline" />
                    <Text style={s.roomTitle}>Quiet hours</Text>
                    <Text style={s.body}>{space.quiet}</Text>
                    <Button
                      secondary
                      title="Edit quiet hours"
                      onPress={() => open("quiet")}
                    />
                  </View>
                  <Text style={s.cardTitle}>Maintenance log</Text>
                  <Text style={s.body}>
                    Shared notes only. Submit official work orders through your
                    university.
                  </Text>
                  {!space.maintenance.length && (
                    <Text style={s.body}>
                      No issues logged. Use Log issue to note something that
                      needs attention.
                    </Text>
                  )}
                  {space.maintenance.map((m) => (
                    <View style={s.row} key={m.id}>
                      <View style={s.grow}>
                        <Text style={s.rowTitle}>{m.title}</Text>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        style={s.iconTouch}
                        accessibilityLabel={
                          m.done ? "Reopen issue" : "Resolve issue"
                        }
                        onPress={() =>
                          edit((x) => ({
                            ...x,
                            maintenance: x.maintenance.map((a) =>
                              a.id === m.id ? { ...a, done: !a.done } : a,
                            ),
                          }))
                        }
                      >
                        <Icon
                          name={m.done ? "checkmark-circle" : "ellipse-outline"}
                        />
                      </Pressable>
                    </View>
                  ))}
                  <Button
                    title="Log issue"
                    icon="add"
                    onPress={() => open("maintenance")}
                  />
                </>
              )}
            </View>
          </>
        )}
        {page === "Hangouts" && (
          <HangoutsScreen state={state} save={save} open={open} vote={vote} details={setPlanDetails} />
        )}
        {page === "Campus" && <CampusScreen state={state} save={save} profile={profile} category={campusCategory} onCategoryChange={setCampusCategory} />}
      </ScrollView>
      {!!notice && (
        <View style={s.toast} accessibilityLiveRegion="polite">
          <View style={{ flex: 1 }}>
            <Text style={s.small}>{notice.message}</Text>
          </View>
          {!!notice.undo && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Undo last change"
              onPress={() => {
                if (notice.undo)
                  save(notice.undo, { message: "Change undone" });
              }}
              style={{
                minHeight: 44,
                justifyContent: "center",
                paddingHorizontal: 8,
              }}
            >
              <Text style={{ color: theme.active, fontWeight: "600" }}>
                Undo
              </Text>
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss confirmation"
            onPress={() => setNotice(null)}
            style={{ padding: 12, minHeight: 44, minWidth: 44 }}
          >
            <Icon name="close" size={16} />
          </Pressable>
        </View>
      )}
      {planDetails && state.hangouts.some(p => p.id === planDetails) && (
        <PlanDetails key={planDetails} plan={state.hangouts.find(p => p.id === planDetails)!} save={save} onClose={() => setPlanDetails(null)} />
      )}
      {expenseDetails && (
        <ExpenseDetails
          key={expenseDetails.spaceId + expenseDetails.id}
          state={state}
          {...expenseDetails}
          save={save}
          onClose={() => setExpenseDetails(null)}
        />
      )}
      {draftStatus.startsWith("Draft not") && !modal && (
        <View style={s.info}>
          <Text accessibilityRole="alert" style={s.small}>
            {draftStatus}
          </Text>
          <Button
            title="Retry draft save"
            onPress={() => {
              void writeDrafts();
            }}
          />
        </View>
      )}
      <BottomNavigation items={nav} value={page} onChange={go} />
      <Modal
        visible={!!modal}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={closeForm}
      >
        <View style={s.modalBackdrop}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={s.modalKeyboard}
          >
            <SafeAreaView edges={["bottom", "top"]} style={s.modalSafe}>
              <View style={s.modal}>
                <View style={s.between}>
                  <Text style={s.composerTitle}>
                    {
                      (
                        {
                          assign: "Assign task",
                          task: "New task",
                          grocery: "New grocery",
                          expense: "New expense",
                          hangout: "New plan",
                          space: "New shared space",
                          profile: "Your profile",
                          quiet: "Quiet hours",
                          maintenance: "Log a maintenance issue",
                          concern: "Talk it through",
                        } as Record<string, string>
                      )[modal]
                    }
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Close dialog"
                    onPress={closeForm}
                    style={s.iconTouch}
                  >
                    <Icon name="close" />
                  </Pressable>
                </View>
                {modal !== "profile" && <Text style={s.composerContext}>{["task", "grocery", "expense"].includes(modal) ? space.name : modal === "hangout" ? "Your circle" : "Orbit"}</Text>}
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  style={{ flex: 1 }}
                  keyboardDismissMode="on-drag"
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{ paddingBottom: 20 }}
                >
                  {modal !== "quiet" && modal !== "assign" && modal !== "profile" && (
                    <Field
                      label={
                        ({ task: "Task", grocery: "Item", expense: "What was it for?", hangout: "Plan", concern: "What needs a conversation?" } as Record<string, string>)[modal] || "Name"
                      }
                      placeholder={
                        modal === "task"
                          ? "e.g. Take out recycling"
                          : modal === "grocery"
                            ? "e.g. Oat milk"
                            : modal === "expense"
                              ? "e.g. Weekly groceries"
                              : modal === "hangout"
                                ? "e.g. Coffee after class"
                                : undefined
                      }
                      prominent
                      value={title}
                      error={
                        currentIssue?.field === "title"
                          ? currentIssue.message
                          : undefined
                      }
                      onChangeText={setTitle}
                      multiline={modal === "concern"}
                    />
                  )}
                  {modal === "assign" && (
                    <View style={{ gap: 16, paddingVertical: 16 }}>
                      <Text style={s.rowTitle}>
                        {space.tasks.find((t) => t.id === assignTask)?.title}
                      </Text>
                      <Text style={s.small}>
                        Choose who takes this task. Nothing changes until you
                        save.
                      </Text>
                      {members.map((member) => (
                        <Pressable
                          key={member}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: owner === member }}
                          accessibilityLabel={member}
                          onPress={() => setOwner(member)}
                          style={[s.row, { paddingVertical: 12 }]}
                        >
                          <Icon
                            name={
                              owner === member
                                ? "radio-button-on"
                                : "radio-button-off"
                            }
                          />
                          <Text style={s.rowTitle}>{member}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                  {modal === "task" && <>
                    <ChoiceField label="Assign to" value={owner} onChange={setOwner} options={[
                      { value: "Auto", label: "Auto assign", detail: `Suggested: ${nextOwner(space.tasks)} · lowest assigned effort` },
                      ...members.map(member => ({ value: member, label: member }))
                    ]} />
                    {owner === "Auto" && <Text style={[s.small, { marginTop: 8 }]}>Suggested: {nextOwner(space.tasks)}</Text>}
                    <EffortField value={points} onChange={setPoints} />
                  </>}
                  {modal === "grocery" && <ChoiceField label="Category" value={category} onChange={setCategory} options={
                    ["Produce", "Dairy & alternatives", "Pantry", "Household", "Other"].map(value => ({ value, label: value }))
                  } />}
                  {modal === "expense" && (
                    <>
                      <Field
                        label="Amount ($)"
                        prominent
                        value={amount}
                        error={
                          currentIssue?.field === "amount"
                            ? currentIssue.message
                            : undefined
                        }
                        onChangeText={setAmount}
                        keyboardType="decimal-pad"
                        placeholder="0.00"
                      />
                      <ChoiceField label="Paid by" value={owner} onChange={setOwner} options={members.map(member => ({ value: member, label: member }))} />
                      <Text style={[s.small, { marginTop: 12 }]}>Split equally across {members.length} people in this space.</Text>
                    </>
                  )}
                  {modal === "expense" &&
                    amountValid(amount) && (
                      <View style={s.splitPreview}>
                        <Text style={s.eyebrow}>SPLIT PREVIEW</Text>
                        <View style={s.splitPeople}>{shares(
                          Math.round(Number(amount) * 100),
                          members.length,
                        ).map((cents, i) => (
                          <View style={s.splitPerson} key={members[i]}>
                            <Text style={s.small}>{members[i]}</Text>
                            <Text
                              style={[
                                s.rowTitle,
                                { fontVariant: ["tabular-nums"] },
                              ]}
                            >
                              {money(cents)}
                            </Text>
                          </View>
                        ))}</View>
                      </View>
                    )}
                  {modal === "hangout" && (
                    <>
                      <DateField
                        label="Date"
                        mode="date"
                        value={date}
                        error={
                          currentIssue?.field === "date"
                            ? currentIssue.message
                            : undefined
                        }
                        onChange={setDate}
                      />
                      <DateField
                        label="Time"
                        mode="time"
                        value={time}
                        error={
                          currentIssue?.field === "time"
                            ? currentIssue.message
                            : undefined
                        }
                        onChange={setTime}
                      />
                    </>
                  )}
                  {modal === "quiet" && (
                    <>
                      <DateField
                        label="Start"
                        mode="time"
                        value={date}
                        error={
                          currentIssue?.field === "date"
                            ? currentIssue.message
                            : undefined
                        }
                        onChange={setDate}
                      />
                      <DateField
                        label="End"
                        mode="time"
                        value={time}
                        error={
                          currentIssue?.field === "time"
                            ? currentIssue.message
                            : undefined
                        }
                        onChange={setTime}
                      />
                    </>
                  )}
                  {modal === "profile" && <ProfilePanel profile={profile} signedIn={!!accountId} edit={()=>{closeForm();editPreferences();}} security={()=>{closeForm();security();}} signOut={()=>{closeForm();signOut();}}/>}
                  {modal === "space" && (
                    <Text style={s.body}>
                      Creates a separate local space with the four demo
                      roommates. Invitations need a backend.
                    </Text>
                  )}
                  {modal === "concern" && (
                    <Text style={s.body}>
                      Saved in local history. No messages are sent.
                    </Text>
                  )}
                </ScrollView>
                {modal !== "profile" && <View style={s.formFooter}>
                  {modal !== "assign" && (
                    <View style={s.between}>
                      <Text style={s.small}>
                        {draftStatus.startsWith("Draft not") ? "Draft not saved" : draftStatus === "Saving draft…" ? "Saving draft…" : recovered ? "Draft restored" : "Draft saved"}
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Discard draft"
                        onPress={discardDraft}
                        style={{ minHeight: 44, justifyContent: "center" }}
                      >
                        <Text style={{ color: theme.active }}>
                          Discard
                        </Text>
                      </Pressable>
                    </View>
                  )}
                  {draftStatus.startsWith("Draft not") && (
                    <Button
                      title="Retry draft save"
                      onPress={() => {
                        void writeDrafts();
                      }}
                    />
                  )}
                  {!!formError && !currentIssue && (
                    <Text accessibilityRole="alert" style={s.error}>
                      {formError}
                    </Text>
                  )}
                  <Button
                    title={
                      (
                        {
                          task: "Add task",
                          grocery: "Add grocery",
                          expense: "Add expense",
                          hangout: "Create plan",
                          space: "Create space",
                          maintenance: "Log issue",
                          concern: "Save concern",
                        } as Record<string, string>
                      )[modal] || "Save changes"
                    }
                    onPress={submit}
                  />
                </View>}
              </View>
            </SafeAreaView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  emptyState: { paddingVertical: 28, alignItems: "center", gap: 12 },
  splitPeople: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  splitPerson: { flex: 1, minWidth: 60, gap: 6 },
  splitPreview: {
    backgroundColor: theme.background,
    borderTopWidth: 1,
    borderColor: theme.line,
    borderRadius: 0,
    paddingVertical: 16,
    gap: 10,
    marginVertical: 12,
  },
  formFooter: {
    borderTopWidth: 1,
    borderColor: theme.line,
    paddingTop: 12,
    gap: 10,
  },
  timelineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    borderLeftWidth: 1,
    borderColor: theme.line,
    marginLeft: 4,
    paddingLeft: 16,
    paddingBottom: 20,
  },
  timelineDot: {
    position: "absolute",
    left: -4,
    top: 4,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.active,
  },
  toast: {
    paddingHorizontal: 22,
    backgroundColor: theme.background,
    borderTopWidth: 1,
    borderColor: theme.line,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  safe: { flex: 1, backgroundColor: colors.bg },
  loading: {
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
    gap: 20,
  },
  topbar: {
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  inline: { flexDirection: "row", alignItems: "center", gap: 9 },
  logo: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -1.4,
    color: colors.ink,
  },
  logoIcon: { backgroundColor: colors.teal, padding: 6, borderRadius: 10 },
  demo: {
    fontSize: 8,
    fontWeight: "500",
    letterSpacing: 0.8,
    color: "#6c8e83",
  },
  avatar: {
    width: 35,
    height: 35,
    borderRadius: 20,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#665f50", fontWeight: "500" },
  content: {
    padding: 22,
    paddingBottom: 24,
    maxWidth: 760,
    width: "100%",
    alignSelf: "center",
  },
  eyebrow: {
    fontSize: 9,
    letterSpacing: 1.6,
    fontWeight: "500",
    color: colors.muted,
    marginBottom: 9,
    marginTop: 5,
  },
  heading: {
    fontSize: 29,
    lineHeight: 37,
    fontWeight: "500",
    letterSpacing: -0.9,
    color: colors.ink,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 21,
    color: colors.muted,
    marginBottom: 25,
  },
  small: { fontSize: 12, lineHeight: 19, color: colors.muted, marginTop: 4 },
  card: {
    backgroundColor: theme.background,
    borderColor: colors.line,
    borderRadius: 0,
    padding: 0,
    borderWidth: 0,
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "400",
    color: colors.ink,
    marginBottom: 12,
    flexShrink: 1,
  },
  between: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  roomBanner: {
    backgroundColor: colors.sage,
    borderRadius: 20,
    padding: 16,
    marginVertical: 14,
  },
  roomTitle: {
    fontSize: 17,
    fontWeight: "400",
    color: theme.text,
    marginBottom: 4,
    marginTop: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: theme.line,
  },
  rowTitle: {
    fontSize: 14,
    flexShrink: 1,
    fontWeight: "400",
    color: theme.text,
    lineHeight: 20,
  },
  grow: { flex: 1, minWidth: 0 },
  checkTouch: { minWidth: 44, minHeight: 44, justifyContent: "center" },
  check: {
    width: 21,
    height: 21,
    borderWidth: 1,
    borderColor: "#bfd0c8",
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  checked: { backgroundColor: theme.teal, borderColor: theme.active },
  strike: { textDecorationLine: "line-through", color: "#8b9e91" },
  iconTouch: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { fontSize: 13, lineHeight: 22, color: colors.muted, marginBottom: 15 },
  button: {
    backgroundColor: colors.teal,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
    minHeight: 46,
    marginTop: 4,
  },
  secondary: {
    backgroundColor: theme.background,
    borderWidth: 1,
    borderColor: theme.line,
  },
  buttonText: { fontSize: 12, fontWeight: "400", color: "#fff" },
  pressed: { opacity: 0.7 },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "400",
    color: colors.ink,
    marginTop: 19,
    marginBottom: 17,
  },
  eventArt: {
    borderRadius: 10,
    padding: 24,
    alignItems: "center",
    gap: 12,
    marginBottom: 17,
  },
  artText: {
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    fontSize: 18,
    fontStyle: "italic",
    color: "#375d58",
  },
  chips: { gap: 8, paddingBottom: 16 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.line,
    backgroundColor: theme.background,
    minHeight: 44,
    justifyContent: "center",
  },
  chipActive: { backgroundColor: theme.raised, borderColor: theme.active },
  chipText: { fontSize: 12, color: theme.muted, fontWeight: "400" },
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
    marginBottom: 20,
  },
  balance: {
    fontSize: 31,
    fontWeight: "500",
    color: theme.text,
    marginVertical: 4,
  },
  fairRow: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  track: {
    height: 6,
    backgroundColor: theme.background,
    borderRadius: 5,
    overflow: "hidden",
    marginVertical: 12,
  },
  fill: { height: 6, backgroundColor: "#749b88", borderRadius: 5 },
  history: {
    padding: 13,
    backgroundColor: theme.surface,
    color: theme.muted,
    fontSize: 12,
    lineHeight: 20,
    marginBottom: 8,
    borderRadius: 7,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 20,
    gap: 12,
  },
  coffeeIcon: {
    width: 55,
    height: 55,
    borderRadius: 16,
    backgroundColor: theme.raised,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  success: { color: "#a0c6b2", fontSize: 12, marginTop: 15, lineHeight: 19 },
  footer: {
    textAlign: "center",
    fontSize: 10,
    color: "#91a28f",
    marginVertical: 18,
  },
  bottomNav: {
    flexDirection: "row",
    backgroundColor: theme.background,
    paddingTop: 10,
    paddingBottom: 8,
    paddingHorizontal: 8,
    borderTopLeftRadius: 19,
    borderTopRightRadius: 19,
  },
  navItem: { flex: 1, alignItems: "center", padding: 3, gap: 3 },
  navIcon: { paddingVertical: 5, paddingHorizontal: 16, borderRadius: 12 },
  navActive: { backgroundColor: theme.raised },
  navLabel: { fontSize: 9, color: "#8ba6a7", marginBottom: 3 },
  info: {
    padding: 15,
    backgroundColor: theme.surface,
    borderRadius: 10,
    marginBottom: 16,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: theme.background,
  },
  modalKeyboard: { flex: 1 },
  modalSafe: { flex: 1 },
  modal: {
    backgroundColor: colors.bg,
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 12,
    flex: 1,
    width: "100%",
    maxWidth: 600,
    alignSelf: "center",
  },
  composerTitle: { fontSize: 23, color: theme.text, letterSpacing: -0.6 },
  composerContext: { fontSize: 12, color: theme.muted, marginBottom: 22 },
  titleInput: { fontSize: 23, lineHeight: 31, minHeight: 62, letterSpacing: -0.4 },
  field: { marginBottom: 18 },
  fieldLabel: { fontSize: 12, fontWeight: "400", color: theme.muted },
  input: {
    backgroundColor: theme.background,
    borderBottomWidth: 1,
    borderColor: theme.line,
    borderRadius: 0,
    paddingVertical: 14,
    paddingHorizontal: 0,
    fontSize: 15,
    color: colors.ink,
    marginTop: 8,
    minHeight: 48,
  },
  fieldError: { color: "#e8ad9f", fontSize: 12, lineHeight: 18, marginTop: 6 },
  error: { color: "#e8ad9f", fontSize: 12, lineHeight: 20, marginBottom: 15 },
});
