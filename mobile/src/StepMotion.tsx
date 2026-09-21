import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Platform } from "react-native";
export default function StepMotion({ children, step }: { children: React.ReactNode; step: string | number }) {
  const value = useRef(new Animated.Value(1)).current;
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => sub.remove();
  }, []);
  useEffect(() => {
    value.stopAnimation();
    if (reduced) { value.setValue(1); return; }
    value.setValue(0);
    const animation = Animated.timing(value, { toValue: 1, duration: 260, useNativeDriver: Platform.OS !== "web" });
    animation.start(); return () => animation.stop();
  }, [step,reduced,value]);
  return <Animated.View style={{ flex: 1, opacity: value, transform: [{ translateY: value.interpolate({ inputRange:[0,1], outputRange:[14,0] }) }] }}>{children}</Animated.View>;
}
