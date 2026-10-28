import { compactCount } from "../lib/compactCount";

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/** A count whose digits roll up or down to the new number, like a counter. Large counts are shortened (1.5K). The text is read out as one plain number. */
export default function RollingNumber({ value, className = "" }: { value: number; className?: string }) {
  const text = compactCount(value);
  const chars = text.split("");
  return (
    <span className={"rn " + className} role="text" aria-label={text}>
      {chars.map((c, i) => {
        // Keyed from the right, so a column keeps its place as the number gains a digit.
        const fromRight = chars.length - 1 - i;
        return /\d/.test(c) ? (
          <span key={"d" + fromRight} className="rn-col" aria-hidden="true" style={{ ["--n" as string]: Number(c) }}>
            <span className="rn-strip">{DIGITS.map((d) => <i key={d}>{d}</i>)}</span>
          </span>
        ) : (
          <span key={"c" + fromRight + c} className="rn-sym" aria-hidden="true">{c}</span>
        );
      })}
    </span>
  );
}
