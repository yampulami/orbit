import React, { useState } from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Touch from "./Touch";
import SearchField from "./SearchField";
import { theme as t } from "./theme";
import { discoverClubs } from "../../src/discovery";
import type { StudentProfile } from "../../src/studentProfile";
import type { State } from "../../src/model";

type IconName = React.ComponentProps<typeof Ionicons>["name"];
const events = [
  {
    id: "ev1",
    name: "Sunset on the quad",
    date: "18",
    month: "SEP",
    time: "5:30 PM",
    place: "The main quad",
    category: "Outdoors",
  },
  {
    id: "ev2",
    name: "A little coffee, a little code",
    date: "19",
    month: "SEP",
    time: "10 AM",
    place: "Student Union Café",
    category: "Technology",
  },
  {
    id: "ev3",
    name: "Find your people",
    date: "22",
    month: "SEP",
    time: "Noon",
    place: "Student center",
    category: "Club fair",
  },
];
const dining = [
  {
    name: "Maple Dining Hall",
    food: "Harvest grain bowl",
    hours: "7 AM – 9 PM",
    veg: true,
  },
  {
    name: "Student Union Café",
    food: "Avocado toast & cold brew",
    hours: "8 AM – 6 PM",
    veg: true,
  },
  {
    name: "The Commons Grill",
    food: "Grilled chicken sandwich",
    hours: "11 AM – 10 PM",
    veg: false,
  },
];
export default function CampusScreen({
  state,
  save,
  profile,
  category,
  onCategoryChange,
}: {
  state: State;
  save: (fn: (s: State) => State) => void;
  profile: StudentProfile;
  category: string;
  onCategoryChange: (value: string) => void;
}) {
  const [query, setQuery] = useState(""),
    [savedOnly, setSavedOnly] = useState(false),
    [veg, setVeg] = useState(false);
  const matches = (text: string) =>
    text.toLowerCase().includes(query.trim().toLowerCase());
  const clubs = discoverClubs(profile, query, state.joined, savedOnly);
  const visibleEvents = events.filter(
    (e) =>
      matches(`${e.name} ${e.place} ${e.category}`) &&
      (!savedOnly || state.rsvps.includes(e.id)),
  );
  const menus = dining.filter(
    (h) => matches(`${h.name} ${h.food}`) && (!veg || h.veg),
  );
  const count =
    category === "Clubs"
      ? clubs.length
      : category === "Events"
        ? visibleEvents.length
        : menus.length;
  function toggleSaved(kind: "joined" | "rsvps", value: string) {
    save((current) => ({
      ...current,
      [kind]: current[kind].includes(value)
        ? current[kind].filter((x) => x !== value)
        : [...current[kind], value],
    }));
  }
  function bookmark(label: string, selected: boolean, onPress: () => void) {
    return (
      <Touch
        accessibilityRole="button"
        accessibilityLabel={`${selected ? "Unsave" : "Save"} ${label}`}
        accessibilityState={{ selected }}
        aria-pressed={selected}
        onPress={onPress}
        style={s.bookmark}
      >
        <Ionicons
          accessible={false}
          name={selected ? "bookmark" : "bookmark-outline"}
          size={22}
          color={selected ? t.active : t.muted}
        />
      </Touch>
    );
  }
  return (
    <View>
      <View accessibilityRole="tablist" style={s.tabs}>
        {["Events", "Clubs", "Dining", "Services"].map((item) => (
          <Touch
            key={item}
            accessibilityRole="tab"
            accessibilityState={{ selected: item === category }}
            aria-selected={item === category}
            onPress={() => {
              onCategoryChange(item);
              setQuery("");
              setSavedOnly(false);
            }}
            style={[s.tab, item === category && s.selectedTab]}
          >
            <Text style={[s.tabText, item === category && { color: t.text }]}>
              {item}
            </Text>
          </Touch>
        ))}
      </View>
      <View style={s.context}>
        <View style={s.sample}>
          <Text style={s.sampleText}>SAMPLE CONTENT</Text>
        </View>
        <Text style={s.caption}>Saved on this device</Text>
      </View>
      {category !== "Services" && (
        <>
          <SearchField
            label="Search campus"
            value={query}
            onChange={setQuery}
            placeholder={`Search ${category.toLowerCase()}`}
          />
          <View style={s.filterRow}>
            <Text accessibilityLiveRegion="polite" style={s.caption}>
              {count}{" "}
              {category === "Dining"
                ? count === 1
                  ? "place"
                  : "places"
                : count === 1
                  ? category.toLowerCase().slice(0, -1)
                  : category.toLowerCase()}
              {category === "Clubs" && !savedOnly
                ? " · interest matches first"
                : ""}
            </Text>
            {category === "Dining" ? (
              <View style={s.switch}>
                <Text style={s.caption}>Vegetarian</Text>
                <Switch
                  accessibilityLabel="Vegetarian only"
                  value={veg}
                  onValueChange={setVeg}
                  trackColor={{ false: t.line, true: t.teal }}
                  thumbColor={t.cream}
                />
              </View>
            ) : (
              <Touch
                accessibilityRole="button"
                accessibilityLabel="Show saved only"
                accessibilityState={{ selected: savedOnly }}
                aria-pressed={savedOnly}
                onPress={() => setSavedOnly(!savedOnly)}
                style={[s.filter, savedOnly && { backgroundColor: t.raised }]}
              >
                <Ionicons
                  name={savedOnly ? "bookmark" : "bookmark-outline"}
                  size={15}
                  color={t.active}
                />
                <Text style={s.filterText}>Saved</Text>
              </Touch>
            )}
          </View>
          {!count && (
            <View style={s.empty}>
              <Ionicons
                name={savedOnly ? "bookmark-outline" : "search-outline"}
                size={30}
                color={t.active}
              />
              <Text style={s.title}>
                {savedOnly && !query ? "Nothing saved yet" : "No matches"}
              </Text>
              <Text style={s.caption}>
                {savedOnly && !query
                  ? "Bookmark something you want to come back to."
                  : "Try another search or clear your filters."}
              </Text>
              <Touch
                accessibilityRole="button"
                onPress={() => {
                  setQuery("");
                  setSavedOnly(false);
                  setVeg(false);
                }}
                style={s.reset}
              >
                <Text style={s.filterText}>
                  Show all {category.toLowerCase()}
                </Text>
              </Touch>
            </View>
          )}
        </>
      )}
      {category === "Events" &&
        visibleEvents.map((event) => (
          <View key={event.id} style={s.row}>
            <View style={s.date}>
              <Text style={s.day}>{event.date}</Text>
              <Text style={s.month}>{event.month}</Text>
            </View>
            <View style={s.grow}>
              <Text style={s.meta}>{event.category}</Text>
              <Text style={s.title}>{event.name}</Text>
              <Text style={s.caption}>
                {event.time} · {event.place}
              </Text>
            </View>
            {bookmark(event.name, state.rsvps.includes(event.id), () =>
              toggleSaved("rsvps", event.id),
            )}
          </View>
        ))}
      {category === "Clubs" &&
        clubs.map((club) => (
          <View key={club.name} style={s.row}>
            <View style={s.mark}>
              <Ionicons
                name={club.icon as IconName}
                size={24}
                color={t.active}
              />
            </View>
            <View style={s.grow}>
              <Text style={s.meta}>{club.category}</Text>
              <Text style={s.title}>{club.name}</Text>
              <Text style={s.caption}>{club.description}</Text>
              {!!club.reasons.length && (
                <Text style={s.reason}>
                  Matches {club.reasons.slice(0, 2).join(" + ")}
                </Text>
              )}
            </View>
            {bookmark(club.name, state.joined.includes(club.name), () =>
              toggleSaved("joined", club.name),
            )}
          </View>
        ))}
      {category === "Clubs" && (
        <Text style={s.footnote}>
          Saving a club keeps it on your list. It doesn’t enroll you or contact
          the club.
        </Text>
      )}
      {category === "Dining" &&
        menus.map((hall) => (
          <View key={hall.name} style={s.row}>
            <View style={s.mark}>
              <Ionicons
                name={hall.veg ? "leaf-outline" : "restaurant-outline"}
                size={23}
                color={t.active}
              />
            </View>
            <View style={s.grow}>
              <Text style={s.meta}>{hall.hours}</Text>
              <Text style={s.title}>{hall.name}</Text>
              <Text style={s.caption}>{hall.food}</Text>
              {hall.veg && <Text style={s.reason}>Vegetarian option</Text>}
            </View>
          </View>
        ))}
      {category === "Services" && (
        <>
          <Text style={s.footnote}>
            These services need an official university connection.
          </Text>
          {[
            {
              name: "Safety & alerts",
              icon: "shield-checkmark-outline",
              detail: "Official alerts and reporting are not connected.",
            },
            {
              name: "Study rooms",
              icon: "library-outline",
              detail: "Room availability and booking are not connected.",
            },
            {
              name: "Campus jobs",
              icon: "briefcase-outline",
              detail: "University job listings are not connected.",
            },
          ].map((service) => (
            <View key={service.name} style={s.row}>
              <View style={s.mark}>
                <Ionicons
                  name={service.icon as IconName}
                  size={23}
                  color={t.muted}
                />
              </View>
              <View style={s.grow}>
                <Text style={s.title}>{service.name}</Text>
                <Text style={s.caption}>{service.detail}</Text>
              </View>
            </View>
          ))}
        </>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  tabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: t.line,
    gap: 20,
  },
  tab: {
    minHeight: 46,
    justifyContent: "center",
    borderBottomWidth: 2,
    borderColor: "transparent",
  },
  selectedTab: { borderColor: t.active },
  tabText: { fontSize: 14, color: t.muted },
  context: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginVertical: 16,
  },
  sample: {
    paddingVertical: 5,
    paddingHorizontal: 7,
    borderRadius: 4,
    backgroundColor: t.surface,
  },
  sampleText: { color: t.active, fontSize: 9, letterSpacing: 1 },
  caption: { color: t.muted, fontSize: 12, lineHeight: 19 },
  search: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: t.surface,
    borderRadius: 10,
    paddingLeft: 13,
  },
  input: {
    color: t.text,
    fontSize: 15,
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 10,
    borderBottomWidth: 0,
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: 10,
    gap: 8,
  },
  filter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    minHeight: 44,
    paddingHorizontal: 11,
    borderRadius: 7,
  },
  filterText: { fontSize: 12, color: t.active },
  switch: { flexDirection: "row", alignItems: "center", gap: 7 },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 19,
    borderBottomWidth: 1,
    borderColor: t.line,
  },
  grow: { flex: 1, gap: 5 },
  mark: {
    width: 40,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  bookmark: {
    width: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  meta: { fontSize: 10, color: t.muted },
  title: { fontSize: 16, lineHeight: 22, color: t.text, fontWeight: "500" },
  reason: { fontSize: 11, lineHeight: 17, color: t.active, marginTop: 3 },
  date: {
    width: 44,
    paddingVertical: 9,
    borderRadius: 7,
    backgroundColor: t.raised,
    alignItems: "center",
  },
  day: { fontSize: 22, color: t.text },
  month: { fontSize: 9, color: t.muted, letterSpacing: 1 },
  empty: { paddingVertical: 30, alignItems: "center", gap: 10 },
  reset: { minHeight: 44, justifyContent: "center" },
  footnote: {
    fontSize: 11,
    lineHeight: 18,
    color: t.muted,
    marginTop: 18,
    paddingBottom: 10,
  },
});
