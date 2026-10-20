import { CalendarCheck, CheckCheck, Coffee, CloudRain, MessagesSquare, PenLine, Users, type LucideIcon } from "lucide-react";
import type { Area } from "../lib/progress";

const icons: Record<string, LucideIcon> = { pen: PenLine, messages: MessagesSquare, users: Users, checks: CheckCheck, coffee: Coffee, calendar: CalendarCheck, rain: CloudRain };

/** Badge art: one line icon on a pastel circle, colored by area. */
export default function BadgeIcon({ icon, area, size = 64 }: { icon: string; area: Area; size?: number }) {
  const Icon = icons[icon] ?? PenLine;
  return (
    <span className="badge-ico" data-area={area} style={{ width: size, height: size }} aria-hidden="true">
      <Icon size={Math.round(size * 0.42)} strokeWidth={1.75} />
    </span>
  );
}
