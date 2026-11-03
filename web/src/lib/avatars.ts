import { Avatar as DiceAvatar, Style } from "@dicebear/core";
import definition from "@dicebear/styles/critters.json";
import { supabase } from "./supabase";
import { ensurePeople, patchPerson, usePerson } from "./directory";

/** In-app avatars. Critters are drawn from the open "Critters" style by DiceBear (CC0), right here in the browser, so there is no outside request.
 *  A person's avatar is one short string: "" (their initial), "critter:SEED|eyes=round|..." (a critter), or "img:PATH" (their own photo). */
type Def = { components: Record<string, { variants: Record<string, unknown> }>; colors: Record<string, { values: string[] }> };
const def = definition as unknown as Def;
const style = new Style(definition as never);

export const PARTS = ["top", "body", "pattern", "cheeks", "eyes", "mouth"] as const;
export type Part = (typeof PARTS)[number];
export const PART_LABEL: Record<Part, string> = { top: "Top", body: "Shape", pattern: "Pattern", cheeks: "Cheeks", eyes: "Eyes", mouth: "Mouth" };
export const OPTIONS: Record<Part, string[]> = Object.fromEntries(PARTS.map((p) => [p, Object.keys(def.components[p].variants)])) as Record<Part, string[]>;
export const COLOR_PARTS = ["bg", "skin", "accent"] as const;
export type ColorPart = (typeof COLOR_PARTS)[number];
export const COLOR_LABEL: Record<ColorPart, string> = { bg: "Background", skin: "Body", accent: "Accent" };
const COLOR_KEY: Record<ColorPart, string> = { bg: "background", skin: "body", accent: "accent" };
export const SWATCHES: Record<ColorPart, string[]> = Object.fromEntries(COLOR_PARTS.map((c) => [c, def.colors[COLOR_KEY[c]].values.map((v) => v.replace("#", ""))])) as Record<ColorPart, string[]>;

export type Critter = { seed: string } & Partial<Record<Part | ColorPart, string>>;
const KEYS = [...PARTS, ...COLOR_PARTS] as const;

export function toSpec(c: Critter): string {
  return "critter:" + c.seed.replace(/[|]/g, "") + KEYS.filter((k) => c[k]).map((k) => `|${k}=${c[k]}`).join("");
}
export function fromSpec(spec: string): Critter | null {
  if (!spec.startsWith("critter:")) return null;
  const [seed, ...rest] = spec.slice(8).split("|");
  const c: Critter = { seed: seed || "orbit" };
  for (const kv of rest) {
    const [k, v] = kv.split("=");
    if ((KEYS as readonly string[]).includes(k) && v) (c as Record<string, string>)[k] = v;
  }
  return c;
}
export const isPhoto = (spec: string) => spec.startsWith("img:");
export const photoPath = (spec: string) => spec.slice(4);

const cache = new Map<string, string>();
/** The picture (an SVG as a data address) for a critter spec. */
export function critterUri(spec: string): string {
  const hit = cache.get(spec);
  if (hit) return hit;
  const c = fromSpec(spec) ?? { seed: "orbit" };
  const o: Record<string, unknown> = { seed: c.seed, size: 128 };
  for (const p of PARTS) if (c[p] && OPTIONS[p].includes(c[p] as string)) o[`${p}Variant`] = [c[p]];
  if (c.bg) o.backgroundColor = c.bg;
  if (c.skin) o.bodyColor = c.skin;
  if (c.accent) o.accentColor = c.accent;
  let uri: string;
  try { uri = new DiceAvatar(style, o as never).toDataUri(); } catch { uri = new DiceAvatar(style, { seed: c.seed } as never).toDataUri(); }
  cache.set(spec, uri);
  return uri;
}

/** Twelve ready-made critters to start from. */
export const PRESET_SEEDS = ["Pip", "Mochi", "Bean", "Juniper", "Waffle", "Comet", "Pebble", "Sprout", "Noodle", "Maple", "Biscuit", "Orbit"];
export const presets = (): string[] => PRESET_SEEDS.map((seed) => toSpec({ seed }));
export const randomCritter = (): Critter => ({ seed: Math.random().toString(36).slice(2, 9) });

/* ---- who has which avatar (the live directory keeps them current) ---- */
const localKey = (id: string) => `orbit-avatar-v1:${id}`;
function readLocal(id: string): string {
  try { return localStorage.getItem(localKey(id)) ?? ""; } catch { return ""; }
}
/** Ask for these people's avatars; they show up when loaded and change when they do. Cheap to call again. */
export function ensureAvatars(ids: (string | undefined)[]) { ensurePeople(ids); }
export function useAvatarSpec(id: string | undefined, explicit?: string): string {
  const person = usePerson(id);
  if (explicit !== undefined) return explicit;
  if (!id) return "";
  return supabase ? person?.avatar ?? "" : readLocal(id);
}
/** Save your own avatar. Resolves to a message if it did not work, or null. */
export async function saveMyAvatar(userId: string, spec: string): Promise<string | null> {
  if (supabase) {
    const { error } = await supabase.from("student_profiles").update({ avatar: spec || null, updated_at: new Date().toISOString() }).eq("user_id", userId);
    if (error) return /avatar/i.test(error.message) ? "Avatars are not set up on this server yet." : error.message;
  } else {
    try { if (spec) localStorage.setItem(localKey(userId), spec); else localStorage.removeItem(localKey(userId)); } catch { return "Could not save on this device."; }
  }
  patchPerson(userId, { avatar: spec });
  return null;
}
