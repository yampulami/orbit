import { useEffect, useSyncExternalStore } from "react";

/** The phone layout: a different, lighter way of showing the app (a bottom tab bar, one pane at a time, fewer panels), not just the desktop squeezed. */
const QUERY = "(max-width: 700px)";
const mq = () => (typeof matchMedia === "undefined" ? null : matchMedia(QUERY));
const subscribe = (cb: () => void) => { const m = mq(); m?.addEventListener("change", cb); return () => m?.removeEventListener("change", cb); };
export const useIsPhone = () => useSyncExternalStore(subscribe, () => mq()?.matches ?? false, () => false);

/** While a chat is open full screen on a phone, the bottom tab bar steps aside so the message box sits at the bottom. */
export function useChatOpenClass(open: boolean) {
  useEffect(() => {
    document.body.classList.toggle("chat-open", open);
    return () => document.body.classList.remove("chat-open");
  }, [open]);
}
