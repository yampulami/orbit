import React from "react";
import { Platform, StatusBar, View, type ViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
// Native modals may not receive the presenting screen's native safe-area padding.
// Use window insets explicitly, with a conservative fallback during presentation.
export default function ModalSafeArea({ style, ...props }: ViewProps) {
  const insets = useSafeAreaInsets();
  const fallback =
    Platform.OS === "ios"
      ? 44
      : Platform.OS === "android"
        ? (StatusBar.currentHeight ?? 24)
        : 0;
  return (
    <View style={{flex:1, backgroundColor:"#071619", paddingTop:Math.max(insets.top,fallback)+12, paddingBottom:Math.max(insets.bottom,12), paddingLeft:insets.left, paddingRight:insets.right}}>
      <View {...props} style={[style,{flex:1}]} />
    </View>
  );
}
