import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A person's name or picture that opens their profile, where you can add them as a friend. Without a database there are no real profiles
 *  to open, so it is plain text there. */
export default function PersonLink({ id, className, children }: { id: string; className?: string; children: ReactNode }) {
  if (!supabase || !UUID.test(id)) return <span className={className}>{children}</span>;
  return <Link to={`/app/people/${id}`} className={"person-link" + (className ? ` ${className}` : "")}>{children}</Link>;
}
