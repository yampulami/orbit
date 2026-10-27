import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** The friendly "nothing here yet" screen: a soft floating icon, a line that says what this place is for, and the one thing to do next. */
export default function EmptyState({ icon: Icon, title, children, action }: { icon: LucideIcon; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty-state" role="status">
      <span className="empty-ico" aria-hidden="true"><Icon size={26} strokeWidth={1.7} /></span>
      <h2>{title}</h2>
      {children && <p className="muted">{children}</p>}
      {action}
    </div>
  );
}
