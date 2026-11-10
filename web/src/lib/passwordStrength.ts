/** How strong a new password is, shown as it is typed. Only the first rule is enforced (by the form and the server);
 *  the others are advice and only change the meter. */
export type PasswordRule = { id: string; label: string; test: (value: string) => boolean };

const COMMON = /^(?:password|passw0rd|qwerty|letmein|welcome|admin|iloveyou|monkey|dragon|abc123|111111|123123|123456)/i;
const RUN = /(.)\1{3,}/;
const RUN_UP = /(?:0123|1234|2345|3456|4567|5678|6789|abcd|bcde|cdef|defg|qwer|wert|erty|asdf)/i;
const SYMBOL = /[!-/:-@[-`{-~]/;

export const passwordRules: readonly PasswordRule[] = [
  { id: "length", label: "8 characters or more", test: (v) => v.length >= 8 },
  { id: "case", label: "Upper and lower case", test: (v) => /[a-z]/.test(v) && /[A-Z]/.test(v) },
  { id: "digit", label: "A number", test: (v) => /\d/.test(v) },
  { id: "symbol", label: "A symbol", test: (v) => SYMBOL.test(v) },
];

export const strengthLabels = ["Empty", "Weak", "Fair", "Good", "Strong"] as const;

export function guessable(value: string): boolean {
  return value.length > 0 && (COMMON.test(value) || RUN.test(value) || RUN_UP.test(value));
}

/** 0 for nothing typed, otherwise 1 to the number of rules, and 1 for a commonly guessed pattern. */
export function strengthScore(value: string, rules: readonly PasswordRule[] = passwordRules): number {
  if (!value) return 0;
  if (guessable(value)) return 1;
  const passed = rules.reduce((n, r) => n + (r.test(value) ? 1 : 0), 0);
  return Math.min(rules.length, Math.max(1, passed));
}
