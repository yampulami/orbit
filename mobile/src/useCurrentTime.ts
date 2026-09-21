import { useEffect, useState } from "react";
import { AppState } from "react-native";

// Refresh while open and immediately after returning from the background.
export function useCurrentTime() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const timer = setInterval(refresh, 30_000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => { clearInterval(timer); subscription.remove(); };
  }, []);
  return now;
}
