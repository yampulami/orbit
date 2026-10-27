import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { WifiOff } from "lucide-react";
import { refreshEverything } from "../lib/people";
import { haptic } from "../lib/haptics";

/** Says so when the device loses its connection, so a message that does not arrive is not a mystery, and catches everything up when it comes back. */
export default function OfflineBanner() {
  const [offline, setOffline] = useState(() => typeof navigator !== "undefined" && navigator.onLine === false);
  const [back, setBack] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const down = () => { setOffline(true); setBack(false); haptic("warn"); };
    const up = () => {
      setOffline(false); setBack(true); haptic("success");
      refreshEverything();
      clearTimeout(timer);
      timer = setTimeout(() => setBack(false), 2600);
    };
    window.addEventListener("offline", down);
    window.addEventListener("online", up);
    return () => { window.removeEventListener("offline", down); window.removeEventListener("online", up); clearTimeout(timer); };
  }, []);

  return (
    <AnimatePresence>
      {(offline || back) && (
        <motion.div key={offline ? "off" : "on"} className={"offline-banner" + (offline ? "" : " back")} role="status" aria-live="polite"
          initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ type: "spring", stiffness: 420, damping: 32 }}>
          <WifiOff size={16} aria-hidden="true" />
          <span>{offline ? "You are offline. What you do now is saved on your device and may not reach others yet." : "Back online. Catching up…"}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
