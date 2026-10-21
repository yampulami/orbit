import { supabase } from "./supabase";

/** Web push: alerts that reach a student's device even when Orbit is closed. The browser gives this device an address; we keep it in
 *  `push_subscriptions` (only its owner can see it) and a server function sends to it when a reminder is due or a hangout is about to start.
 *  It needs the public VAPID key in `VITE_VAPID_PUBLIC_KEY`; without it, or without a database, this quietly does nothing. */
const KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export const pushSupported = () => !!supabase && !!KEY && typeof navigator !== "undefined" && "serviceWorker" in navigator && typeof window !== "undefined" && "PushManager" in window;

/** The browser wants the public key as bytes. */
function keyBytes(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
const b64url = (buf: ArrayBuffer | null) => (buf ? btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") : "");

/** Subscribe this device and save the address. Returns false when it could not (no support, no permission, offline). */
export async function subscribePush(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== "granted") return false;
  try {
    const { data } = await supabase!.auth.getUser();
    const user = data.user;
    if (!user) return false;
    const reg = await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(KEY!) }));
    // Students may only add and remove their own addresses, so a repeat is an insert that already exists (code 23505), which is fine.
    const { error } = await supabase!.from("push_subscriptions").insert(
      { user_id: user.id, endpoint: sub.endpoint, p256dh: b64url(sub.getKey("p256dh")), auth: b64url(sub.getKey("auth")), user_agent: navigator.userAgent.slice(0, 300) },
    );
    return !error || error.code === "23505";
  } catch { return false; }
}

/** Forget this device: remove the saved address and cancel the browser's subscription. */
export async function unsubscribePush(): Promise<void> {
  if (!pushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    await supabase!.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
  } catch { /* nothing to clean up */ }
}
