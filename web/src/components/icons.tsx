import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

/** Custom home icon (house with a doorstep line). Fills with currentColor, so it follows the theme. The house hops and the doorstep widens on hover and when the tab becomes active (see styles.css). */
export function HomeIcon({ size = 24, strokeWidth: _strokeWidth, ...props }: IconProps) {
  void _strokeWidth;
  return (
    <svg width={size} height={size} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path className="home-house" fill="currentColor" d="M19 21H5a1 1 0 0 1-1-1v-9H1l10.327-9.388a1 1 0 0 1 1.346 0L23 11h-3v9a1 1 0 0 1-1 1M6 19h12V9.157l-6-5.454l-6 5.454z" />
      <path className="home-door" fill="currentColor" d="M8 15h8v2H8z" />
    </svg>
  );
}

const line = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** Speech bubble with three typing dots. The dots bounce in turn. */
export function MessagesIcon({ size = 24, strokeWidth: _s, ...props }: IconProps) {
  void _s;
  return (
    <svg width={size} height={size} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path className="ic-bubble" {...line} d="M6 4h12a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3h-6.5L7 20.5V17H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z" />
      <circle className="ic-dot d1" cx="8.5" cy="10.5" r="1.15" fill="currentColor" />
      <circle className="ic-dot d2" cx="12" cy="10.5" r="1.15" fill="currentColor" />
      <circle className="ic-dot d3" cx="15.5" cy="10.5" r="1.15" fill="currentColor" />
    </svg>
  );
}

/** Three friends. The two on the sides lean in and the middle one hops. */
export function GroupsIcon({ size = 24, strokeWidth: _s, ...props }: IconProps) {
  void _s;
  return (
    <svg width={size} height={size} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <g className="ic-side-l"><circle {...line} cx="4.8" cy="10" r="2.1" /><path {...line} d="M1.6 19v-.6a3 3 0 0 1 3-3" /></g>
      <g className="ic-side-r"><circle {...line} cx="19.2" cy="10" r="2.1" /><path {...line} d="M22.4 19v-.6a3 3 0 0 0-3-3" /></g>
      <g className="ic-center"><circle {...line} cx="12" cy="8" r="3.2" /><path {...line} d="M6.2 20v-1.2a4 4 0 0 1 4-4h3.6a4 4 0 0 1 4 4V20" /></g>
    </svg>
  );
}

/** Calendar with a check. The rings drop and the check draws itself. */
export function PlansIcon({ size = 24, strokeWidth: _s, ...props }: IconProps) {
  void _s;
  return (
    <svg width={size} height={size} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <rect {...line} x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path {...line} d="M3.5 10h17" />
      <path className="ic-ring" {...line} d="M8 2.8v4M16 2.8v4" />
      <path className="ic-check" {...line} pathLength={1} d="M8.8 15.2l2.3 2.3 4.2-4.4" />
    </svg>
  );
}

/** A house key. It tilts when the tab is hovered or becomes active. */
export function RoommatesIcon({ size = 24, strokeWidth: _s, ...props }: IconProps) {
  void _s;
  return (
    <svg width={size} height={size} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <g className="ic-key">
        <circle {...line} cx="7.5" cy="15.5" r="3.5" />
        <path {...line} d="M10 13l9.5-9.5M16.5 6.5l2.5 2.5M13.5 9.5l2 2" />
      </g>
    </svg>
  );
}

/** A folded map with a pin. The pin drops when the tab is hovered or becomes active. */
export function MapIcon({ size = 24, strokeWidth: _s, ...props }: IconProps) {
  void _s;
  return (
    <svg width={size} height={size} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path {...line} d="M3.5 6.5l5.5-2.2 6 2.4 5.5-2.2v13l-5.5 2.2-6-2.4-5.5 2.2z" />
      <path {...line} d="M9 4.3v13M15 6.7v13" />
      <circle className="ic-ring" {...line} cx="12" cy="11" r="1.6" />
    </svg>
  );
}
