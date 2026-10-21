import { supabase } from "./supabase";
import type { PlaceCategory } from "./campus";
import type { Proposal, Vote } from "./placeVotes";
import { loadNames, makeLabeler } from "./people";

/** Student-added places and their votes in the database. The rows become the same `Proposal` shapes the map already uses. */
export type RawPlace = { id: string; campus_key: string; name: string; category: PlaceCategory; lat: number; lng: number; blurb: string | null; created_by: string | null; created_at: string };
export type RawVote = { place_id: string; user_id: string; vote: Vote };
export type RawPlaces = { me: string; places: RawPlace[]; votes: RawVote[]; names: Record<string, string> };

/** Pure: rows in, proposals out. The person who added a place is its first confirmation (the database adds that vote itself). */
export function buildProposals(raw: RawPlaces): Proposal[] {
  const ids = [...raw.places.map((p) => p.created_by).filter((x): x is string => !!x), ...raw.votes.map((v) => v.user_id)];
  const label = makeLabeler(raw.me, ids, raw.names);
  return raw.places.map((p) => {
    const votes: Record<string, Vote> = {};
    raw.votes.filter((v) => v.place_id === p.id).forEach((v) => { votes[label(v.user_id)] = v.vote; });
    return {
      id: p.id, campusKey: p.campus_key, name: p.name, category: p.category, lat: p.lat, lng: p.lng, details: p.blurb ?? undefined,
      by: p.created_by ? label(p.created_by) : "A student", at: p.created_at, votes,
    };
  });
}

/** Everything students added on this campus that the signed-in student may see (open ones and confirmed ones; dropped ones are hidden by the rules). */
export async function loadPlaces(me: string): Promise<RawPlaces> {
  const sb = supabase!;
  const pl = await sb.from("campus_places").select("id,campus_key,name,category,lat,lng,blurb,created_by,created_at").eq("source", "students").order("created_at", { ascending: true }).limit(500);
  if (pl.error) throw new Error(pl.error.message);
  const places = (pl.data ?? []) as RawPlace[];
  const vt = places.length ? await sb.from("place_votes").select("place_id,user_id,vote").in("place_id", places.map((p) => p.id)) : { data: [] as never[], error: null };
  if (vt.error) throw new Error(vt.error.message);
  const votes = (vt.data ?? []) as RawVote[];
  const names = await loadNames([...places.map((p) => p.created_by).filter((x): x is string => !!x), ...votes.map((v) => v.user_id)]);
  return { me, places, votes, names };
}
