import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Touch from "./Touch";
import { theme as t } from "./theme";

type Option = { value: string; label: string; detail?: string };
export function ChoiceField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const selected = options.find((option) => option.value === value);
  return (
    <View style={s.field}>
      <Touch
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected?.label ?? value}`}
        accessibilityState={{ expanded }}
        aria-expanded={expanded}
        onPress={() => setExpanded(!expanded)}
        style={s.summary}
      >
        <Text style={s.label}>{label}</Text>
        <Text style={s.selected}>{selected?.label ?? value}</Text>
        <Ionicons
          accessible={false}
          name={expanded ? "chevron-up" : "chevron-down"}
          size={16}
          color={t.muted}
        />
      </Touch>
      {expanded && (
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel={label}
          style={s.options}
        >
          {options.map((option) => (
            <Touch
              key={option.value}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ checked: value === option.value }}
              aria-checked={value === option.value}
              onPress={() => {
                onChange(option.value);
                setExpanded(false);
              }}
              style={s.option}
            >
              <View style={s.grow}>
                <Text style={s.optionText}>{option.label}</Text>
                {option.detail && <Text style={s.detail}>{option.detail}</Text>}
              </View>
              <Ionicons
                accessible={false}
                name={
                  value === option.value
                    ? "radio-button-on"
                    : "radio-button-off"
                }
                size={20}
                color={value === option.value ? t.active : t.muted}
              />
            </Touch>
          ))}
        </View>
      )}
    </View>
  );
}
const effortLabels = ["Quick", "Light", "Moderate", "Involved", "Substantial"];
export function EffortField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={s.effort}>
      <View style={s.summary}>
        <Text style={s.label}>Effort</Text>
        <Text style={s.selected}>
          {effortLabels[Number(value) - 1] ?? "Light"}
        </Text>
      </View>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Task effort"
        style={s.segments}
      >
        {effortLabels.map((label, index) => {
          const point = String(index + 1),
            active = point === value;
          return (
            <Touch
              key={point}
              accessibilityRole="radio"
              accessibilityLabel={`${point}: ${label}`}
              accessibilityState={{ checked: active }}
              aria-checked={active}
              onPress={() => onChange(point)}
              style={[s.segment, active && s.active]}
            >
              <Text style={[s.point, active && { color: t.text }]}>
                {point}
              </Text>
            </Touch>
          );
        })}
      </View>
      <Text style={s.detail}>Used to balance the work across your space.</Text>
    </View>
  );
}
const s = StyleSheet.create({
  field: { borderBottomWidth: 1, borderColor: t.line },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 58,
  },
  label: { color: t.muted, fontSize: 13 },
  selected: { color: t.text, flex: 1, textAlign: "right", fontSize: 15 },
  options: { paddingBottom: 12 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingVertical: 13,
    paddingHorizontal: 12,
    minHeight: 50,
  },
  grow: { flex: 1, gap: 4 },
  optionText: { color: t.text, fontSize: 15 },
  detail: { color: t.muted, fontSize: 12, lineHeight: 18 },
  effort: { marginBottom: 16 },
  segments: {
    flexDirection: "row",
    backgroundColor: t.surface,
    borderRadius: 8,
    padding: 4,
    marginBottom: 10,
    gap: 4,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 5,
  },
  active: { backgroundColor: t.teal },
  point: { color: t.muted, fontSize: 16, fontVariant: ["tabular-nums"] },
});
