import { useSyncExternalStore } from "react";

/** Installing Orbit on a phone or computer so it opens like an app. Chrome and Edge offer an install prompt; iPhones use Share, then Add to Home Screen. */
type Prompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
let deferred: Prompt | null = null;
let installed = typeof matchMedia !== "undefined" && (matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true);
const subs = new Set<() => void>();
const emit = () => { version++; subs.forEach((f) => f()); };
let version = 0;

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e as Prompt; emit(); });
  window.addEventListener("appinstalled", () => { deferred = null; installed = true; emit(); });
}

const isIos = () => typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);

export function installState(): "installed" | "can-install" | "ios" | "unavailable" {
  if (installed) return "installed";
  if (deferred) return "can-install";
  if (isIos()) return "ios";
  return "unavailable";
}

export async function install(): Promise<boolean> {
  if (!deferred) return false;
  await deferred.prompt();
  const choice = await deferred.userChoice;
  deferred = null; emit();
  return choice.outcome === "accepted";
}

export const useInstall = () => { useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => version); return installState(); };
