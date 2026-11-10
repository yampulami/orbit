import { useEffect, useState } from "react";
import { supabase } from "./supabase";

/** Pictures. Photos are made smaller on the device before they are sent, stored in a private "media" bucket (or in this browser in the demo),
 *  and written into text as a token on its own line, like [[img:USER/abc.jpg]]. Every place that shows text through RichText draws the token as a picture,
 *  so posts, comments, messages, group chats and club channels all get photos without a new column in each table. */
export const BUCKET = "media";
const TOKEN = /\[\[img:([A-Za-z0-9_\-./]+)\]\]/g;
export const MAX_INPUT = 15 * 1024 * 1024;

export const hasMedia = (text: string) => text.includes("[[img:");
export const tokenFor = (path: string) => `[[img:${path}]]`;
/** Text with its pictures taken out, for places that show one line (a list of chats, a notification). A picture on its own reads "Photo". */
export function previewOf(text: string): string {
  if (!hasMedia(text)) return text;
  const t = text.replace(TOKEN, "").replace(/\s+/g, " ").trim();
  return t ? `${t} (photo)` : "Photo";
}
export type MediaPiece = { text: string } | { img: string };
export function splitMedia(text: string): MediaPiece[] {
  const out: MediaPiece[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    const i = m.index ?? 0;
    const before = text.slice(last, i).replace(/\n$/, "");
    if (before) out.push({ text: before });
    out.push({ img: m[1] });
    last = i + m[0].length;
  }
  const rest = text.slice(last).replace(/^\n/, "");
  if (rest) out.push({ text: rest });
  return out;
}

/** Pictures that sit next to each other in the text are shown together as one block (a grid), not one big picture under another. */
export const MAX_PHOTOS = 4;
export type MediaGroup = { text: string } | { imgs: string[] };
export function groupPieces(pieces: MediaPiece[]): MediaGroup[] {
  const out: MediaGroup[] = [];
  for (const p of pieces) {
    if ("img" in p) {
      const last = out[out.length - 1];
      if (last && "imgs" in last) last.imgs.push(p.img); else out.push({ imgs: [p.img] });
    } else out.push({ text: p.text });
  }
  return out;
}
/** Split a run of pictures into blocks of at most `size`, so no grid ever holds more than four. */
export const chunk = <T,>(list: T[], size = MAX_PHOTOS): T[][] => { const out: T[][] = []; for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size)); return out; };

/** Draws the picture smaller: the longest side at most `side`, as a JPEG. Throws if the file is not a picture the browser can read. */
export async function shrink(file: File, side = 1280, quality = 0.82, square = false): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, no) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => no(new Error("That file is not a picture Orbit can read."));
      i.src = url;
    });
    let sw = img.naturalWidth, sh = img.naturalHeight, sx = 0, sy = 0;
    if (square) { const s = Math.min(sw, sh); sx = (sw - s) / 2; sy = (sh - s) / 2; sw = sh = s; }
    const k = Math.min(1, side / Math.max(sw, sh));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(sw * k));
    c.height = Math.max(1, Math.round(sh * k));
    const g = c.getContext("2d");
    if (!g) throw new Error("Could not prepare the picture.");
    g.fillStyle = "#fff";
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
    return await new Promise<Blob>((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error("Could not prepare the picture."))), "image/jpeg", quality));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* ---- the demo has no backend: pictures live in this browser ---- */
const DEMO_KEY = "orbit-demo-media-v1";
const demo = new Map<string, string>();
try {
  const raw = localStorage.getItem(DEMO_KEY);
  if (raw) for (const [k, v] of Object.entries(JSON.parse(raw) as Record<string, string>)) demo.set(k, v);
} catch { /* nothing saved */ }
function saveDemo() {
  // keep the newest few, so the browser's storage never fills up
  while (demo.size > 24) demo.delete(demo.keys().next().value as string);
  for (;;) {
    try { localStorage.setItem(DEMO_KEY, JSON.stringify(Object.fromEntries(demo))); return; }
    catch { if (demo.size <= 1) return; demo.delete(demo.keys().next().value as string); }
  }
}
const blobToDataUrl = (b: Blob) => new Promise<string>((ok, no) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result));
  r.onerror = () => no(new Error("Could not read the picture."));
  r.readAsDataURL(b);
});

export type Uploaded = { path: string; preview: string };

/** Make a picture smaller and store it. Resolves to the stored path, or throws a message that can be shown as it is. */
export async function uploadImage(file: File, userId: string, opts: { side?: number; quality?: number; square?: boolean } = {}): Promise<Uploaded> {
  if (!file.type.startsWith("image/")) throw new Error("Pick a picture (JPG, PNG, WebP or GIF).");
  if (file.size > MAX_INPUT) throw new Error("That picture is too big. Pick one under 15 MB.");
  const blob = await shrink(file, opts.side ?? 1280, opts.quality ?? 0.82, opts.square ?? false);
  const id = (crypto.randomUUID?.() ?? `${Date.now()}${Math.random().toString(36).slice(2)}`).replace(/-/g, "");
  if (!supabase) {
    const data = await blobToDataUrl(blob);
    const path = `demo/${id}.jpg`;
    demo.set(path, data);
    saveDemo();
    return { path, preview: data };
  }
  const path = `${userId}/${id}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
  if (error) throw new Error(/bucket|not found/i.test(error.message) ? "Pictures are not set up on this server yet." : "Could not upload the picture. Try again.");
  return { path, preview: URL.createObjectURL(blob) };
}

/** Throw away a picture that was uploaded but never sent. Best effort. */
export async function discardImage(path: string) {
  if (!supabase) { demo.delete(path); saveDemo(); return; }
  try { await supabase.storage.from(BUCKET).remove([path]); } catch { /* it stays; nothing refers to it */ }
}

/* ---- showing them ---- */
const signed = new Map<string, { url: string; until: number }>();
const inflight = new Map<string, Promise<string | null>>();
export function mediaUrl(path: string): Promise<string | null> {
  if (!supabase || path.startsWith("demo/")) return Promise.resolve(demo.get(path) ?? null);
  const hit = signed.get(path);
  if (hit && hit.until > Date.now()) return Promise.resolve(hit.url);
  let p = inflight.get(path);
  if (!p) {
    p = supabase.storage.from(BUCKET).createSignedUrl(path, 3600).then(({ data }) => {
      inflight.delete(path);
      if (!data?.signedUrl) return null;
      signed.set(path, { url: data.signedUrl, until: Date.now() + 50 * 60_000 });
      return data.signedUrl;
    }, () => { inflight.delete(path); return null; });
    inflight.set(path, p);
  }
  return p;
}
/** The address to show for a stored picture: null while it loads, "" if it cannot be found. */
export function useMediaUrl(path: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setUrl(null);
    if (path) void mediaUrl(path).then((u) => { if (alive) setUrl(u ?? ""); });
    return () => { alive = false; };
  }, [path]);
  return url;
}
