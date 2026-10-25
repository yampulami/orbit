/** Read once, before anything else touches the address: a confirmation link that failed comes back with the reason in the address. */
function readLinkProblem(): string {
  if (typeof location === "undefined") return "";
  const p = new URLSearchParams(location.hash.replace(/^#/, "") || location.search);
  if (!p.get("error") && !p.get("error_code")) return "";
  return p.get("error_code") === "otp_expired" || /expired|invalid/i.test(p.get("error_description") ?? "")
    ? "That confirmation link has expired or was already used. Try signing in. If that does not work, sign up again to get a fresh email."
    : "That link did not work. Try signing in, or sign up again to get a fresh email.";
}
export const linkProblem = readLinkProblem();

/** The address friends and emails should point to. On a developer's own computer the address is "localhost", which a phone cannot open,
 *  so links made there use the live site instead. */
export function siteUrl(): string {
  const o = typeof location === "undefined" ? "" : location.origin;
  const local = /^https?:\/\/(localhost|127\.|\[::1\]|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(o);
  return local || !o ? ((import.meta.env.VITE_SITE_URL as string | undefined) || "https://orbit-oncampus.vercel.app").replace(/\/$/, "") : o;
}
