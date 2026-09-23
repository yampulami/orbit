import TextInput from "./FocusInput";
import React, { useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import Touch from "./Touch";
import { theme } from "./theme";

export default function DateField({
  label,
  value,
  onChange,
  mode,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  mode: "date" | "time";
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const parsed = new Date(
    mode === "date" ? value + "T12:00:00" : "2026-01-01T" + value + ":00",
  );
  const selected = Number.isFinite(parsed.getTime()) ? parsed : new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      {Platform.OS === "web" ? (
        <TextInput
          accessibilityLabel={label}
          accessibilityHint={error}
          invalid={!!error}
          value={value}
          onChangeText={onChange}
          placeholder={mode === "date" ? "YYYY-MM-DD" : "HH:MM"}
          placeholderTextColor={theme.muted}
          style={[
            s.control,
            !!error && { borderBottomWidth: 2, borderColor: "#e8ad9f" },
          ]}
        />
      ) : (
        <>
          <Touch
            accessibilityRole="button"
            accessibilityLabel={label + ", " + value}
            accessibilityHint={error}
            onPress={() => setOpen(!open)}
            style={s.control}
          >
            <Text style={s.label}>
              {mode === "date"
                ? selected.toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : selected.toLocaleTimeString(undefined, {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
            </Text>
          </Touch>
          {open && (
            <DateTimePicker
              value={selected}
              mode={mode}
              themeVariant="dark"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={(event, chosen) => {
                if (Platform.OS === "android") setOpen(false);
                if (event.type === "dismissed" || !chosen) return;
                onChange(
                  mode === "date"
                    ? chosen.getFullYear() +
                        "-" +
                        pad(chosen.getMonth() + 1) +
                        "-" +
                        pad(chosen.getDate())
                    : pad(chosen.getHours()) + ":" + pad(chosen.getMinutes()),
                );
              }}
            />
          )}
        </>
      )}
      {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    </View>
  );
}
const s = StyleSheet.create({
  error: { color: "#e8ad9f", fontSize: 12, lineHeight: 18 },
  field: { gap: 8, marginVertical: 10 },
  label: { color: theme.text, fontSize: 14 },
  control: {
    paddingVertical: 14,
    paddingHorizontal: 0,
    minHeight: 48,
    borderRadius: 0,
    borderBottomWidth: 1,
    borderColor: theme.line,
    backgroundColor: theme.background,
    color: theme.text,
  },
});
