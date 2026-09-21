import React, { forwardRef, useState } from "react";
import { TextInput, type TextInputProps } from "react-native";
import { theme } from "./theme";

// One focus treatment for creation forms, search, dates, and expense corrections.
export default forwardRef<TextInput, TextInputProps & { invalid?: boolean }>(
  function FocusInput(
    { style, onFocus, onBlur, invalid = false, ...props },
    ref,
  ) {
    const [focused, setFocused] = useState(false);
    return (
      <TextInput
        ref={ref}
        {...props}
        aria-invalid={invalid}
        style={[
          style,
          focused && { borderColor: theme.active, borderBottomWidth: 2 },
          invalid && { borderColor: "#e8ad9f", borderBottomWidth: 2 },
        ]}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
      />
    );
  },
);
