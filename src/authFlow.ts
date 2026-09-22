export type EmailCallback =
  | { kind: "unrelated" }
  | { kind: "invalid" }
  | { kind: "return" }
  | {
      kind: "verify";
      accessToken: string;
      refreshToken: string | null;
      recovery: boolean;
    };

/** A callback path alone is never proof that an email was confirmed. */
export function parseEmailCallback(raw: string): EmailCallback {
  try {
    const url = new URL(raw);
    const path =
      url.protocol === "orbit:"
        ? `${url.hostname}${url.pathname}`
        : url.pathname.replace(/^\/(?:--\/)?/, "");
    if (path !== "auth/confirmed") return { kind: "unrelated" };
    const fragment = new URLSearchParams(url.hash.slice(1));
    if (
      fragment.has("error") ||
      fragment.has("error_description") ||
      url.searchParams.has("error") ||
      url.searchParams.has("error_description")
    )
      return { kind: "invalid" };
    const accessToken = fragment.get("access_token");
    if (!accessToken) return { kind: "return" };
    return {
      kind: "verify",
      accessToken,
      refreshToken: fragment.get("refresh_token"),
      recovery: fragment.get("type") === "recovery",
    };
  } catch {
    return { kind: "unrelated" };
  }
}
export function credentialError(
  email: string,
  password: string,
  signup: boolean,
): string {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    return "Enter a valid email address.";
  if (!password) return "Enter your password.";
  if (signup && password.length < 8)
    return "Use at least 8 characters for your password.";
  return "";
}
