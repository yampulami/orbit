import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import Orb from "./Orb";
import OmegaMini from "./OmegaMini";
import type { OrbMood } from "../lib/orbGaze";

/** The friendly "nothing here yet" screen: Omega standing there doing little things (the orb if he cannot load), a line that says what this place is for, and the one thing to do next. */
export default function EmptyState({ title, children, action, mood = "idle" }: { icon?: LucideIcon; title: string; children?: ReactNode; action?: ReactNode; mood?: OrbMood }) {
  return (
    <div className="empty-state" role="status">
      <OmegaMini width={184} height={92} scale={0.5} className="empty-omega" fallback={<Orb size={56} variant="violet" mood={mood} className="empty-orb" />} />
      <h2>{title}</h2>
      {children && <p className="muted">{children}</p>}
      {action}
    </div>
  );
}
