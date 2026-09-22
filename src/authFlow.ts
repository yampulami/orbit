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

export function authErrorMessage(error: unknown): string {
  const detail = error as { code?: string; message?: string } | null;
  const code = detail?.code;
  if (code === "user_not_found")
    return "Account not found. Create an Orbit account first.";
  if (
    code === "invalid_credentials" ||
    detail?.message === "Invalid login credentials"
  )
    return "Account not found or password incorrect. New to Orbit? Create an account first.";
  if (code === "email_not_confirmed")
    return "Confirm your email before signing in. You can request a new confirmation below.";
  if (
    code === "over_request_rate_limit" ||
    code === "over_email_send_rate_limit"
  )
    return "Too many attempts in a short time. Wait a moment, then try again.";
  return detail?.message || "Something went wrong. Please try again.";
}
