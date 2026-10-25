import "./siteUrl"; // reads any link problem from the address before the client tidies it away
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/** Set at build time (VITE_DEMO=1) for the hosted preview: no backend, runs in the browser. */
export const DEMO_BUILD = import.meta.env.VITE_DEMO === "1";

export const supabase = !DEMO_BUILD && url && key && !url.includes("your-project") ? createClient(url, key) : null;
