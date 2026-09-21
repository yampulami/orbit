import TextInput from "./FocusInput";
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
      {!plans.length && (
        <View style={d.empty}>
          <I name="calendar-outline" size={32} />
          <Text style={d.body}>
            {search
              ? "No plans match your search."
              : filter === "I’m going"
                ? "No upcoming plans you’ve joined."
                : past ? "No past plans yet." : "Your next plan starts here."}
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
          <Pill label="Make a plan" onPress={() => open("hangout")} />
        </View>
      )}
      <TextInput
        accessibilityLabel="Find a plan"
        placeholder="Find a plan"
        placeholderTextColor={t.muted}
        style={d.search}
        value={search}
        onChangeText={setSearch}
      />
      {plans.map((plan, i) => {
        const when = new Date(plan.date),
          cream = false,
          ink = cream ? t.onCream : t.text;
        return (
          <View
            key={plan.id}
            style={[
              d.planCard,
              { backgroundColor: t.background },
            ]}
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
              <Pressable accessibilityRole="button" accessibilityLabel={`View plan ${plan.title}`} onPress={() => details(plan.id)} style={{ minHeight: 44, minWidth: 44, justifyContent: "center", alignItems: "center" }}>
                <I name="ellipsis-horizontal" size={24} color={cream ? t.onCream : t.active} />
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
              {past ? <Text style={d.caption}>{plan.votes.includes("You") ? "You joined" : "Not joined"}</Text> : <Pressable
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
              </Pressable>}
            </View>
          </View>
        );
      })}
      <Text style={d.footnote}>{past ? "Plans move here after their start time. " : ""}Local plans · demo participants</Text>
    </>
  );
}
const eventData = [
  {
    id: "ev1",
    name: "Sunset on the quad",
    date: "18",
    month: "SEP",
    time: "Fri · 5:30 PM",
    place: "The main quad",
    tag: "OUTDOORS",
    icon: "sunny-outline" as IconName,
  },
  {
    id: "ev2",
    name: "A little coffee, a little code",
    date: "19",
    month: "SEP",
    time: "Sat · 10 AM",
    place: "Student Union Café",
    tag: "MEETUP",
    icon: "cafe-outline" as IconName,
  },
  {
    id: "ev3",
    name: "Find your people",
    date: "22",
    month: "SEP",
    time: "Tue · Noon",
    place: "Student center",
    tag: "CLUB FAIR",
    icon: "people-outline" as IconName,
  },
];
const clubs = [
  {
    name: "Outdoor Club",
    tag: "OUTDOORS",
    desc: "Trails, fresh air, and good company.",
    icon: "leaf-outline" as IconName,
  },
  {
    name: "Code Collective",
    tag: "TECHNOLOGY",
    desc: "Build something with your people.",
    icon: "code-slash-outline" as IconName,
  },
  {
    name: "The Creative Corner",
    tag: "ART & CULTURE",
    desc: "Make room for your next idea.",
    icon: "color-palette-outline" as IconName,
  },
];
const halls = [
  {
    name: "Maple Dining Hall",
    food: "Harvest grain bowl",
    hours: "7 AM – 9 PM",
    veg: true,
    icon: "leaf-outline" as IconName,
  },
  {
    name: "Student Union Café",
    food: "Avocado toast & cold brew",
    hours: "8 AM – 6 PM",
    veg: true,
    icon: "cafe-outline" as IconName,
  },
  {
    name: "The Commons Grill",
    food: "Grilled chicken sandwich",
    hours: "11 AM – 10 PM",
    veg: false,
    icon: "restaurant-outline" as IconName,
  },
];
export function CampusScreen({ state, save }: { state: State; save: Save }) {
  const [category, setCategory] = useState("Events"),
    [veg, setVeg] = useState(false);
  const [search, setSearch] = useState("");
  const matches = (value: string) =>
    value.toLowerCase().includes(search.trim().toLowerCase());
  const toggleRsvp = (id: string) =>
    save((x) => ({
      ...x,
      rsvps: x.rsvps.includes(id)
        ? x.rsvps.filter((v) => v !== id)
        : [...x.rsvps, id],
    }));
  return (
    <>
      <View style={d.headingRow}>
        <View>
          <Text style={d.overline}>CAMPUS DISCOVERY</Text>
          <Text style={d.pageTitle}>Out & about.</Text>
        </View>
        <View style={d.previewTag}>
          <Text style={d.caption}>Preview</Text>
        </View>
      </View>
      <SectionTabs
        values={["Events", "Clubs", "Dining", "Services"]}
        value={category}
        onChange={(value) => {
          setCategory(value);
          setSearch("");
        }}
      />
      {category !== "Services" && (
        <TextInput
          accessibilityLabel="Search campus"
          value={search}
          onChangeText={setSearch}
          placeholder={
            category === "Events"
              ? "Find an event or place"
              : category === "Clubs"
                ? "Find a club or interest"
                : "Find food or a dining hall"
          }
          placeholderTextColor={t.muted}
          style={d.search}
        />
      )}
      {category !== "Services" &&
        search !== "" &&
        !(category === "Events"
          ? eventData.some((e) => matches(e.name + " " + e.place))
          : category === "Clubs"
            ? clubs.some((c) => matches(c.name + " " + c.tag + " " + c.desc))
            : halls.some(
                (h) => matches(h.name + " " + h.food) && (!veg || h.veg),
              )) && (
          <View style={d.empty}>
            <Text style={d.body}>No matches. Try a broader search.</Text>
            <Pill label="Clear search" onPress={() => setSearch("")} />
          </View>
        )}
      {category === "Events" && (
        <>
          {matches(eventData[0].name + " " + eventData[0].place) && (
            <View style={d.feature}>
              <View style={d.headingRow}>
                <Text style={d.featureTag}>OUTDOORS · SEP 18</Text>
                <I name="sunny-outline" color="#c6dadd" size={39} />
              </View>
              <Text style={d.featureTitle}>Sunset on{"\n"}the quad.</Text>
              <View style={d.headingRow}>
                <Text style={d.featureDetail}>5:30 PM · The main quad</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="RSVP Sunset on the quad"
                  onPress={() => toggleRsvp("ev1")}
                  style={d.featureRsvp}
                >
                  <Text style={d.featureRsvpText}>
                    {state.rsvps.includes("ev1") ? "Going ✓" : "RSVP ↗"}
                  </Text>
                </Pressable>
              </View>
              <View style={d.featureArc} />
            </View>
          )}
          {!search && <Text style={d.listHeading}>Coming up</Text>}
          {eventData
            .slice(1)
            .filter((ev) => matches(ev.name + " " + ev.place))
            .map((ev) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`RSVP ${ev.name}`}
                onPress={() => toggleRsvp(ev.id)}
                style={d.eventRow}
                key={ev.id}
              >
                <View style={d.smallDate}>
                  <Text style={d.smallDay}>{ev.date}</Text>
                  <Text style={d.month}>{ev.month}</Text>
                </View>
                <View style={d.flex}>
                  <Text style={d.eventTitle}>{ev.name}</Text>
                  <Text style={d.caption}>
                    {ev.time} · {ev.place}
                  </Text>
                </View>
                <I
                  name={
                    state.rsvps.includes(ev.id)
                      ? "checkmark-circle"
                      : "add-circle-outline"
                  }
                  size={23}
                />
              </Pressable>
            ))}
        </>
      )}
      {category === "Clubs" && (
        <>
          <View style={d.clubIntro}>
            <Text style={d.clubIntroTitle}>Find your people.</Text>
            <Text style={d.caption}>
              {state.joined.length} joined · explore a new interest
            </Text>
          </View>
          {clubs
            .filter((club) =>
              matches(club.name + " " + club.tag + " " + club.desc),
            )
            .map((club) => (
              <View style={d.clubRow} key={club.name}>
                <View
                  style={[
                    d.clubMark,
                    {
                      backgroundColor: state.joined.includes(club.name)
                        ? t.teal
                        : t.raised,
                    },
                  ]}
                >
                  <I name={club.icon} size={28} color={t.text} />
                </View>
                <View style={d.flex}>
                  <Text style={d.miniTag}>{club.tag}</Text>
                  <Text style={d.eventTitle}>{club.name}</Text>
                  <Text style={d.caption}>{club.desc}</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${state.joined.includes(club.name) ? "Leave" : "Join"} ${club.name}`}
                    onPress={() =>
                      save((x) => ({
                        ...x,
                        joined: x.joined.includes(club.name)
                          ? x.joined.filter((v) => v !== club.name)
                          : [...x.joined, club.name],
                      }))
                    }
                    style={d.clubJoin}
                  >
                    <Text style={d.linkText}>
                      {state.joined.includes(club.name)
                        ? "Joined ✓ · leave"
                        : "Join club ↗"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))}
        </>
      )}
      {category === "Dining" && (
        <>
          <View style={d.headingRow}>
            <View>
              <Text style={d.listHeading}>What sounds good?</Text>
              <Text style={d.caption}>Sample menus & hours</Text>
            </View>
            <View>
              <Text style={d.miniTag}>VEGETARIAN</Text>
              <Switch
                accessibilityLabel="Vegetarian only"
                value={veg}
                onValueChange={setVeg}
                trackColor={{ false: t.raised, true: t.teal }}
                thumbColor={t.cream}
              />
            </View>
          </View>
          {halls
            .filter((x) => (!veg || x.veg) && matches(x.name + " " + x.food))
            .map((hall, i) => (
              <View
                key={hall.name}
                style={d.diningCard}
              >
                <View style={d.headingRow}>
                  <Text style={[d.miniTag, { color: t.muted }]}>
                    {hall.hours}
                  </Text>
                  <I
                    name={hall.icon}
                    color={t.active}
                    size={28}
                  />
                </View>
                <Text style={[d.diningName, { color: t.text }]}>
                  {hall.name}
                </Text>
                <View
                  style={[d.menuLine, { borderTopColor: t.line }]}
                >
                  <Text style={[d.body, { color: t.text }]}>
                    {hall.food}
                  </Text>
                  {hall.veg && (
                    <Text style={[d.caption, { color: t.muted }]}>
                      Vegetarian
                    </Text>
                  )}
                </View>
              </View>
            ))}
        </>
      )}
      {category === "Services" && (
        <>
          <Text style={d.footnote}>
            Official university connections are needed to activate these
            services.
          </Text>
          {[
            {
              name: "Safety & alerts",
              icon: "shield-checkmark-outline" as IconName,
              desc: "RA notices and official university alerts. This demo does not receive alerts or send reports.",
            },
            {
              name: "Study rooms",
              icon: "library-outline" as IconName,
              desc: "Room availability and reservations. Booking is not connected yet.",
            },
            {
              name: "Campus jobs",
              icon: "briefcase-outline" as IconName,
              desc: "University job listings and application tracking. An official job source is needed.",
            },
          ].map((x) => (
            <View key={x.name} style={d.service}>
              <I name={x.icon} size={24} />
              <View style={d.flex}>
                <Text style={d.eventTitle}>{x.name}</Text>
                <Text style={d.caption}>{x.desc}</Text>
                <Text style={d.serviceStatus}>NOT CONNECTED</Text>
              </View>
            </View>
          ))}
        </>
      )}
      <Text style={d.footnote}>
        Sample campus content · preferences saved on this device
      </Text>
    </>
  );
}
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
  search: {
    minHeight: 46,
    borderBottomWidth: 1,
    borderColor: t.line,
    color: t.text,
    paddingVertical: 12,
    paddingHorizontal: 2,
    marginBottom: 16,
    fontSize: 14,
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
  spaceLower: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    marginBottom: 4,
  },
  onTealSmall: { fontSize: 10, color: "#c3d7d7", marginTop: 8 },
  spaceStats: {
    flexDirection: "row",
    gap: 22,
    alignItems: "center",
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#6c929a",
  },
  statValue: { fontSize: 23, color: t.text },
  statSuffix: { fontSize: 15, color: "#afcdd0" },
  statDivider: { height: 33, width: 1, backgroundColor: "#72939b" },
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
  availabilityTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 17,
  },
  liveLabel: { flexDirection: "row", alignItems: "center", gap: 6 },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  availabilityTitle: { fontSize: 16, color: t.text, marginBottom: 4 },
  planCard: { paddingVertical: 20, borderBottomWidth: 1, borderColor: t.line, marginBottom: 4 },
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
  planDivider: { height: 1, backgroundColor: "#73898b44", marginBottom: 14 },
  planBottom: { flexDirection: "row", gap: 12, alignItems: "center" },
  voteDots: { flexDirection: "row", gap: 4, marginBottom: 6 },
  voteDot: { width: 17, height: 4, borderRadius: 3 },
  planVote: {
    paddingHorizontal: 17,
    minHeight: 42,
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
  previewTag: {
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 15,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  feature: {
    backgroundColor: t.teal,
    borderRadius: 14,
    padding: 20,
    marginBottom: 23,
    overflow: "hidden",
  },
  featureTag: { fontSize: 11, letterSpacing: 1.1, color: "#ffffff" },
  featureTitle: {
    fontSize: 27,
    lineHeight: 32,
    color: t.text,
    marginBottom: 20,
    fontWeight: "400",
  },
  featureDetail: { fontSize: 12, color: "#ffffff", flex: 1 },
  featureRsvp: {
    backgroundColor: t.cream,
    borderRadius: 23,
    minHeight: 44,
    paddingHorizontal: 17,
    justifyContent: "center",
    zIndex: 2,
  },
  featureRsvpText: { fontSize: 11, color: t.onCream },
  featureArc: {
    position: "absolute",
    right: -62,
    top: 60,
    width: 180,
    height: 180,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: "#b9d1d344",
    pointerEvents: "none",
  },
  listHeading: { fontSize: 17, color: t.text, marginBottom: 12 },
  eventRow: {
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
    paddingVertical: 17,
    borderBottomWidth: 1,
    borderBottomColor: t.line,
  },
  smallDate: { width: 42, alignItems: "center" },
  smallDay: { fontSize: 23, color: t.text },
  eventTitle: { fontSize: 15, color: t.text, marginBottom: 6, lineHeight: 21 },
  clubIntro: {
    backgroundColor: t.background,
    borderBottomWidth: 1,
    borderColor: t.line,
    paddingVertical: 16,
    marginBottom: 8,
  },
  clubIntroTitle: { fontSize: 22, color: t.text, marginBottom: 8 },
  clubRow: {
    flexDirection: "row",
    gap: 16,
    paddingVertical: 23,
    borderBottomWidth: 1,
    borderBottomColor: t.line,
  },
  clubMark: {
    width: 54,
    height: 65,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  miniTag: {
    fontSize: 8,
    letterSpacing: 1.1,
    color: "#8ba8ad",
    marginBottom: 6,
  },
  clubJoin: {
    minHeight: 40,
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  linkText: { color: "#b5d3d5", fontSize: 12 },
  diningCard: {
    backgroundColor: t.background,
    borderRadius: 0,
    borderBottomWidth: 1,
    borderColor: t.line,
    paddingVertical: 20,
    marginTop: 0,
  },
  diningName: {
    fontSize: 23,
    color: t.text,
    lineHeight: 29,
    marginVertical: 7,
  },
  menuLine: {
    borderTopWidth: 1,
    borderTopColor: "#3e5960",
    paddingTop: 15,
    marginTop: 12,
    gap: 5,
  },
  service: {
    flexDirection: "row",
    gap: 16,
    paddingVertical: 22,
    borderBottomWidth: 1,
    borderBottomColor: t.line,
  },
  serviceStatus: {
    fontSize: 8,
    letterSpacing: 1,
    color: "#9ab7bb",
    marginTop: 13,
  },
});
