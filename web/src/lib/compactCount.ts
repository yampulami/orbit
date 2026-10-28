/** Pure: a count the short way. 284, 1.5K, 15K, 2.3M. One decimal only when it adds something. */
export function compactCount(n: number): string {
  const v = Math.max(0, Math.round(n));
  if (v < 1000) return String(v);
  const trim = (x: number) => (x >= 10 ? Math.round(x) : Math.round(x * 10) / 10).toString();
  if (v < 1_000_000) return trim(v / 1000) + "K";
  return trim(v / 1_000_000) + "M";
}
