import SearchField from "./SearchField";
import Pressable from "./Touch";
import React, { useState } from "react";
import { ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme as t } from "./theme";
import { planTimeline } from "../../src/ux";
import { useCurrentTime } from "./useCurrentTime";

import {
  members,
  money,
  balances,
  type State,
  type Space,
} from "../../src/model";
type IconName = React.ComponentProps<typeof Ionicons>["name"];
type Save = (fn: (state: State) => State) => void;
const I = ({
  name,
  color = t.text,
  size = 20,
}: {
  name: IconName;
  color?: string;
  size?: number;
}) => <Ionicons accessible={false} name={name} size={size} color={color} />;
function Pill({
  label,
  onPress,
  light = false,
}: {
  label: string;
  onPress: () => void;
  light?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[d.pill, light && { backgroundColor: t.cream }]}
    >
      <Text style={[d.pillText, light && { color: t.onCream }]}>{label}</Text>
    </Pressable>
  );
}
function People({ names = members }: { names?: string[] }) {
  return (
    <View style={d.people}>
      {names.map((name, i) => (
        <View
          key={name}
          style={[
            d.person,
            {
              backgroundColor: ["#cfcbc2", "#75959a", "#517582", "#b7a99d"][
                i % 4
              ],
            },
          ]}
        >
          <Text style={d.initial}>{name[0]}</Text>
        </View>
      ))}
    </View>
  );
}
export function SectionTabs({
  values,
  value,
  onChange,
}: {
  values: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={d.tabs}
    >
      {values.map((v) => (
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: v === value }}
          aria-selected={v === value}
          key={v}
          onPress={() => onChange(v)}
          style={[d.tab, v === value && d.tabSelected]}
        >
          <Text style={[d.tabText, v === value && { color: t.text }]}>{v}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
export function RoommateOverview({
  state,
  space,
  save,
  open,
}: {
  state: State;
  space: Space;
  save: Save;
  open: (kind: string) => void;
}) {
  const [switching, setSwitching] = useState(false);
  const [details, setDetails] = useState(false);
  const done = space.tasks.filter((x) => x.done).length;
  const balance = balances(space.expenses).You;
  return (
    <>
      <View style={d.spaceCard}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Choose roommate space, ${space.name}`}
          accessibilityState={{ expanded: switching }}
          onPress={() => setSwitching(!switching)}
          style={d.spaceTop}
        >
          <View style={d.flex}>
            <Text style={[d.overline, { color: "#ffffff", marginBottom: 4 }]}>
              SHARED LIVING
            </Text>
            <Text style={d.spaceTitle}>{space.name}</Text>
          </View>
          <I name="chevron-down" size={16} />
        </Pressable>
        <View style={d.compactStats}>
          <Text style={d.compactText}>
            {done}/{space.tasks.length} chores done
          </Text>
          <Text style={d.compactText}>
            {balance >= 0 ? "Owed to you" : "You owe"}{" "}
            {money(Math.abs(balance))}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: details }}
          accessibilityLabel="Room details"
          onPress={() => setDetails(!details)}
          style={d.detailsToggle}
        >
          <Text style={d.compactText}>
            4 roommates · {details ? "Hide details" : "Details"}
          </Text>
          <I name={details ? "chevron-up" : "chevron-down"} size={15} />
        </Pressable>
        {details && (
          <View style={{ gap: 10, paddingTop: 10 }}>
            <People />
            <Text style={d.compactText}>{members.join(" · ")}</Text>
            <Text style={d.compactText}>
              Local demo space · quiet hours {space.quiet}
            </Text>
          </View>
        )}
      </View>
      {switching && (
        <View style={d.spaceChooser}>
          {state.spaces.map((x) => (
            <Pressable
              accessibilityRole="button"
              key={x.id}
              accessibilityState={{ selected: space.id === x.id }}
              onPress={() => {
                save((a) => ({ ...a, active: x.id }));
                setSwitching(false);
              }}
              style={d.chooseRow}
            >
              <Text style={[d.body, { flex: 1 }]}>{x.name}</Text>
              <I
                name={
                  space.id === x.id ? "checkmark-circle" : "ellipse-outline"
                }
              />
            </Pressable>
          ))}
          <Pill label="Create a space" onPress={() => open("space")} />
        </View>
      )}
    </>
  );
}
export function HangoutsScreen({
  state,
  save,
  open,
  vote,
  details,
}: {
  state: State;
  save: Save;
  open: (kind: string) => void;
  vote: (id: string) => void;
  details: (id: string) => void;
}) {
  const [filter, setFilter] = useState("Upcoming");
  const [search, setSearch] = useState("");
  const now = useCurrentTime();
  const timeline = planTimeline(state.hangouts, now);
  const past = filter === "Past";
  const plans = (past ? timeline.past : timeline.upcoming)
    .filter((x) => filter !== "I’m going" || x.votes.includes("You"))
    .filter((x) => x.title.toLowerCase().includes(search.trim().toLowerCase()));
  return (
    <>
      <View style={d.headingRow}>
        <View>
          <Text style={d.pageTitle}>Your plans</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Make a plan"
          style={d.createCircle}
          onPress={() => open("hangout")}
        >
          <I name="add" size={26} />
        </Pressable>
      </View>
      <View style={d.availability}>
        <View style={d.headingRow}>
          <View>
            <Text style={d.availabilityTitle}>Available now</Text>
            <Text style={d.caption}>Your status · on this device</Text>
          </View>
          <Switch
            accessibilityLabel="Free right now"
            value={state.free}
            onValueChange={(free) => save((x) => ({ ...x, free }))}
            trackColor={{ false: "#2d454c", true: t.teal }}
            thumbColor={t.cream}
          />
        </View>
      </View>
      <SectionTabs
        values={["Upcoming", "I’m going", "Past"]}
        value={filter}
        onChange={setFilter}
      />
      <SearchField label="Find a plan" value={search} onChange={setSearch} />
      <Text accessibilityLiveRegion="polite" style={d.caption}>
        {plans.length} {plans.length === 1 ? "plan" : "plans"}
      </Text>
      {!plans.length && (
        <View style={d.empty}>
          <I name="calendar-outline" size={32} />
          <Text style={d.body}>
            {search
              ? "No plans match your search."
              : filter === "I’m going"
                ? "No upcoming plans you’ve joined."
                : past
                  ? "No past plans yet."
                  : "Your next plan starts here."}
          </Text>
          {!!search && (
            <Pill label="Clear search" onPress={() => setSearch("")} />
          )}
          {filter === "I’m going" && (
            <Pill
              label="Browse upcoming plans"
              onPress={() => {
                setFilter("Upcoming");
                setSearch("");
              }}
            />
          )}
          {!search && !past && filter !== "I’m going" && (
            <Pill label="Make a plan" onPress={() => open("hangout")} />
          )}
        </View>
      )}
      {plans.map((plan) => {
        const when = new Date(plan.date),
          cream = false,
          ink = cream ? t.onCream : t.text;
        return (
          <View
            key={plan.id}
            style={[d.planCard, { backgroundColor: t.background }]}
          >
            <View style={d.headingRow}>
              <View style={[d.dateTile, cream && { borderColor: "#aea8a0" }]}>
                <Text style={[d.day, { color: ink }]}>{when.getDate()}</Text>
                <Text style={[d.month, { color: ink }]}>
                  {when
                    .toLocaleString("en-US", { month: "short" })
                    .toUpperCase()}
                </Text>
              </View>
              <View style={d.flex}>
                <Text
                  style={[d.planTime, { color: cream ? "#4d5a5c" : "#b3cbcd" }]}
                >
                  {past ? "Started · " : ""}
                  {when.toLocaleString(undefined, {
                    weekday: "short",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </Text>
                <Text style={[d.planTitle, { color: ink }]}>{plan.title}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`View plan ${plan.title}`}
                onPress={() => details(plan.id)}
                style={{
                  minHeight: 44,
                  minWidth: 44,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <I
                  name="ellipsis-horizontal"
                  size={24}
                  color={cream ? t.onCream : t.active}
                />
                <Text style={[d.caption, { color: ink }]}>Details</Text>
              </Pressable>
            </View>

            <View style={d.planBottom}>
              <View style={d.flex}>
                <View style={d.voteDots}>
                  {members.map((m) => (
                    <View
                      key={m}
                      style={[
                        d.voteDot,
                        {
                          backgroundColor: plan.votes.includes(m)
                            ? cream
                              ? "#3c6874"
                              : "#8ebbc0"
                            : cream
                              ? "#b8b0a9"
                              : "#304e56",
                        },
                      ]}
                    />
                  ))}
                </View>
                <Text
                  style={[d.caption, { color: cream ? "#4a595d" : t.muted }]}
                >
                  {plan.votes.length === 4
                    ? "Everyone’s in"
                    : `${plan.votes.length} of 4 ${past ? "responded" : "available"}`}
                </Text>
              </View>
              {past ? (
                <Text style={d.caption}>
                  {plan.votes.includes("You") ? "You joined" : "Not joined"}
                </Text>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${plan.votes.includes("You") ? "Undo vote for" : "Join"} ${plan.title}`}
                  onPress={() => vote(plan.id)}
                  style={[
                    d.planVote,
                    { backgroundColor: cream ? t.background : t.teal },
                  ]}
                >
                  <Text style={d.pillText}>
                    {plan.votes.includes("You") ? "Going ✓" : "Count me in"}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        );
      })}
      <Text style={d.footnote}>
        {past ? "Plans move here after their start time. " : ""}Local plans ·
        demo participants
      </Text>
    </>
  );
}
export { default as CampusScreen } from "./CampusScreen";
const d = StyleSheet.create({
  compactStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
    paddingTop: 10,
  },
  compactText: {
    color: "#ffffff",
    fontSize: 12,
    lineHeight: 19,
    flexShrink: 1,
  },
  detailsToggle: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  flex: { flex: 1 },
  overline: {
    fontSize: 11,
    letterSpacing: 1.0,
    color: "#aac2c5",
    marginBottom: 8,
  },
  body: { fontSize: 13, color: t.text, lineHeight: 20 },
  caption: { fontSize: 12, color: t.muted, lineHeight: 18 },
  headingRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 15,
  },
  pageTitle: {
    fontSize: 30,
    fontWeight: "400",
    color: t.text,
    letterSpacing: -0.7,
  },
  pill: {
    backgroundColor: t.teal,
    borderRadius: 25,
    paddingHorizontal: 20,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  pillText: { fontSize: 12, color: t.text },
  people: { flexDirection: "row", paddingLeft: 5 },
  person: {
    width: 30,
    height: 30,
    borderRadius: 16,
    marginLeft: -5,
    borderWidth: 2,
    borderColor: "#284d57",
    alignItems: "center",
    justifyContent: "center",
  },
  initial: { fontSize: 10, color: "#172d31" },
  tabs: {
    gap: 24,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: t.line,
  },
  tab: {
    minHeight: 44,
    justifyContent: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabSelected: { borderBottomColor: "#98c0c5" },
  tabText: { fontSize: 13, color: t.muted },
  spaceCard: {
    backgroundColor: t.teal,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
  },
  spaceTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 44,
  },
  spaceTitle: { color: t.text, fontSize: 20, fontWeight: "400" },
  spaceChooser: {
    padding: 16,
    backgroundColor: t.surface,
    borderRadius: 20,
    marginBottom: 16,
  },
  chooseRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 45,
  },
  createCircle: {
    width: 44,
    height: 44,
    borderRadius: 23,
    backgroundColor: t.teal,
    alignItems: "center",
    justifyContent: "center",
  },
  availability: {
    backgroundColor: t.background,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: t.line,
    marginBottom: 18,
  },
  availabilityTitle: { fontSize: 16, color: t.text, marginBottom: 4 },
  planCard: {
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderColor: t.line,
    marginBottom: 4,
  },
  dateTile: {
    width: 46,
    alignItems: "center",
    paddingVertical: 8,
    backgroundColor: t.raised,
    borderRadius: 8,
  },
  day: { fontSize: 23, fontWeight: "400" },
  month: { fontSize: 8, letterSpacing: 1, color: "#b0c7c9", marginTop: 3 },
  planTime: { fontSize: 10, marginBottom: 7 },
  planTitle: { fontSize: 18, lineHeight: 24, fontWeight: "400" },
  planBottom: { flexDirection: "row", gap: 12, alignItems: "center" },
  voteDots: { flexDirection: "row", gap: 4, marginBottom: 6 },
  voteDot: { width: 17, height: 4, borderRadius: 3 },
  planVote: {
    paddingHorizontal: 17,
    minHeight: 44,
    justifyContent: "center",
    borderRadius: 24,
  },
  footnote: {
    fontSize: 10,
    color: "#8ca2a4",
    lineHeight: 17,
    marginVertical: 16,
  },
  empty: { padding: 24, alignItems: "center", gap: 15 },
});
