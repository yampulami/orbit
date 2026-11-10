/** The pages are separate downloads. These start a page's download early (when you point at its button, or quietly once the app is idle) so that opening it is instant.
 *  Asking for the same page again costs nothing: the browser keeps the first answer. */
const pages: Record<string, () => Promise<unknown>> = {
  "/app/chats": () => import("../pages/Chats"),
  "/app/plans": () => import("../pages/Plans"),
  "/app/campus": () => import("../pages/Campus"),
  "/app/roommates": () => import("../pages/Roommates"),
  "/app/profile": () => import("../pages/Profile"),
};

export function prefetchRoute(to: string) {
  const load = pages[to];
  if (load) void load().catch(() => undefined);
}

/** Quietly fetch the main pages once the browser has nothing else to do. Skipped when the person asked their device to save data. */
export function prefetchIdle() {
  const saving = (navigator as unknown as { connection?: { saveData?: boolean } }).connection?.saveData;
  if (saving) return;
  const run = () => { ["/app/chats", "/app/plans", "/app/campus"].forEach(prefetchRoute); };
  const idle = (window as unknown as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
  if (idle) idle(run, { timeout: 5000 }); else window.setTimeout(run, 3000);
}
