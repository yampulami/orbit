import Pressable from "./Touch";
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SpaceDrawing } from "./LineArt";
import { theme } from "./theme";
import {
  profileSuggestions,
  type StudentProfile,
} from "../../src/studentProfile";
import { planTimeline, priorityTasks } from "../../src/ux";
import { useCurrentTime } from "./useCurrentTime";
import { balances, money, type State, type Space } from "../../src/model";

type IconName = React.ComponentProps<typeof Ionicons>["name"];
type Props = {
  state: State;
  profile: StudentProfile;
  space: Space;
  open: (kind: string) => void;
  roommates: (section: string, mine?: boolean) => void;
  hangouts: () => void;
  campus: () => void;
  exploreClubs: () => void;
  planDetails: (id: string) => void;
  toggleTask: (id: string) => void;
};

export default function HomeDashboard({
  state,
  profile,
  space,
  open,
  roommates,
  hangouts,
  campus,
  exploreClubs,
  planDetails,
  toggleTask,
}: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const now = useCurrentTime();
  const pending = priorityTasks(space.tasks);
  const own = pending.filter((t) => t.owner === "You");
  const groceries = space.groceries.filter((g) => !g.done);
  const balance = balances(space.expenses).You;
  const { upcoming } = planTimeline(state.hangouts, now);
  const nextPlan = upcoming[0];
  const actions: { label: string; kind: string; icon: IconName }[] = [
    { label: "Task", kind: "task", icon: "checkbox-outline" },
    { label: "Grocery", kind: "grocery", icon: "basket-outline" },
    { label: "Expense", kind: "expense", icon: "receipt-outline" },
    { label: "Plan", kind: "hangout", icon: "cafe-outline" },
  ];
  function accordion(
    id: string,
    label: string,
    detail: string,
    count: string,
    icon: IconName,
    children: React.ReactNode,
  ) {
    const isOpen = expanded === id;
    return (
      <View style={h.section}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}, ${detail}`}
          accessibilityState={{ expanded: isOpen }}
          aria-expanded={isOpen}
          onPress={() => setExpanded(isOpen ? null : id)}
          style={h.sectionHeader}
        >
          <View style={h.sectionIcon}>
            <Ionicons name={icon} size={19} color="#a6c5c7" />
          </View>
          <View style={h.grow}>
            <Text style={h.sectionTitle}>{label}</Text>
            <Text numberOfLines={1} style={h.detail}>
              {detail}
            </Text>
          </View>
          <Text style={h.badge}>{count}</Text>
          <Ionicons
            accessible={false}
            name={isOpen ? "chevron-up" : "chevron-down"}
            size={15}
            color="#99b4b7"
          />
        </Pressable>
        {isOpen && <View style={h.expanded}>{children}</View>}
      </View>
    );
  }
  return (
    <View style={h.dashboard}>
      {profile.lifestyle !== "Commuter" && (
        <View style={h.summary}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open ${space.name}`}
            onPress={() => roommates("Tasks")}
            style={h.space}
          >
            <View style={h.grow}>
              <Text style={h.overline}>YOUR SPACE</Text>
              <Text style={h.spaceName}>{space.name}</Text>
              <Text style={h.spaceDetail}>
                {pending.length} chores · {groceries.length} groceries
              </Text>
            </View>
            <SpaceDrawing />
          </Pressable>
          <View style={h.metrics}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${own.length} your to-dos`}
              onPress={() => roommates("Tasks", true)}
              style={[h.metric, h.todoMetric]}
            >
              <View style={h.metricTop}>
                <Ionicons
                  name="checkmark-done-outline"
                  size={19}
                  color="#aac7ca"
                />
                <Ionicons
                  accessible={false}
                  name="arrow-up-outline"
                  size={13}
                  color="#aac7ca"
                  style={h.arrow}
                />
              </View>
              <View style={h.metricBottom}>
                <Text style={h.todoNumber}>{own.length}</Text>
                <Text style={h.todoLabel}>Your to-dos</Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${balance >= 0 ? "Owed to you" : "You owe"} ${money(Math.abs(balance))}`}
              onPress={() => roommates("Expenses")}
              style={[h.metric, h.moneyMetric]}
            >
              <View style={h.metricTop}>
                <Text style={h.moneyLabel}>
                  {balance >= 0 ? "Owed to you" : "You owe"}
                </Text>
                <Ionicons
                  accessible={false}
                  name="arrow-up-outline"
                  size={13}
                  color="#aac7ca"
                  style={h.arrow}
                />
              </View>
              <Text
                adjustsFontSizeToFit
                minimumFontScale={0.8}
                numberOfLines={1}
                style={h.moneyNumber}
              >
                {money(Math.abs(balance))}
              </Text>
            </Pressable>
          </View>
        </View>
      )}
      <View style={h.actions}>
        {actions.map((a) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Add ${a.label.toLowerCase()}`}
            onPress={() => open(a.kind)}
            style={h.action}
            key={a.kind}
          >
            <View style={h.actionIcon}>
              <Ionicons
                accessible={false}
                name={a.icon}
                size={22}
                color={theme.text}
              />
            </View>
            <Text style={h.actionLabel}>{a.label}</Text>
          </Pressable>
        ))}
      </View>
      <View>
        <Text style={h.sectionHeading}>
          {profile.lifestyle === "Commuter"
            ? "Between classes"
            : "For your Orbit"}
        </Text>
        {profileSuggestions(profile)
          .slice(0, profile.lifestyle === "Commuter" ? 2 : 1)
          .map((item) => (
            <Pressable
              key={item.title}
              accessibilityRole="button"
              accessibilityLabel={item.title}
              onPress={
                item.destination === "hangouts" ? hangouts : exploreClubs
              }
              style={h.link}
            >
              <View style={{ flex: 1 }}>
                <Text style={h.taskTitle}>{item.title}</Text>
                <Text style={h.detail}>{item.detail}</Text>
              </View>
              <Ionicons name="arrow-forward" size={18} color={theme.active} />
            </Pressable>
          ))}
      </View>
      <Text style={h.sectionHeading}>Your activity</Text>
      <View style={h.sections}>
        {accordion(
          "room",
          "Roommates",
          pending.length ? pending[0].title : "All chores done",
          String(pending.length),
          "people-outline",
          <>
            {!pending.length && (
              <Text style={h.detail}>All caught up in this space.</Text>
            )}
            {pending.slice(0, 3).map((t) => (
              <Pressable
                key={t.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: false }}
                accessibilityLabel={`Complete ${t.title}`}
                onPress={() => toggleTask(t.id)}
                style={h.task}
              >
                <Ionicons name="square-outline" color="#a3bfc1" size={19} />
                <Text style={h.taskTitle}>{t.title}</Text>
                <Text style={h.detail}>{t.owner}</Text>
              </Pressable>
            ))}
            <Pressable
              accessibilityRole="button"
              onPress={() => roommates("Tasks")}
              style={h.link}
            >
              <Text style={h.linkText}>Open shared space</Text>
              <Ionicons name="arrow-forward" color="#abc9cb" size={16} />
            </Pressable>
          </>,
        )}
        {accordion(
          "plans",
          "Hangouts",
          nextPlan?.title || "No upcoming plans",
          String(upcoming.length),
          "cafe-outline",
          <>
            {!upcoming.length && (
              <Text style={h.detail}>Make a plan when you’re ready.</Text>
            )}
            {upcoming.slice(0, 2).map((p) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`View plan ${p.title}`}
                onPress={() => planDetails(p.id)}
                style={h.plan}
                key={p.id}
              >
                <Text style={h.taskTitle}>{p.title}</Text>
                <Text style={h.detail}>
                  {new Date(p.date).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}{" "}
                  · {p.votes.length}/4 available
                </Text>
              </Pressable>
            ))}
            <Pressable
              accessibilityRole="button"
              onPress={hangouts}
              style={h.link}
            >
              <Text style={h.linkText}>View plans & vote</Text>
              <Ionicons name="arrow-forward" color="#abc9cb" size={16} />
            </Pressable>
          </>,
        )}
        {accordion(
          "campus",
          "Campus",
          "Events, clubs & dining",
          "Demo",
          "compass-outline",
          <>
            <Text style={h.detail}>
              Sample events and menus. Live campus services aren’t connected
              yet.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={campus}
              style={h.link}
            >
              <Text style={h.linkText}>Explore campus</Text>
              <Ionicons name="arrow-forward" color="#abc9cb" size={16} />
            </Pressable>
          </>,
        )}
      </View>
    </View>
  );
}

const h = StyleSheet.create({
  dashboard: { gap: 18 },
  summary: {
    backgroundColor: theme.teal,
    borderRadius: 18,
    overflow: "hidden",
  },
  grow: { flex: 1 },
  space: {
    backgroundColor: theme.teal,
    borderRadius: 0,
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  overline: {
    color: "#d7e3e1",
    fontSize: 9,
    fontWeight: "400",
    marginBottom: 6,
  },
  spaceName: { color: theme.text, fontSize: 18, fontWeight: "400" },
  spaceDetail: { fontSize: 10, color: "#d0dfde", marginTop: 7 },
  metrics: {
    flexDirection: "row",
    marginHorizontal: 18,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderColor: "#7cabb044",
  },
  metric: {
    flex: 1,
    paddingHorizontal: 0,
    paddingVertical: 0,
    justifyContent: "space-between",
    gap: 4,
  },
  todoMetric: {
    borderRightWidth: 1,
    borderColor: "#7cabb044",
    marginRight: 18,
  },
  moneyMetric: {},
  metricTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  metricBottom: { flexDirection: "row", alignItems: "baseline", gap: 9 },
  arrow: { transform: [{ rotate: "45deg" }] },
  todoNumber: { fontSize: 26, fontWeight: "400", color: theme.text },
  todoLabel: { color: "#c1d0d0", fontSize: 11, flexShrink: 1 },
  moneyLabel: { color: "#d0dfde", fontSize: 10 },
  moneyNumber: {
    fontSize: 25,
    fontWeight: "400",
    color: theme.text,
    marginTop: 6,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    paddingTop: 0,
    paddingBottom: 0,
  },
  action: { alignItems: "center", gap: 7, minWidth: 60, minHeight: 76 },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.line,
    backgroundColor: theme.background,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: { fontSize: 12, color: "#bdc6c4" },
  sectionHeading: {
    fontSize: 14,
    color: theme.text,
    fontWeight: "400",
    marginTop: 0,
  },
  sections: { gap: 0 },
  section: {
    backgroundColor: theme.background,
    borderBottomWidth: 1,
    borderBottomColor: "#172b30",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 0,
    paddingVertical: 9,
    minHeight: 60,
  },
  sectionIcon: {
    width: 37,
    height: 37,
    backgroundColor: theme.background,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    color: theme.text,
    fontSize: 14,
    fontWeight: "400",
    marginBottom: 4,
  },
  detail: { color: "#a4b5b7", fontSize: 12, lineHeight: 18 },
  badge: {
    color: "#b9c8c8",
    fontSize: 10,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  expanded: { paddingHorizontal: 0, paddingBottom: 6, paddingTop: 4 },
  task: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    minHeight: 46,
    paddingVertical: 8,
  },
  taskTitle: { color: theme.text, fontSize: 14, lineHeight: 20, flex: 1 },
  plan: { paddingVertical: 7, gap: 3 },
  link: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 44,
    paddingVertical: 10,
  },
  linkText: { fontSize: 13, fontWeight: "400", color: "#a6ccd0" },
});
