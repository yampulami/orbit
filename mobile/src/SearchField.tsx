import React from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Input from "./FocusInput";
import Touch from "./Touch";
import { theme as t } from "./theme";
export default function SearchField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <View style={s.container}>
      <Ionicons
        accessible={false}
        name="search-outline"
        size={19}
        color={t.muted}
      />
      <Input
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder || label}
        placeholderTextColor={t.muted}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        style={s.input}
      />
      {!!value && (
        <Touch
          accessibilityRole="button"
          accessibilityLabel={`Clear ${label.toLowerCase()}`}
          onPress={() => onChange("")}
          style={s.clear}
        >
          <Ionicons accessible={false} name="close" size={19} color={t.muted} />
        </Touch>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 13,
    backgroundColor: t.surface,
    borderRadius: 10,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 10,
    color: t.text,
    fontSize: 15,
    borderBottomWidth: 0,
  },
  clear: {
    width: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
