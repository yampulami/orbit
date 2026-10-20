import { Monitor, Moon, Sun } from "lucide-react";
import { setTheme, setThemePref, useTheme, useThemePref, type ThemePref } from "../lib/theme";

const options: { value: ThemePref; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
];

/** Light, Dark or follow the device. Used on the Profile page. */
export function ThemeSegment() {
  const pref = useThemePref();
  return (
    <div className="segment" role="radiogroup" aria-label="Appearance">
      {options.map(({ value, label, Icon }) => (
        <button key={value} type="button" role="radio" aria-checked={pref === value} onClick={() => setThemePref(value)}>
          <Icon size={16} strokeWidth={1.9} aria-hidden="true" />{label}
        </button>
      ))}
    </div>
  );
}

/** One round button that flips between light and dark. Used where there is no sidebar. */
export function ThemeToggleButton() {
  const dark = useTheme() === "dark";
  const label = dark ? "Switch to light mode" : "Switch to dark mode";
  return (
    <button type="button" className="round-btn" title={label} aria-label={label} aria-pressed={dark} onClick={() => setTheme(dark ? "light" : "dark")}>
      {dark ? <Sun size={20} strokeWidth={1.75} /> : <Moon size={20} strokeWidth={1.75} />}
    </button>
  );
}
