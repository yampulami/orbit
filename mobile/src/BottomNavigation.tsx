import Pressable from "./Touch";
import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "./theme";

type IconName = React.ComponentProps<typeof Ionicons>["name"];
type Item<T extends string> = { page: T; icon: IconName };
const ACTIVE = theme.active;
const INACTIVE = "#a8afb0";

function NavigationItem<T extends string>({
  item,
  active,
  onSelect,
  reduced,
}: {
  item: Item<T>;
  active: boolean;
  onSelect: (page: T) => void;
  reduced: boolean;
}) {
  const progress = useRef(new Animated.Value(active ? 1 : 0)).current;
  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: active ? 1 : 0,
      duration: reduced ? 0 : 180,
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [active, reduced, progress]);
  const color = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [INACTIVE, ACTIVE],
  });
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={item.page}
      accessibilityState={{ selected: active }}
      aria-selected={active}
      onPress={() => onSelect(item.page)}
      style={({ pressed }) => [s.item, pressed && { opacity: 0.65 }]}
    >
      <View
        style={s.icon}
        pointerEvents="none"
        accessibilityElementsHidden
        aria-hidden={true}
        importantForAccessibility="no-hide-descendants"
      >
        <Animated.View
          style={{
            opacity: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 0],
            }),
          }}
        >
          <Ionicons name={item.icon} size={23} color={INACTIVE} />
        </Animated.View>
        <Animated.View style={[s.iconOverlay, { opacity: progress }]}>
          <Ionicons name={item.icon} size={23} color={ACTIVE} />
        </Animated.View>
      </View>
      <Animated.Text style={[s.label, { color }]}>{item.page}</Animated.Text>
    </Pressable>
  );
}

export default function BottomNavigation<T extends string>({
  items,
  value,
  onChange,
}: {
  items: Item<T>[];
  value: T;
  onChange: (page: T) => void;
}) {
  const [width, setWidth] = useState(0);
  const [reduced, setReduced] = useState(true);
  const position = useRef(new Animated.Value(0)).current;
  const previousWidth = useRef(0);
  const index = Math.max(
    0,
    items.findIndex((item) => item.page === value),
  );
  const cell = items.length ? width / items.length : 0;
  const indicatorWidth = cell * 0.62;
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduced(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
  useEffect(() => {
    if (!width) return;
    const target = index * cell + (cell - indicatorWidth) / 2;
    position.stopAnimation();
    if (reduced || previousWidth.current !== width) {
      position.setValue(target);
      previousWidth.current = width;
      return;
    }
    const animation = Animated.timing(position, {
      toValue: target,
      duration: 280,
      easing: Easing.bezier(0.22, 0.8, 0.25, 1),
      useNativeDriver: Platform.OS !== "web",
    });
    animation.start();
    return () => animation.stop();
  }, [width, index, cell, indicatorWidth, reduced, position]);
  return (
    <View
      style={s.bar}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {width > 0 && (
        <Animated.View
          testID="active-tab-indicator"
          pointerEvents="none"
          style={[
            s.indicator,
            { width: indicatorWidth, transform: [{ translateX: position }] },
          ]}
        />
      )}
      {items.map((item) => (
        <NavigationItem
          key={item.page}
          item={item}
          active={value === item.page}
          onSelect={onChange}
          reduced={reduced}
        />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: "row",
    position: "relative",
    backgroundColor: theme.background,
    borderTopWidth: 1,
    borderTopColor: "#243034",
  },
  indicator: {
    position: "absolute",
    top: 0,
    left: 0,
    height: 3,
    borderRadius: 1,
    backgroundColor: ACTIVE,
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 15,
    paddingBottom: 10,
    gap: 6,
    minHeight: 68,
    paddingHorizontal: 3,
  },
  label: {
    fontSize: 12,
    fontWeight: "400",
    textAlign: "center",
    flexShrink: 1,
  },
  icon: { width: 23, height: 23 },
  iconOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
});
