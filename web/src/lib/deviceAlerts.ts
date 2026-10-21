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

/** Show an alert from the device, but only when asked for and only when the person is not already looking at Orbit. */
export function notifyDevice(title: string, body: string, tag: string) {
  if (!deviceAlertsOn() || !document.hidden) return;
  try {
    const n = new Notification(title, { body, tag, icon: "/icon-192.png" });
    n.onclick = () => { window.focus(); n.close(); };
  } catch { /* some browsers only allow alerts from a service worker */ }
}

export function useDeviceAlerts() {
  useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => version);
  return { supported: deviceSupported(), permission: devicePermission(), on: deviceAlertsOn() };
}
