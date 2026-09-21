import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Platform,
  Pressable,
  type PressableProps,
} from "react-native";
import * as Haptics from "expo-haptics";

// Animate the native press surface, never an Expo icon's imperative ref.
const Surface = Animated.createAnimatedComponent(Pressable);
export default function Touch({
  style,
  onPress,
  onPressIn,
  onPressOut,
  ...props
}: PressableProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const [reduced, setReduced] = useState(true);
  const [pressed, setPressed] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const listener = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );
    return () => listener.remove();
  }, []);
  function animate(value: number) {
    scale.stopAnimation();
    if (reduced) {
      scale.setValue(1);
      return;
    }
    Animated.spring(scale, {
      toValue: value,
      speed: 35,
      bounciness: 0,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }
  return (
    <Surface
      {...props}
      style={[
        typeof style === "function" ? style({ pressed }) : style,
        { transform: [{ scale }] },
        pressed && { opacity: 0.78 },
      ]}
      onPressIn={(event) => {
        setPressed(true);
        animate(0.975);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        setPressed(false);
        animate(1);
        onPressOut?.(event);
      }}
      onPress={(event) => {
        if (Platform.OS !== "web")
          void Haptics.selectionAsync().catch(() => {});
        onPress?.(event);
      }}
    />
  );
}
