import { useSyncExternalStore } from "react";
import { subscribePush, unsubscribePush } from "./push";

/** Alerts from your device (the corner of the screen) while Orbit is open in a tab you are not looking at. This is the browser's Notification
 *  permission and needs no server. Alerts when Orbit is closed need web push, which needs a server to send them (see README). */
const KEY = "orbit-device-alerts";
export type DevicePermission = NotificationPermission | "unsupported";

export const deviceSupported = () => typeof Notification !== "undefined";
export const devicePermission = (): DevicePermission => (deviceSupported() ? Notification.permission : "unsupported");

let version = 0;
const subs = new Set<() => void>();
const bump = () => { version++; subs.forEach((f) => f()); };

const wanted = () => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } };
const store = (on: boolean) => { try { localStorage.setItem(KEY, on ? "1" : "0"); } catch { /* ignore */ } bump(); };

export const deviceAlertsOn = () => wanted() && devicePermission() === "granted";

/** Ask the browser for permission. Call this from a tap or click, because browsers ignore it otherwise. */
export async function enableDeviceAlerts(): Promise<DevicePermission> {
  if (!deviceSupported()) return "unsupported";
  const p = devicePermission() === "granted" ? "granted" : await Notification.requestPermission();
  store(p === "granted");
  // With a server set up, also register this device so alerts arrive when Orbit is closed.
  if (p === "granted") void subscribePush();
  return p;
}
export const disableDeviceAlerts = () => { store(false); void unsubscribePush(); };

/** Show an alert from the device (the Windows or Mac notification area, or the phone's), when the person has turned alerts on. It is shown even while
 *  Orbit is in view, because people expect the corner-of-the-screen alert when a reminder is due. It goes through the service worker when there is one,
 *  which Chrome and Windows treat as a proper app notification, and falls back to the page's own notification. Resolves to whether one was shown. */
export async function notifyDevice(title: string, body: string, tag: string): Promise<boolean> {
  if (!deviceAlertsOn()) return false;
  const options = { body, tag, icon: "/icon-192.png", badge: "/icon-192.png", data: { url: "/app" } };
  try {
    const reg = typeof navigator !== "undefined" && "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (reg) { await reg.showNotification(title, options); return true; }
  } catch { /* fall back to the page's own notification */ }
  try {
    const n = new Notification(title, options);
    n.onclick = () => { window.focus(); n.close(); };
    return true;
  } catch { return false; }
}

export function useDeviceAlerts() {
  useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => version);
  return { supported: deviceSupported(), permission: devicePermission(), on: deviceAlertsOn() };
}
