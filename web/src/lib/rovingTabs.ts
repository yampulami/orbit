/** Keyboard behaviour for every tab bar in the app (anything with role="tablist"): only the chosen tab is in the Tab order, and the arrow keys, Home and End move
 *  between the tabs and choose the one they land on. Started once, in main.tsx. Tab bars that already handle the arrow keys themselves (they call preventDefault) are left alone. */
export function startRovingTabs() {
  if (typeof document === "undefined") return;
  const tabsOf = (list: Element) => Array.from(list.querySelectorAll<HTMLElement>('[role="tab"]')).filter((t) => !t.hasAttribute("disabled"));
  const sync = (list: Element) => {
    const tabs = tabsOf(list);
    if (tabs.length === 0) return;
    const chosen = tabs.find((t) => t.getAttribute("aria-selected") === "true") ?? tabs[0];
    tabs.forEach((t) => { const want = t === chosen ? 0 : -1; if (t.tabIndex !== want) t.tabIndex = want; });
  };
  const all = () => document.querySelectorAll('[role="tablist"]').forEach(sync);
  let queued = 0;
  new MutationObserver(() => { window.cancelAnimationFrame(queued); queued = window.requestAnimationFrame(all); })
    .observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["aria-selected", "disabled"] });
  document.addEventListener("keydown", (e) => {
    if (e.defaultPrevented) return;
    const t = e.target as HTMLElement | null;
    if (!t || t.getAttribute?.("role") !== "tab") return;
    const list = t.closest('[role="tablist"]');
    if (!list) return;
    const tabs = tabsOf(list), at = tabs.indexOf(t);
    let to = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") to = (at + 1) % tabs.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") to = (at - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") to = 0;
    else if (e.key === "End") to = tabs.length - 1;
    if (to < 0) return;
    e.preventDefault();
    tabs[to].focus();
    tabs[to].click();
  });
  all();
}
