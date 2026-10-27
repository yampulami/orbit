import { BadgeCheck } from "lucide-react";

/** The check beside a name: a campus coordinator or staff member, or a club or office a coordinator approved. */
export default function VerifiedBadge({ label = "Verified" }: { label?: string }) {
  return <span className="verified" role="img" aria-label={label} title={label}><BadgeCheck size={15} aria-hidden="true" /></span>;
}
