import React from "react";
import Svg, { Circle, Ellipse, G, Path, Rect } from "react-native-svg";
import { theme as t } from "./theme";

export type OrbitIconName =
  | "back"
  | "bell"
  | "bookmark"
  | "calendar"
  | "campus"
  | "close"
  | "comment"
  | "event"
  | "feed"
  | "gif"
  | "hangouts"
  | "heart"
  | "location"
  | "market"
  | "messages"
  | "more"
  | "photo"
  | "plus"
  | "poll"
  | "roommates"
  | "search"
  | "share"
  | "smile"
  | "video";

export function OrbitIcon({
  name,
  size = 22,
  color = t.muted,
  filled = false,
}: {
  name: OrbitIconName;
  size?: number;
  color?: string;
  filled?: boolean;
}) {
  const common = {
    fill: filled ? color : "none",
    stroke: color,
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  let drawing: React.ReactNode;
  switch (name) {
    case "back": drawing = <Path {...common} d="m14.5 18-6-6 6-6" />; break;
    case "bell": drawing = <G {...common}><Path d="M6.5 9.5a5.5 5.5 0 0 1 11 0c0 6 2.2 6.2 2.2 7.5H4.3c0-1.3 2.2-1.5 2.2-7.5Z" /><Path d="M9.7 20h4.6" /></G>; break;
    case "bookmark": drawing = <Path {...common} d="M6.5 4.5c0-.8.7-1.5 1.5-1.5h8c.8 0 1.5.7 1.5 1.5V21L12 17.5 6.5 21V4.5Z" />; break;
    case "calendar": drawing = <G {...common}><Rect x="4" y="5.5" width="16" height="14" rx="3" /><Path d="M8 3v5M16 3v5M4 10h16" /></G>; break;
    case "campus": drawing = <G {...common}><Path d="m3.5 9 8.5-5 8.5 5M5.5 9.5h13M7 10v7M12 10v7M17 10v7M4 20h16" /><Path d="M10.5 7h3" /></G>; break;
    case "close": drawing = <Path {...common} d="m6.5 6.5 11 11m0-11-11 11" />; break;
    case "comment": drawing = <Path {...common} d="M20 11.5a7.5 7.5 0 0 1-8 7.5 9 9 0 0 1-3.6-.8L4 20l1.2-4A8 8 0 1 1 20 11.5Z" />; break;
    case "event": drawing = <G {...common}><Path d="M5 12.5h14v7H5zM7 12.5v-4a5 5 0 0 1 10 0v4" /><Path d="M9 8.5c1.6 1.1 4.4 1.1 6 0" /></G>; break;
    case "feed": drawing = <G {...common}><Path d="M5 5.5h14v5H5zM5 14.5h8V20H5z" /><Path d="M16 14.5h3V20h-3z" /></G>; break;
    case "gif": drawing = <G {...common}><Rect x="3" y="6.5" width="18" height="11" rx="3" /><Path d="M9 11a2 2 0 1 0 0 3h1v-2H8.5M13 10v5M16 15v-5h3" /></G>; break;
    case "hangouts": drawing = <G {...common}><Path d="M5 16.5c0-2.4 2-4.5 4.5-4.5s4.5 2.1 4.5 4.5V20H5v-3.5Z" /><Circle cx="9.5" cy="7.5" r="3" /><Path d="M14.5 9.5c2.4 0 4.5 2 4.5 4.5v3h-2.5M15 4.8a2.8 2.8 0 0 1 0 5.4" /></G>; break;
    case "heart": drawing = <Path {...common} d="M12 20S4 15.5 4 9.5A4.5 4.5 0 0 1 12 6.7a4.5 4.5 0 0 1 8 2.8c0 6-8 10.5-8 10.5Z" />; break;
    case "location": drawing = <G {...common}><Path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><Circle cx="12" cy="10" r="2.2" /></G>; break;
    case "market": drawing = <G {...common}><Path d="M5 9h14l-1 11H6L5 9Z" /><Path d="M8.5 9V7a3.5 3.5 0 0 1 7 0v2" /></G>; break;
    case "messages": drawing = <G {...common}><Path d="M4 5.5h13v10H9l-4 3v-3H4V5.5Z" /><Path d="M10 9h10v9h-3v2.5L13.5 18H10v-2.5" /></G>; break;
    case "more": drawing = <G fill={color}><Circle cx="5" cy="12" r="1" /><Circle cx="12" cy="12" r="1" /><Circle cx="19" cy="12" r="1" /></G>; break;
    case "photo": drawing = <G {...common}><Rect x="3.5" y="5" width="17" height="14" rx="3" /><Circle cx="8.5" cy="9.5" r="1.5" /><Path d="m5 17 4.5-4.5 3 3 2-2 4.5 3.5" /></G>; break;
    case "plus": drawing = <Path {...common} d="M12 5v14M5 12h14" />; break;
    case "poll": drawing = <Path {...common} d="M5 19V9h3v10H5Zm6 0V4h3v15h-3Zm6 0v-7h3v7h-3Z" />; break;
    case "roommates": drawing = <G {...common}><Circle cx="9" cy="8" r="3.5" /><Circle cx="16.5" cy="9.5" r="2.5" /><Path d="M3.5 20v-2.8A5.5 5.5 0 0 1 9 11.7a5.5 5.5 0 0 1 5.5 5.5V20h-11ZM15 14a4.5 4.5 0 0 1 5.5 4.4V20" /></G>; break;
    case "search": drawing = <G {...common}><Circle cx="10.5" cy="10.5" r="6.5" /><Path d="m15.5 15.5 4.5 4.5" /></G>; break;
    case "share": drawing = <G {...common}><Circle cx="6" cy="12" r="2" /><Circle cx="18" cy="6" r="2" /><Circle cx="18" cy="18" r="2" /><Path d="m7.8 11 8.4-4M7.8 13l8.4 4" /></G>; break;
    case "smile": drawing = <G {...common}><Circle cx="12" cy="12" r="8.5" /><Path d="M8.5 10h.1M15.4 10h.1M8.5 14.5c2.2 1.8 4.8 1.8 7 0" /></G>; break;
    case "video": drawing = <G {...common}><Rect x="3.5" y="6" width="12.5" height="12" rx="3" /><Path d="m16 10 4.5-2v8L16 14" /></G>; break;
  }
  return <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>{drawing}</Svg>;
}

export function OrbitAvatar({ variant = 1, size = 40 }: { variant?: number; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" accessible={false}>
      <Circle cx="20" cy="20" r="20" fill={variant % 2 ? t.teal : t.cream} />
      <G fill={variant % 2 ? t.cream : t.blue} stroke={t.onCream} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
        <Circle cx="20" cy="16" r="7" />
        <Path d="M8 37c1-10 6-15 12-15s11 5 12 15" />
        {variant % 2 ? <Path d="M13 15c1-8 13-9 15-1-4-3-9-3-15 1Z" /> : <Path d="M12 17c-1-8 4-12 9-11 6 1 8 7 6 12-1-6-9-9-15-1Z" />}
      </G>
    </Svg>
  );
}

export function CampusEventIllustration() {
  return (
    <Svg width="100%" height={148} viewBox="0 0 320 148" accessible accessibilityLabel="Students gathering under the stars">
      <Path fill={t.teal} d="M0 102c45-20 82-13 117-1 39 14 77 15 112-3 33-17 62-14 91 1v49H0v-46Z" />
      <Path fill={t.cream} stroke={t.onCream} strokeWidth={2} d="M112 115c8-29 20-48 36-57 6-3 11-1 13 5 3 11 2 27-2 52h-47Z" />
      <G fill="none" stroke={t.cream} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M143 59c-4-14 2-24 10-23 7 1 12 8 10 18M118 115l8-38 17-18M160 66l20 23 21-8M133 82l-22 14M164 115l-5-44" />
        <Path d="M197 116c2-25 8-42 18-50 7-5 15-3 18 4 5 10 5 25 0 46M205 77l-18 20M230 82l20 11M213 115l2-45" />
        <Path d="M53 120c1-19 6-32 15-38 7-5 14-2 17 4 4 8 4 19 1 34M60 93l-16 14M83 94l15 12M70 120V85" />
        <Path d="M22 111c25-13 45-8 62 9M173 124c36-20 67-18 100-3" />
        <Circle cx="148" cy="47" r="5" /><Circle cx="219" cy="57" r="5" /><Circle cx="72" cy="74" r="5" />
      </G>
      <G fill="none" stroke={t.active} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <Path d="m48 29 2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6Zm217 8 1.5 4.5L271 43l-4.5 1.5L265 49l-1.5-4.5L259 43l4.5-1.5L265 37ZM91 21c18 5 31 16 39 32" />
        <Path d="M116 47l14 6-5-14" />
      </G>
    </Svg>
  );
}
