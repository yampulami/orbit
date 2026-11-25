import { GraduationCap } from "lucide-react";
import { useAlumYear } from "../lib/graduation";

/** Beside the name of a verified graduate. Nothing is shown for anyone else. */
export default function AlumBadge({ id }: { id: string | undefined }) {
  const year = useAlumYear(id);
  if (!year) return null;
  const label = `Verified graduate, class of ${year}`;
  return (
    <span className="alum-badge" title={label}>
      <GraduationCap size={11} aria-hidden="true" /><span aria-hidden="true">Alum ’{String(year).slice(-2)}</span><span className="sr">{label}</span>
    </span>
  );
}
