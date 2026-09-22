import React, { forwardRef, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle, Ellipse } from "react-native-svg";
import Touch from "./Touch";
import { theme as t } from "./theme";

export function OrbitMark({ size = 38 }: { size?: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 60 60"
      accessibilityElementsHidden
    >
      <Circle cx="30" cy="30" r="12" fill={t.active} />
      <Ellipse
        cx="30"
        cy="30"
        rx="27"
        ry="13"
        rotation="-35"
        origin="30,30"
        stroke={t.cream}
        strokeWidth="1.5"
        fill="none"
      />
      <Circle cx="51" cy="16" r="3" fill={t.cream} />
    </Svg>
  );
}
export function Brand() {
  return (
    <View style={ui.brandRow}>
      <OrbitMark />
      <Text style={ui.brand}>orbit</Text>
    </View>
  );
}
export function Primary({
  label,
  onPress,
  busy = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
}) {
  return (
    <Touch
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={[ui.primary, (busy || disabled) && { opacity: 0.55 }]}
    >
      <Text style={ui.primaryText}>{label}</Text>
      {busy ? (
        <ActivityIndicator color={t.onCream} />
      ) : (
        <Ionicons name="arrow-forward" size={20} color={t.onCream} />
      )}
    </Touch>
  );
}
export function TextAction({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Touch
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[ui.textAction, disabled && { opacity: 0.45 }]}
    >
      <Text style={ui.actionText}>{label}</Text>
    </Touch>
  );
}
export const Field = forwardRef<
  TextInput,
  TextInputProps & { label: string; hint?: string; invalid?: boolean }
>(({ label, hint, invalid, secureTextEntry, ...props }, ref) => {
  const [focused, setFocused] = useState(false),
    [visible, setVisible] = useState(false);
  return (
    <View style={ui.fieldGroup}>
      <Text style={ui.label}>{label}</Text>
      <View
        style={[
          ui.field,
          focused && ui.fieldFocused,
          invalid && { borderColor: "#e8ad9f" },
        ]}
      >
        <TextInput
          ref={ref}
          {...props}
          accessibilityLabel={label}
          placeholderTextColor="#71888d"
          selectionColor={t.active}
          secureTextEntry={secureTextEntry && !visible}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          style={[ui.input, props.style]}
        />
        {secureTextEntry && (
          <Touch
            accessibilityRole="button"
            accessibilityLabel={visible ? "Hide password" : "Show password"}
            onPress={() => setVisible(!visible)}
            style={ui.eye}
          >
            <Ionicons
              name={visible ? "eye-off-outline" : "eye-outline"}
              size={20}
              color={t.muted}
            />
          </Touch>
        )}
      </View>
      {!!hint && <Text style={ui.caption}>{hint}</Text>}
    </View>
  );
});
export function Feedback({
  error,
  notice,
}: {
  error?: string;
  notice?: string;
}) {
  if (!error && !notice) return null;
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[ui.feedback, { borderLeftColor: error ? "#e8ad9f" : t.active }]}
    >
      <Text
        accessibilityRole={error ? "alert" : undefined}
        style={[ui.caption, { color: error ? "#e8ad9f" : t.active }]}
      >
        {error || notice}
      </Text>
    </View>
  );
}
export const ui = StyleSheet.create({
  safe: { flex: 1, backgroundColor: t.background },
  frame: { flex: 1, width: "100%", maxWidth: 480, alignSelf: "center" },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  brand: {
    color: t.text,
    fontSize: 28,
    fontWeight: "600",
    letterSpacing: -1.4,
  },
  eyebrow: {
    color: t.active,
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 2,
    marginBottom: 12,
  },
  title: {
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -1.2,
    color: t.text,
    fontWeight: "500",
  },
  body: { color: t.muted, fontSize: 14, lineHeight: 22, marginTop: 10 },
  label: { fontSize: 12, fontWeight: "500", color: t.text },
  caption: { fontSize: 12, lineHeight: 18, color: t.muted },
  fieldGroup: { gap: 8, marginTop: 20 },
  field: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0d2025",
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 10,
  },
  fieldFocused: { borderColor: t.active },
  input: {
    flex: 1,
    minHeight: 54,
    paddingHorizontal: 15,
    paddingVertical: 14,
    color: t.text,
    fontSize: 16,
  },
  eye: {
    width: 48,
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: {
    backgroundColor: t.cream,
    minHeight: 54,
    paddingHorizontal: 19,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  primaryText: { fontSize: 15, fontWeight: "600", color: t.onCream },
  textAction: {
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  actionText: { fontSize: 13, color: t.active, fontWeight: "500" },
  feedback: { paddingLeft: 12, borderLeftWidth: 2, marginVertical: 16 },
});
